import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import type { ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-B2-FENETRE-POSE (28/09/2026) — même recette que
 * `captures-pg-a7-semaine-garde-heure.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git worktree`), APRÈS sur le code livré. Le sélecteur qui décide
 * de la capture (`[data-refus], [data-fenetre-pose]`) est une CHAÎNE, jamais
 * une clé typée du dictionnaire — celle-ci n'existe pas encore sur le code
 * d'AVANT, et `tsconfig.json` inclut `tests/` : une clé typée y casserait le
 * build AVANT le lancement du serveur (piège déjà mesuré, lot VGP-2).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB2-` — une intervention « À planifier », sans
 * technicien ni créneau, déposée sur une case de technicien un MARDI, en vue
 * Semaine. AVANT ce ticket, la case n'a pas de minutes et la pose exige les
 * quatre valeurs ensemble (PARCOURS-1) : le dépôt est refusé. APRÈS, la
 * fenêtre de pose s'ouvre plutôt que d'écrire.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_B2 ?? "";

const CLIENT_PGB2 = uuidv7();
const SITE_PGB2 = uuidv7();
const INTERVENTION_PGB2 = uuidv7();

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
        id: CLIENT_PGB2,
        societe_id: reperes.societeId,
        raison_sociale: "PGB2",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB2,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB2,
        agence_id: agence.id,
        libelle: "PGB2",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF', now())`,
      INTERVENTION_PGB2,
      reperes.societeId,
      agence.id,
      CLIENT_PGB2,
      SITE_PGB2,
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
      CLIENT_PGB2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB2 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB2 } });
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

test.describe(`à 1280px`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — le dépôt d'une carte de la file en vue Semaine, à 1280px", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    const source = page.locator(`[data-bloc="${INTERVENTION_PGB2}"]`);
    const cible = page.locator(
      `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, MARDI))}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();
    await glisser(page, source, cible);
    // Un sélecteur EN CHAÎNE, jamais une clé typée (voir l'entête) : sur le
    // code d'AVANT, seul `[data-refus]` existe ; sur le code livré, seul
    // `[data-fenetre-pose]` existe.
    await page.waitForSelector("[data-refus], [data-fenetre-pose]");
    await capturer(page, "depot-semaine", 1280);
  });
});

test.describe(`à 375px`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la carte de la file sur téléphone (bouton « Poser » quand il existe), à 375px", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    const carte = page.locator(`[data-bloc="${INTERVENTION_PGB2}"]`);
    await expect(carte).toBeVisible();
    // La grille glissable n'existe pas sous `lg` (`hidden ... lg:block`) : le
    // geste de déposer n'a pas d'équivalent tactile. AVANT ce ticket, rien à
    // cliquer — la capture montre la carte telle quelle. APRÈS, le bouton
    // « Poser » (accessible au clavier et au téléphone) ouvre la même
    // fenêtre. `hasText` en dur : une clé typée casserait le build AVANT.
    // SCOPÉ À `carte` — sinon `.first()` peut cliquer le bouton d'une AUTRE
    // carte de la file (celles du semis), et sa fenêtre à elle s'ouvrirait.
    const bouton = carte.locator("button", { hasText: "Poser" });
    if ((await bouton.count()) > 0) {
      await bouton.first().click();
      await page.waitForSelector(
        '[data-fenetre-pose="' + INTERVENTION_PGB2 + '"]',
      );
    }
    await capturer(page, "depot-semaine", 375);
  });
});
