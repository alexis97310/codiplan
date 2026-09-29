import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-C5-TIROIR — même recette que
 * `captures-pg-c2-file-onglets.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git worktree`), APRÈS sur le code livré. Aucune clé typée du
 * dictionnaire : le tiroir n'existe pas sur le code d'AVANT.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGC5CAP-` : une intervention « à planifier ».
 * Sur le code d'AVANT, cliquer sa carte MÈNE À LA FICHE (aucun tiroir) ; sur
 * le code livré, la même carte ouvre le tiroir sans quitter le planning.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_C5 ?? "";

const CLIENT_PGC5 = uuidv7();
const SITE_PGC5 = uuidv7();
const INTERVENTION_PGC5 = uuidv7();

let reperes: ReperesDeScene;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGC5,
        societe_id: reperes.societeId,
        raison_sociale: "PGC5CAP",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGC5,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGC5,
        agence_id: agence.id,
        libelle: "PGC5CAP",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p2',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF',
               'PGC5CAP — à planifier', now())`,
      INTERVENTION_PGC5,
      reperes.societeId,
      agence.id,
      CLIENT_PGC5,
      SITE_PGC5,
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
      CLIENT_PGC5,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGC5 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGC5 } });
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

async function capturerLeClic(page: Page, largeur: number): Promise<void> {
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  const carte = page.locator(`a[href*="${INTERVENTION_PGC5}"]`).first();
  await expect(carte).toBeVisible();

  // LE CONTENU DU TIROIR EST CHARGÉ À PART, PAR `/resume` — sur le code
  // d'AVANT, cette réponse n'arrive jamais, et l'attente échoue seule : elle
  // est donc engagée AVANT le clic, jamais attendue si elle ne vient pas.
  const reponseResume = page
    .waitForResponse(
      (reponse) =>
        reponse.url().includes("/resume") &&
        reponse.request().method() === "GET",
      { timeout: 5_000 },
    )
    .catch(() => null);
  await carte.click();

  const tiroir = page.locator(`[data-tiroir-ouvert="${INTERVENTION_PGC5}"]`);
  if ((await tiroir.count()) > 0) {
    await expect(tiroir).toBeVisible();
    await reponseResume;
    await page.waitForTimeout(300);
    await capturer(page, "tiroir-apres", largeur);
    return;
  }
  // LE CODE D'AVANT : aucun tiroir, le clic a mené à la fiche.
  await expect(page).toHaveURL(
    new RegExp(`/interventions/${INTERVENTION_PGC5}`),
  );
  await capturer(page, "fiche-avant", largeur);
}

test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — le clic sur une carte, à 1280px", async ({ page }) => {
    await capturerLeClic(page, 1280);
  });
});

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — le clic sur une carte, à 375px", async ({ page }) => {
    await capturerLeClic(page, 375);
  });
});
