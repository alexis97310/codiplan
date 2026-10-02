import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { instantAMinutes, jourSuivant, cleJour } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9CY-RETOUCHES-8, point 4 (décision d'Alexis du 02/10/2026, point 6,
 * D141) — LE CHEMIN TIROIR DE « REMETTRE DANS LA FILE » PRÉVIENT LE
 * TECHNICIEN D'AVANT, DE BOUT EN BOUT.
 *
 * ## Ce que les tests existants ne prouvaient pas
 *
 * `tests/isolation/avertissements-transmission.test.ts:265` éprouve
 * `avertirApresPlanification` par appel direct, avec un `avant` forgé à la
 * main — elle prouve la RÈGLE, jamais que le bouton « Remettre dans la file »
 * du TIROIR (`components/planning/tiroir.tsx`) l'atteint réellement.
 * `pg-g14a-transmettre.spec.ts:227-258` éprouve la remise en file par le
 * chemin FICHE (le formulaire « Déplacer » vidé) ; ce fichier éprouve l'AUTRE
 * chemin, le seul qui n'a jamais été joué à travers l'écran : le tiroir du
 * planning, qui envoie un POST JSON sans jamais recharger via un formulaire.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PGY-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne au semis ni à
 * `SCENE.*`. Le technicien emprunté (`garnier@codima.test`, Ducos) est une
 * identité DU SEMIS, en LECTURE SEULE : seul son adresse sert à compter le
 * courriel « retirée ».
 *
 * ## LA DATE — +168 JOURS (24 SEMAINES), À L'ÉCART DES FICHIERS VOISINS
 *
 * Décalages déjà pris par les fichiers voisins : 1, 5, 7, 10, 11, 14, 16, 77,
 * 84, 91, 92, 140, 147.
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * Même double que `pg-g14a-transmettre.spec.ts` —
 * `tests/e2e/setup/double-courriel.cjs`, chargé globalement par
 * `playwright.config.ts`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const EMAIL_TECHNICIEN_DUCOS = "garnier@codima.test";

let societeId = "";
let technicienId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function courrielsCaptures(): unknown[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as unknown);
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const jour = jourSuivant(reperes.lundi, 168);

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "PGY — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "PGY — site",
      },
    });
    // AFFECTÉE directement — c'est l'état que le tiroir doit remettre dans
    // la file, pas un parcours de transmission que ce fichier n'éprouve pas.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(jour, 9 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 10 * 60, reperes.fuseau),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGY — intervention forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("le tiroir, « Remettre dans la file » sur une Affectée, prévient le technicien d'avant par un courriel « retirée »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });

  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 168);
  const semaine = cleJour(jour);

  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=semaine&semaine=${semaine}`);

  const carte = page.locator(`a[href*="${INTERVENTION_ID}"]`).first();
  await expect(carte).toBeVisible();

  const reponseResume = page.waitForResponse(
    (reponse) =>
      reponse.url().includes("/resume") && reponse.request().method() === "GET",
  );
  await carte.click();
  await reponseResume;

  const tiroir = page.locator(`[data-tiroir-ouvert="${INTERVENTION_ID}"]`);
  await expect(tiroir).toBeVisible();

  // PREUVE (README du lot) — le tiroir, bouton « Remettre dans la file »
  // visible, juste avant le clic qui le déclenche.
  const boutonRemettre = tiroir.getByRole("button", {
    name: fr["planning.tiroir.remettre_dans_la_file"],
  });
  await expect(boutonRemettre).toBeVisible();
  const dossierCaptures = join(
    process.cwd(),
    "docs/propositions/9CY-RETOUCHES-8/captures",
  );
  mkdirSync(dossierCaptures, { recursive: true });
  await page.screenshot({
    path: join(dossierCaptures, "tiroir-remettre-dans-la-file-1280.png"),
    fullPage: true,
  });

  const avant = courrielsCaptures().length;
  await boutonRemettre.click();
  await page.waitForLoadState("networkidle");

  expect(courrielsCaptures().length).toBe(avant + 1);
  const dernierEnvoi = courrielsCaptures().at(-1) as {
    readonly to?: readonly string[];
    readonly subject?: string;
  };
  expect(dernierEnvoi.to).toContain(EMAIL_TECHNICIEN_DUCOS);
  expect(dernierEnvoi.subject).toBe(
    "CODIPLAN — Intervention retirée de votre planning",
  );
});
