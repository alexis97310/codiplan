import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G1-CORRECTIFS-AUDIT-URGENTS — AVANT/APRÈS, même recette
 * que `captures-9g9a.spec.ts` : rien n'est écrit sans `CAPTURES_9G1` (le
 * dossier), `CAPTURES_9G1_PHASE` choisit entre `avant` et `apres` (par
 * défaut `apres`). Viewport SEUL (jamais `fullPage`), 375 et 1280 px, pour
 * chaque écran touché par les neuf points du lot.
 *
 * AVANT se joue sur un `git worktree` planté sur `bde30d72` (le commit juste
 * avant ce lot) — même recette que `captures-avant-apres-e2e` (mémoire) :
 * `tests/e2e/` copié sur l'ancien code, lancé avec `CI=1`, jamais
 * `reuseExistingServer`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9G1CAP-` : un client actif avec un site SANS
 * commune mais avec une adresse (points 6 et 7), une intervention pour ce
 * site (le compte de l'onglet « Interventions », point 6), un client
 * INACTIF (point 8), une famille de matériel née « à déterminer » (point
 * 9), un lot d'import À ZÉRO LIGNE (point 4), et une intervention EN COURS
 * assignée au technicien de l'épreuve (point 3, le message d'échec de la
 * signature).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G1 ?? "";
const PHASE = process.env.CAPTURES_9G1_PHASE === "avant" ? "avant" : "apres";

const CLIENT_A = uuidv7();
const SITE_A = uuidv7();
const INTERVENTION_A = uuidv7();
const CLIENT_INACTIF = uuidv7();
const FAMILLE = uuidv7();
const LOT_IMPORT = uuidv7();
const INTERVENTION_TERRAIN = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const aujourdhui = instantDuJour(
      jourDe(maintenant(societe.fuseau_horaire).local),
    );
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_A,
        societe_id: societe.id,
        raison_sociale: fr["9g1cap.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_A,
        societe_id: societe.id,
        client_id: CLIENT_A,
        agence_id: agence.id,
        libelle: fr["9g1cap.e2e.lieu"],
        adresse: { rue: fr["9g1cap.e2e.rue"] },
        commune: null,
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "agence_id", "client_id", "site_id", "type",
          "priorite", "statut", "mode_valorisation", "devise_code",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'a_planifier', 'temps_passe', 'XPF', now())`,
      INTERVENTION_A,
      societe.id,
      agence.id,
      CLIENT_A,
      SITE_A,
    );

    await client.client.create({
      data: {
        id: CLIENT_INACTIF,
        societe_id: societe.id,
        raison_sociale: fr["9g1cap.e2e.client_inactif"],
        actif: false,
      },
    });

    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societe.id,
        code: `9G1CAP${FAMILLE.slice(0, 6)}`,
        libelle: fr["9g1cap.e2e.famille"],
      },
    });

    await client.importLot.create({
      data: {
        id: LOT_IMPORT,
        societe_id: societe.id,
        type_import: "clients",
        version_modele: 1,
        utilisateur_id: utilisateur.id,
        nom_fichier: "9g1cap-lot-vide.xlsx",
        statut: "controle",
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "agence_id", "client_id", "site_id",
          "technicien_id", "type", "priorite", "statut", "date_planifiee",
          "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'en_cours', $7::date, 'temps_passe',
               'XPF', now())`,
      INTERVENTION_TERRAIN,
      societe.id,
      agence.id,
      CLIENT_A,
      SITE_A,
      utilisateur.id,
      aujourdhui,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_A, INTERVENTION_TERRAIN],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      [INTERVENTION_A, INTERVENTION_TERRAIN],
    );
    await client.importLot.deleteMany({ where: { id: LOT_IMPORT } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
    await client.site.deleteMany({ where: { id: SITE_A } });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_A, CLIENT_INACTIF] } },
    });
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
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: false,
  });
}

for (const largeur of [1280, 375] as const) {
  // POINT 1 — le filtre des Priorités du tableau de bord.
  test(`tableau de bord — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/tableau-de-bord");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "tableau-de-bord-priorites", largeur);
  });

  // POINTS 2 ET 5 — la vue Jour (liste téléphone) et la vue Mois.
  test(`planning jour — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/planning?vue=jour");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "planning-jour", largeur);
  });

  test(`planning mois — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/planning?vue=mois");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "planning-mois", largeur);
  });

  // POINT 3 — le message d'échec de la SIGNATURE, propre à son bloc.
  test(`terrain signature échec — ${PHASE} — ${largeur}px`, async ({
    page,
  }) => {
    await page.route(
      `**/api/terrain/${INTERVENTION_TERRAIN}/signature`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, motif: "terrain.signature.refus" }),
        }),
    );
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/terrain/${INTERVENTION_TERRAIN}`);
    await expect(page.locator("main")).toBeVisible();
    await page
      .getByRole("button", { name: fr["terrain.signature.option_absent"] })
      .click();
    const motif = page.getByLabel(fr["terrain.signature.motif_libelle"]);
    await motif.fill("9G1CAP — motif de l'épreuve");
    await motif.blur();
    await page.waitForTimeout(500);
    await capturer(page, "terrain-signature-echec", largeur);
  });

  // POINT 4 — « Appliquer l'import » absent sur un lot sans ligne à appliquer.
  test(`import vide — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/imports/${LOT_IMPORT}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "imports-lot-vide", largeur);
  });

  // POINT 6 — la fiche client (onglet Interventions, tuile Sites).
  test(`fiche client — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/clients/${CLIENT_A}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-client", largeur);
  });

  // POINT 7 — la carte de site sans commune, avec adresse.
  test(`liste des sites — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(
      `/sites?q=${encodeURIComponent(fr["9g1cap.e2e.lieu"])}&sans_equipement=1`,
    );
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "sites-adresse", largeur);
  });

  // POINT 8 — « Nouveau lieu » sur un client inactif.
  test(`nouveau lieu, client inactif — ${PHASE} — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/sites/nouveau?client=${CLIENT_INACTIF}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "sites-nouveau-client-inactif", largeur);
  });

  // POINT 9 — les familles « à déterminer ».
  test(`familles à déterminer — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/vgp/a-determiner");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "vgp-a-determiner", largeur);
  });
}
