import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { conditionsDeFacturation } from "@/lib/tarification/conditions";
import { REGLE_PAR_DEFAUT } from "@/lib/tarification/valorisation";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  FORFAITS_SCENE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

/**
 * 9I8B-CONDITIONS-DE-FACTURATION-SANS-MONTANT — décisions d'Alexis du
 * 29/10/2026 : les conditions de facturation s'affichent sur l'écran de
 * signature du technicien, SANS AUCUN MONTANT.
 *
 * SA PROPRE SCÈNE, préfixée `9I8B-`, sans toucher à `setup/scene.ts` — même
 * doctrine que `tests/e2e/9f4-terrain-enregistrement-auto.spec.ts`. La règle
 * de facturation du temps de `CODIMA-NC` n'est modifiée par aucun autre
 * fichier e2e (mesuré : aucun n'écrit `facturation_plancher_min` et
 * consorts) — elle reste la règle par défaut (60, 30, 5) tout au long de la
 * campagne, et cette épreuve s'appuie dessus.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I8B-CONDITIONS-DE-FACTURATION-SANS-MONTANT/captures",
);

async function capturer(page: Page, nom: string, largeur: number) {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** Même régime que `tests/e2e/9f4-terrain-enregistrement-auto.spec.ts`. */
const FORME_MONTANT = /\d[\d ]*(?:,\d+)? (?:XPF|€)/u;
const SYMBOLES_DEVISE = /\bXPF\b|€/u;

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();

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
        raison_sociale: "zz9I8B Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9I8B Site",
      },
    });
    // TEMPS PASSÉ + UN FORFAIT DE DÉPLACEMENT (RG-INT-07) — pour que les
    // DEUX lignes de conditions se mesurent dans la même fiche : la règle du
    // temps, et le déplacement nommé.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "en_cours",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        forfait_deplacement_id: FORFAITS_SCENE[0].id,
        devise_code: "XPF",
        duree_estimee_min: 30,
        date_planifiee: new Date(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("le bloc « Conditions de facturation » s'affiche sur l'écran de signature, sans aucun montant", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);

  const reponsesInstantane: string[] = [];
  page.on("response", (reponse) => {
    if (reponse.url().includes("/api/terrain/instantane")) {
      reponse
        .text()
        .then((texte) => reponsesInstantane.push(texte))
        .catch(() => {
          // La requête peut échouer sans rapport avec ce test — rien à
          // ajouter alors à ce qui est vérifié ci-dessous.
        });
    }
  });

  await page.goto(`/terrain/${INTERVENTION_ID}`);

  // LES LIGNES ATTENDUES, RENDUES PAR LA MÊME FONCTION QUE LE SERVEUR
  // (`conditionsDeFacturation`) — jamais une phrase recopiée à la main, qui
  // divergerait en silence du vrai texte le jour où il change (§9, 01/09).
  const lignesAttendues = conditionsDeFacturation({
    mode: "temps_passe",
    libelleForfait: null,
    libelleForfaitDeplacement: FORFAITS_SCENE[0].libelle,
    regle: REGLE_PAR_DEFAUT,
    majorationApplicable: false,
  });

  await expect(
    page.getByRole("heading", {
      name: fr["tarification.conditions.titre"],
    }),
  ).toBeVisible();
  for (const ligne of lignesAttendues) {
    await expect(page.getByText(ligne)).toBeVisible();
  }

  await capturer(page, "terrain-conditions-facturation", 375);

  // AUCUN MONTANT, NI DANS LE HTML DE LA PAGE, NI DANS LA RÉPONSE DE
  // `/api/terrain/instantane` — ce même composant alimente la copie hors
  // réseau (voir `tests/unit/terrain/sans-montant.test.ts`), et une fuite
  // dans l'un se retrouverait dans l'autre.
  const texteFiche = await page.locator("main").innerText();
  expect(texteFiche).not.toMatch(FORME_MONTANT);
  expect(texteFiche).not.toMatch(SYMBOLES_DEVISE);

  // L'instantané s'écrit en arrière-plan (copie locale, I4) : on attend
  // qu'au moins une réponse soit arrivée avant de la lire.
  await expect
    .poll(() => reponsesInstantane.length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  for (const corps of reponsesInstantane) {
    expect(corps).not.toMatch(FORME_MONTANT);
    expect(corps).not.toMatch(SYMBOLES_DEVISE);
  }
});
