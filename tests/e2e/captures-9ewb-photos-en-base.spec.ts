import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9EWB-PHOTOS-EN-BASE — bloc photo (avant envoi / envoyée /
 * échec) et le bon avec la photo.
 *
 * SA PROPRE INTERVENTION, préfixée `9EWB-` (I9) : ni `SCENE.*` ni une table
 * partagée — un spec de captures qui réutilisait une intervention d'un
 * AUTRE fichier risquerait d'y laisser une photo que ce fichier-là ne
 * mesure pas (`e2e-semis-partage-parallele`, même famille de défaut).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EWB ?? "";

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.document.deleteMany({
    where: { intervention_id: INTERVENTION_ID },
  });
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9EWB-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9EWB-Lieu (captures)",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "affectee",
        type: "curatif",
        duree_estimee_min: 60,
        date_planifiee: new Date(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
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

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

for (const largeur of [375, 1280] as const) {
  test(`capture — bloc photo avant envoi, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_ID}`);
    await expect(page.getByText(fr["terrain.photos.titre"])).toBeVisible();
    await capturer(page, "bloc-avant-envoi", largeur);
  });

  test(`capture — bloc photo envoyée, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_ID}`);

    await page.locator('input[type="file"]').setInputFiles({
      name: "capture-9ewb.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await page
      .getByRole("button", { name: fr["terrain.photos.ajouter"] })
      .click();
    await expect(
      page.getByText(fr["terrain.photos.enregistree"]),
    ).toBeVisible();
    await capturer(page, "bloc-envoyee", largeur);
  });

  test(`capture — bloc photo, échec de la réduction, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_ID}`);

    // Un fichier qui PRÉTEND être une image mais qu'aucun décodeur ne lit —
    // `createImageBitmap` échoue, l'état « Échec » s'affiche SANS jamais
    // joindre la route (aucune capacité serveur n'est requise ici).
    await page.locator('input[type="file"]').setInputFiles({
      name: "corrompu.png",
      mimeType: "image/png",
      buffer: Buffer.from("ceci n'est pas un PNG"),
    });
    await page
      .getByRole("button", { name: fr["terrain.photos.ajouter"] })
      .click();
    await expect(
      page.getByText(fr["terrain.photos.reduction_impossible"]),
    ).toBeVisible();
    await capturer(page, "bloc-echec", largeur);
  });
}

test("le bon porte la photo déposée", async ({ page }) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'en_cours'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
  } finally {
    await client.$disconnect();
  }

  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
  await expect(page.locator("img[alt='capture-9ewb.png']")).toBeVisible();

  for (const largeur of [375, 1280] as const) {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await capturer(page, "bon", largeur);
  }
});
