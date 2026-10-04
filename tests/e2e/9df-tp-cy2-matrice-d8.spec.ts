import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9DF-TP-CY2-MATRICE-D8 (04/10/2026, QT-4, D160) — « DÉMARRER » NE PART QUE DE
 * CE QUE D8 PERMET, CÔTÉ TERRAIN.
 *
 * ## CE QUE CE FICHIER MESURE, ET QUE RIEN D'AUTRE NE MESURE
 *
 * Les scénarios unitaires (`peutDemarrerLeCompteur`) et d'isolation
 * (`intervention.test.ts`) prouvent que le serveur et la base refusent la
 * transition `A_PLANIFIER → EN_COURS`. Ils ne peuvent pas prouver que
 * **l'écran du terrain ne propose pas un départ que la base refuserait** —
 * c'est le cas d'une intervention DÉPLANIFIÉE (SAV-05) : le technicien reste
 * affecté, le créneau part, le statut retombe à « À planifier », et la fiche
 * terrain reste atteignable (seule « Planifiée » est écartée avant d'y
 * arriver).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DF-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, et rien n'est écrit sur `SCENE.*` (`tests/e2e/setup/scene.ts`).
 * Le technicien, lui, est une identité DU SEMIS (`garnier@codima.test`,
 * Ducos) : il faut un compte dont on connaisse le mot de passe pour se
 * connecter côté terrain.
 */

// ÉCRIT EN BASE DANS `beforeAll`, SANS `ON CONFLICT` (gardien
// `tests/unit/e2e-mise-en-scene.test.ts`) : la série évite que deux workers
// ne rejouent ce `beforeAll` en même temps sur la même ligne.
test.describe.configure({ mode: "serial" });

const CLIENT_9DF = uuidv7();
const SITE_9DF = uuidv7();
const INTERVENTION_9DF_A_PLANIFIER = uuidv7();

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
        id: CLIENT_9DF,
        societe_id: reperes.societeId,
        raison_sociale: "9DF-TP-CY2 — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DF,
        societe_id: reperes.societeId,
        client_id: CLIENT_9DF,
        agence_id: agence.id,
        libelle: "9DF-TP-CY2 — site",
      },
    });

    // INSÉRÉE DIRECTEMENT « a_planifier », TECHNICIEN CONSERVÉ — le portrait
    // exact d'une AFFECTÉE déplanifiée par une absence (SAV-05) : la date et
    // le créneau partent, le technicien reste (`lib/absences/depot.ts`).
    // L'`INSERT` ne déclenche pas `intervention_cycle_de_vie`, qui ne garde
    // que l'`UPDATE`.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "technicien_id", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', $6::uuid, 60, now())`,
      INTERVENTION_9DF_A_PLANIFIER,
      reperes.societeId,
      CLIENT_9DF,
      SITE_9DF,
      agence.id,
      reperes.technicienDucos,
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
      CLIENT_9DF,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9DF } });
    await client.client.deleteMany({ where: { id: CLIENT_9DF } });
  } finally {
    await client.$disconnect();
  }
});

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionDuTerrain(page);
});

test("pas de « Démarrer » sur une À PLANIFIER déplanifiée — D8 n'a pas de flèche depuis ce statut", async ({
  page,
}) => {
  await page.goto(`/terrain/${INTERVENTION_9DF_A_PLANIFIER}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
  ).toHaveCount(0);
  await expect(page.getByText(fr["compteur.refus.a_planifier"])).toBeVisible();
});
