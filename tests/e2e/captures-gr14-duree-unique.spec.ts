import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AE-GR14-DUREE-UNIQUE (27/09/2026) — même recette que
 * `captures-gr13-fiche-telephone.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * UNE seule intervention (préfixe `GR14CAP-`), à sa propre ligne fixe, jamais
 * une fixture `SCENE.*` partagée : `cloturee`, un segment fermé de 5 minutes,
 * une pause fermée de 8 minutes — l'écart mesuré par l'audit (« 05 min » →
 * « 5 min ») ne se voit QUE sous une durée à un seul chiffre. Trois écrans,
 * deux identités : `/interventions/<id>` et son `/bon` se regardent depuis le
 * back-office (`ouvrirUneSession`) ; `/terrain/<id>` exige l'identité DU
 * TECHNICIEN AFFECTÉ (restriction par personne), donc la session du compte de
 * l'épreuve terrain — jamais la même page que l'assertion `terrain.spec.ts`,
 * qui vise `SCENE.*` et ne mesure explicitement aucune durée.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_GR14 ?? "";

const CLIENT_GR14CAP = "01a0f200-0000-7000-8000-0000000000e1";
const SITE_GR14CAP = "01a0f200-0000-7000-8000-0000000000e2";
const INTERVENTION_GR14CAP = "01a0f200-0000-7000-8000-0000000000e3";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_pause" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_GR14CAP,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_GR14CAP,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_GR14CAP },
    });
    await client.site.deleteMany({ where: { id: SITE_GR14CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_GR14CAP } });

    await client.client.create({
      data: {
        id: CLIENT_GR14CAP,
        societe_id: reperes.societeId,
        raison_sociale: "GR14CAP — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_GR14CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_GR14CAP,
        agence_id: ducos.id,
        libelle: "GR14CAP — Lieu de l'épreuve",
      },
    });

    // `terminee`, PAS `cloturee` : une intervention clôturée ne se modifie
    // plus (I5, contrainte `intervention_cloturee_immuable`) — la ligne passe
    // `cloturee` en tout dernier geste, une fois le reste posé.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee",
         "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'terminee'::"StatutIntervention", now()::date,
               'temps_passe', 'XPF', now())`,
      INTERVENTION_GR14CAP,
      reperes.societeId,
      ducos.id,
      CLIENT_GR14CAP,
      SITE_GR14CAP,
      reperes.technicienDucos,
    );

    // LE SEGMENT D'ABORD, LA SOMME ENSUITE — même ordre que
    // `bon-intervention.spec.ts` : le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` vérifie que
    // `temps_mesure_min` est la somme des segments FERMÉS déjà présents.
    // CINQ minutes, volontairement — un seul chiffre, celui qui distinguait
    // « 05 min » (avant) de « 5 min » (après).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '5 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_GR14CAP,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_GR14CAP },
      data: {
        temps_mesure_min: 5,
        temps_valide_min: 5,
        temps_valide_par: reperes.technicienDucos,
        temps_valide_le: new Date(),
        // DÉJÀ VUE : sans quoi `marquerVuParTechnicien` tenterait d'écrire
        // dans cette même colonne à la première ouverture de `/terrain/<id>`
        // — un geste que la ligne, CLÔTURÉE plus bas, refuse déjà (I5,
        // contrainte `intervention_cloturee_immuable`).
        vue_technicien_le: new Date(),
      },
    });

    // Une pause FERMÉE de 8 minutes — même chiffre unique, pour
    // `lignePausePeriode` (fiche) et le bon.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_pause"
         ("id","societe_id","intervention_id","debut","fin","motif","ouvert_par","fermee_par")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid,
               now() - interval '20 minutes', now() - interval '12 minutes',
               'GR14 — épreuve', $3::uuid, $3::uuid)`,
      reperes.societeId,
      INTERVENTION_GR14CAP,
      reperes.technicienDucos,
    );

    // LA CLÔTURE, EN DERNIER : au-delà, la ligne ne se modifie plus.
    await client.intervention.update({
      where: { id: INTERVENTION_GR14CAP },
      data: { statut: "cloturee", cloturee_le: new Date() },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_pause" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_GR14CAP,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_GR14CAP,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_GR14CAP },
    });
    await client.site.deleteMany({ where: { id: SITE_GR14CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_GR14CAP } });
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
  await expect(page).toHaveURL(/\/terrain/);
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.describe("back-office", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 900 });
        await ouvrirUneSession(page);
      });

      test(`capture — fiche cloturee`, async ({ page }) => {
        await page.goto(`/interventions/${INTERVENTION_GR14CAP}`);
        await expect(page.locator("main h1")).toBeVisible();
        await capturer(page, "fiche-cloturee", largeur);
      });

      test(`capture — bon`, async ({ page }) => {
        // VERSION INTERNE (D186, 9EN) — la version client par défaut ne
        // porte plus la section « Valorisation », que cette capture vise
        // précisément.
        await page.goto(
          `/interventions/${INTERVENTION_GR14CAP}/bon?version=interne`,
        );
        await expect(
          page.getByRole("heading", {
            name: fr["intervention.bon.valorisation_titre"],
          }),
        ).toBeVisible();
        await capturer(page, "bon", largeur);
      });
    });

    test.describe("terrain", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 900 });
        await ouvrirLaSessionDuTerrain(page);
      });

      test(`capture — compteur terrain`, async ({ page }) => {
        await page.goto(`/terrain/${INTERVENTION_GR14CAP}`);
        await expect(
          page.getByRole("heading", { name: fr["terrain.compteur"] }),
        ).toBeVisible();
        await capturer(page, "terrain-compteur", largeur);
      });
    });
  });
}
