import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES AVANT/APRÈS DE 9DF-TP-CY2-MATRICE-D8 (D160, QT-4, 04/10/2026).
 *
 * **CE FICHIER NE FAIT AUCUNE HYPOTHÈSE SUR LA MATRICE D8** — volontairement :
 * il tourne une première fois SUR LE CODE D'AVANT ce lot (avant son premier
 * commit), puis une seconde fois APRÈS, pour que les captures « avant » et
 * « après » montrent la MÊME scène sous deux versions du code. Il ne
 * référence donc AUCUNE clé de dictionnaire ni AUCUN comportement que ce lot
 * introduit (`intervention.refus.pas_terminee`, `compteur.refus.a_planifier`,
 * etc.) — seulement des faits déjà vrais avant ce lot (le statut affiché,
 * l'URL), pour que ce même fichier type-vérifie et s'exécute sur les deux
 * versions.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DF-CAPTURES-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll`, rien n'est écrit sur
 * `SCENE.*`.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_9DF = uuidv7();
const SITE_9DF = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();
const INTERVENTION_TERRAIN_A_PLANIFIER = uuidv7();

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
        raison_sociale: "9DF-CAPTURES — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DF,
        societe_id: reperes.societeId,
        client_id: CLIENT_9DF,
        agence_id: agence.id,
        libelle: "9DF-CAPTURES — site",
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "duree_estimee_min", "temps_valide_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', 60, 60, now())`,
      INTERVENTION_CLOTUREE,
      reperes.societeId,
      CLIENT_9DF,
      SITE_9DF,
      agence.id,
    );

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', now())`,
      INTERVENTION_A_PLANIFIER,
      reperes.societeId,
      CLIENT_9DF,
      SITE_9DF,
      agence.id,
    );

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'terminee', 60, now())`,
      INTERVENTION_TERMINEE,
      reperes.societeId,
      CLIENT_9DF,
      SITE_9DF,
      agence.id,
    );

    // TECHNICIEN CONSERVÉ, STATUT « a_planifier » — le portrait d'une
    // AFFECTÉE déplanifiée par une absence (SAV-05).
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "technicien_id", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', $6::uuid, 60, now())`,
      INTERVENTION_TERRAIN_A_PLANIFIER,
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

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9DF-TP-CY2-MATRICE-D8/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("fiche bureau — intervention CLÔTURÉE", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_CLOTUREE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.cloturee"]),
  ).toBeVisible();
  await capturer(page, "fiche-bureau-cloturee", 1280);
  await capturer(page, "fiche-bureau-cloturee", 375);
});

test("fiche bureau — intervention À PLANIFIER", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();
  await capturer(page, "fiche-bureau-a-planifier", 1280);
  await capturer(page, "fiche-bureau-a-planifier", 375);
});

test("fiche bureau — intervention TERMINÉE", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_TERMINEE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();
  await capturer(page, "fiche-bureau-terminee", 1280);
  await capturer(page, "fiche-bureau-terminee", 375);
});

test("fiche terrain — intervention À PLANIFIER (déplanifiée, technicien conservé)", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);

  await page.goto(`/terrain/${INTERVENTION_TERRAIN_A_PLANIFIER}`);
  await capturer(page, "fiche-terrain-a-planifier", 1280);
  await capturer(page, "fiche-terrain-a-planifier", 375);
});
