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
 * LES CAPTURES DE PG-C2-FILE-ONGLETS — même recette que
 * `captures-pg-b2-fenetre-pose.spec.ts` : AVANT sur le code d'avant ce ticket
 * (`git worktree`), APRÈS sur le code livré. Aucune clé typée du dictionnaire
 * (`fr["…"]`) : les onglets n'existent pas sur le code d'AVANT, et
 * `tsconfig.json` inclut `tests/` — une clé neuve casserait le build AVANT.
 * Tous les sélecteurs sont des CHAÎNES, comme le veut la recette.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGC2CAP-` : quatre interventions du même client,
 * une par population — « à planifier », « en retard », « sans durée »,
 * « suspendue ». Sur le code d'AVANT, seule la première apparaît (l'unique
 * colonne « À planifier ») ; les trois autres existent déjà en base, prêtes
 * pour la capture de l'APRÈS.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_C2 ?? "";

const CLIENT_PGC2 = uuidv7();
const SITE_PGC2 = uuidv7();
const A_PLANIFIER = uuidv7();
const EN_RETARD = uuidv7();
const SANS_DUREE = uuidv7();
const SUSPENDUE = uuidv7();

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
        id: CLIENT_PGC2,
        societe_id: reperes.societeId,
        raison_sociale: "PGC2CAP",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGC2,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGC2,
        agence_id: agence.id,
        libelle: "PGC2CAP",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF',
               'PGC2CAP — à planifier', now())`,
      A_PLANIFIER,
      reperes.societeId,
      agence.id,
      CLIENT_PGC2,
      SITE_PGC2,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'planifiee', DATE '2026-01-05', NULL, NULL, 60, 'temps_passe', 'XPF',
               'PGC2CAP — en retard', now())`,
      EN_RETARD,
      reperes.societeId,
      agence.id,
      CLIENT_PGC2,
      SITE_PGC2,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'en_cours', DATE '2026-01-05', NULL, NULL, NULL, 'temps_passe', 'XPF',
               'PGC2CAP — sans durée', now())`,
      SANS_DUREE,
      reperes.societeId,
      agence.id,
      CLIENT_PGC2,
      SITE_PGC2,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "suspendue_le", "motif_suspension", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'suspendue', DATE '2026-01-05', NULL, NULL, 60, 'temps_passe', 'XPF',
               'PGC2CAP — suspendue', now(), 'PGC2CAP — motif de capture', now())`,
      SUSPENDUE,
      reperes.societeId,
      agence.id,
      CLIENT_PGC2,
      SITE_PGC2,
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
      CLIENT_PGC2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGC2 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGC2 } });
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

/** Les quatre onglets APRÈS ce ticket — absents du code d'AVANT. */
const ONGLETS = ["a_planifier", "en_retard", "sans_duree", "suspendues"];

async function capturerLaColonne(page: Page, largeur: number): Promise<void> {
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  // `data-tiroir-declencheur` (PG-C5-TIROIR) plutôt que `href="/interventions/…"`
  // (PG-C2, ce fichier à l'origine) : le tiroir a depuis changé la cible du
  // lien vers `?intervention=…` — le marqueur, lui, désigne la carte quelle
  // que soit sa cible.
  await expect(
    page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`),
  ).toBeVisible();

  const premierOnglet = page.locator(`[data-onglet-file="${ONGLETS[0]}"]`);
  if ((await premierOnglet.count()) === 0) {
    // LE CODE D'AVANT : aucun onglet, une seule colonne « À planifier ».
    await capturer(page, "colonne-a-planifier-avant", largeur);
    return;
  }

  // LE CODE APRÈS : quatre onglets, chacun sa capture.
  for (const onglet of ONGLETS) {
    await page.locator(`[data-onglet-file="${onglet}"]`).click();
    await expect(page).toHaveURL(
      onglet === "a_planifier"
        ? /planning\?vue=semaine/
        : new RegExp(`onglet=${onglet}`),
    );
    await capturer(page, `colonne-${onglet}-apres`, largeur);
  }
}

test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la colonne « À traiter », à 1280px", async ({ page }) => {
    await capturerLaColonne(page, 1280);
  });
});

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la colonne « À traiter », à 375px", async ({ page }) => {
    await capturerLaColonne(page, 375);
  });
});
