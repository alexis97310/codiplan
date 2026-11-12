import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9K29-PRESTATIONS-PAR-TYPE-INTERVENTION — même recette que
 * `captures-9ah-gr14-prestations-sites.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K29C-` — un client, un site, DEUX interventions
 * (curative et préventive) et une prestation « curatif seulement », créés en
 * `beforeAll`, supprimés en `afterAll`. **Jamais `SCENE.rapportTravaillee`** :
 * `tests/unit/e2e-donnees-partagees.test.ts` refuse qu'un fichier écrive en
 * SQL brut sur une fixture qu'un AUTRE fichier lit (mesuré :
 * `rapport-terrain.spec.ts` écrit sur `SCENE.rapportTravaillee`) — une
 * fixture qui a besoin d'être lue s'en donne une à elle.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (commit `70d920bde`, où ni la colonne « Types
 * d'intervention » ni le filtrage terrain n'existent), une fois sur le code
 * livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K29 ?? "";

const CLIENT_9K29C = uuidv7();
const SITE_9K29C = uuidv7();
const INTERVENTION_9K29C = uuidv7();
const INTERVENTION_PREVENTIVE_9K29C = uuidv7();
const PRESTATION_9K29C = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

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
        id: CLIENT_9K29C,
        societe_id: reperes.societeId,
        raison_sociale: "Client 9K29C",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K29C,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29C,
        agence_id: agence.id,
        libelle: "Site 9K29C",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9K29C,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29C,
        site_id: SITE_9K29C,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_PREVENTIVE_9K29C,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29C,
        site_id: SITE_9K29C,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    // SUR LE CODE D'AVANT CE LOT, LA COLONNE `types` N'EXISTE PAS ENCORE :
    // la capture « avant » ne peut donc pas poser cette prestation avec un
    // type — elle se rejoue alors SANS ce `beforeAll`-ci, directement contre
    // le catalogue de démonstration tel qu'il est au commit `70d920bde`.
    await client.prestation.create({
      data: {
        id: PRESTATION_9K29C,
        societe_id: reperes.societeId,
        code: `9K29C-${PRESTATION_9K29C.slice(0, 8)}`,
        libelle: "Prestation 9K29C (curatif seulement)",
        actif: true,
        types: { create: [{ id: uuidv7(), type_intervention: "curatif" }] },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.prestation.deleteMany({ where: { id: PRESTATION_9K29C } });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9K29C,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9K29C } });
    await client.client.deleteMany({ where: { id: CLIENT_9K29C } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — réglage des prestations à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");
    await expect(
      page.getByRole("heading", { name: fr["prestations.titre"] }),
    ).toBeVisible();
    await capturer(page, "reglage-prestations", largeur);
  });
}

test("capture — rapport terrain à 375px, sur un PRÉVENTIF", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
  await page.goto(`/terrain/${INTERVENTION_PREVENTIVE_9K29C}`);
  await expect(page.getByText(fr["terrain.prestations.titre"])).toBeVisible();
  await capturer(page, "rapport-terrain-preventif", 375);
});

test("capture — rapport terrain à 375px, sur un CURATIF", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
  await page.goto(`/terrain/${INTERVENTION_9K29C}`);
  await expect(page.getByText(fr["terrain.prestations.titre"])).toBeVisible();
  await capturer(page, "rapport-terrain-curatif", 375);
});
