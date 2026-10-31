import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I8B2-MAJORATION-AFFICHEE — correctif : `majorationApplicableALIntervention`
 * se décide désormais sur les minutes hors ouverture du créneau, jamais sur
 * un supplément calculé avec une main-d'œuvre PLACEHOLDER à zéro (qui vaut
 * toujours zéro). Deux scènes, SA PROPRE fixture pour chacune :
 *
 * - une intervention EN COURS, posée sur un créneau EN PARTIE hors ouverture
 *   de DUCOS (7 h 30 – 11 h 30 puis 13 h – 17 h, `DEMO-NOUMEA`) — le chemin
 *   NON FIGÉ, celui que ce correctif répare, lu par l'écran de signature du
 *   technicien (`/terrain/[id]`) ;
 * - une intervention CLÔTURÉE, sa `valorisation_figee` posée directement
 *   (même patron que `captures-9i8a1-regle-facturation.spec.ts`) avec un
 *   supplément de majoration connu et positif — le chemin FIGÉ, inchangé par
 *   ce lot, lu par la version CLIENT du bon (`/interventions/[id]/bon`).
 *
 * Aucun montant, taux ni devise ne doit fuiter sur l'une ou l'autre page.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I8B2-MAJORATION-AFFICHEE/captures",
);

/**
 * `CAPTURE_PHASE=avant` pour le run pris sur le code D'AVANT ce correctif
 * (worktree sur le commit précédent) — `apres` par défaut, pris sur HEAD.
 */
const PHASE_CAPTURE = process.env.CAPTURE_PHASE === "avant" ? "avant" : "apres";

async function capturer(page: Page, nom: string, largeur: number) {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}-${PHASE_CAPTURE}.png`),
    fullPage: true,
  });
}

/** Même régime que `tests/e2e/9i8b-conditions-de-facturation-sans-montant.spec.ts`. */
const FORME_MONTANT = /\d[\d ]*(?:,\d+)? (?:XPF|€)/u;
const SYMBOLES_DEVISE = /\bXPF\b|€/u;

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_SIGNATURE = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();

const SUPPLEMENT_MAJORATION_MINEUR = 4250;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9I8B2 Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9I8B2 Site",
      },
    });

    // UN CRÉNEAU EN PARTIE HORS OUVERTURE : DUCOS ouvre jusqu'à 11 h 30, puis
    // réouvre à 13 h — 11 h – 13 h recouvre 30 minutes ouvertes et 90 minutes
    // hors ouverture (la coupure de mi-journée), jamais la totalité de l'une
    // ou l'autre.
    const creneauDebut = instantAMinutes(
      reperes.lundi,
      11 * 60,
      reperes.fuseau,
    );
    const creneauFin = instantAMinutes(reperes.lundi, 13 * 60, reperes.fuseau);

    await client.intervention.create({
      data: {
        id: INTERVENTION_SIGNATURE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "en_cours",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        date_planifiee: creneauDebut,
        creneau_debut: creneauDebut,
        creneau_fin: creneauFin,
      },
    });

    // LE CHEMIN FIGÉ (inchangé par ce lot) : une `valorisation_figee` posée
    // directement, avec une majoration CONNUE et POSITIVE — ce que
    // `cloturerIntervention` aurait écrit pour une intervention réellement
    // close hors ouverture.
    const valorisationFigee = {
      minutesReelles: 90,
      minutesArrondies: 90,
      minutesFacturees: 90,
      plancherApplique: false,
      regle: { plancherMinutes: 60, palierMinutes: 30, seuilPalierMinutes: 5 },
      tauxHoraire: { valeur: "8500", devise: "XPF" },
      mainDoeuvre: { valeur: "12750", devise: "XPF" },
      forfaitDeplacement: null,
      majoration: {
        valeur: String(SUPPLEMENT_MAJORATION_MINEUR),
        devise: "XPF",
      },
      totalHT: {
        valeur: String(12750 + SUPPLEMENT_MAJORATION_MINEUR),
        devise: "XPF",
      },
      motifTotalInconnu: null,
    };
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "priorite", "date_planifiee", "technicien_id",
          "mode_valorisation", "creneau_debut", "creneau_fin",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "montant_ht", "devise_code", "valorisation_figee",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', 'p3', $6::date, $7::uuid, 'temps_passe'::"ModeValorisation",
               $8::timestamptz, $9::timestamptz,
               90, $7::uuid, now(), now(), $10, 'XPF', $11::jsonb, now())`,
      INTERVENTION_CLOTUREE,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      creneauDebut,
      reperes.technicienDucos,
      creneauDebut,
      creneauFin,
      12750 + SUPPLEMENT_MAJORATION_MINEUR,
      JSON.stringify(valorisationFigee),
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("l'écran de signature du technicien affiche la majoration, sans aucun montant", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);

  const reponsesInstantane: string[] = [];
  page.on("response", (reponse) => {
    if (reponse.url().includes("/api/terrain/instantane")) {
      reponse
        .text()
        .then((texte) => reponsesInstantane.push(texte))
        .catch(() => {
          // Sans rapport avec ce que ce test vérifie.
        });
    }
  });

  await page.goto(`/terrain/${INTERVENTION_SIGNATURE}`);

  await expect(
    page.getByRole("heading", { name: fr["tarification.conditions.titre"] }),
  ).toBeVisible();

  // LA CAPTURE AVANT L'ASSERTION QUI DISTINGUE AVANT/APRÈS (mémoire
  // « captures-avant-apres-e2e ») : sur le code AVANT ce correctif, la
  // phrase de majoration ne s'affiche jamais ici — la capture doit exister
  // même si l'assertion suivante rougit.
  await capturer(page, "terrain-signature-majoration", 375);

  await expect(
    page.getByText(fr["tarification.conditions.majoration"]),
  ).toBeVisible();

  const texteFiche = await page.locator("main").innerText();
  expect(texteFiche).not.toMatch(FORME_MONTANT);
  expect(texteFiche).not.toMatch(SYMBOLES_DEVISE);

  await expect
    .poll(() => reponsesInstantane.length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  for (const corps of reponsesInstantane) {
    expect(corps).not.toMatch(FORME_MONTANT);
    expect(corps).not.toMatch(SYMBOLES_DEVISE);
  }
});

test("la version CLIENT du bon affiche la même phrase, sans aucun montant", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_CLOTUREE}/bon`);

  await expect(
    page.getByRole("heading", { name: fr["tarification.conditions.titre"] }),
  ).toBeVisible();

  // Même ordre que l'écran de signature ci-dessus, bien que ce chemin
  // (FIGÉ) ne soit pas touché par ce correctif — AVANT et APRÈS sont donc
  // attendus identiques ici.
  await capturer(page, "bon-client-majoration", 375);
  await capturer(page, "bon-client-majoration", 1280);

  await expect(
    page.getByText(fr["tarification.conditions.majoration"]),
  ).toBeVisible();

  // LE BON N'A PAS DE `<main>` (il n'emploie pas `components/mise-en-page/
  // page.tsx`, à la différence de l'écran de signature) — tout le corps de
  // la page est le document imprimable, et c'est lui qu'on scrute.
  const texteBon = await page.locator("body").innerText();
  expect(texteBon).not.toMatch(FORME_MONTANT);
  expect(texteBon).not.toMatch(SYMBOLES_DEVISE);
});
