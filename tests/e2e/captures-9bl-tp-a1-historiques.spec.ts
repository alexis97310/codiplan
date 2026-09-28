import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BL-TP-A1-HISTORIQUES-CLIENT-SITE (28/09/2026) — même
 * recette que `captures-gr12-sites.spec.ts` : rien n'est écrit sans une
 * variable d'environnement qui nomme le dossier, pour que l'exécution
 * ordinaire de `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * Trois écrans, à 1280 et 375 px : la fiche site (l'historique, les tuiles
 * cliquables), la fiche client (même chose), et `/interventions/nouvelle?client=`
 * (site présélectionné — vide sur le code d'AVANT, où le paramètre n'existait
 * pas).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9BL_TP_A1 ?? "";

const CLIENT_CAPTURE = "cccccccc-0000-7000-8000-00000009b1a1";
const SITE_CAPTURE = "cccccccc-0000-7000-8000-00000009b1a2";
const ID_OUVERTE_P1 = "cccccccc-0000-7000-8000-00000009b1a3";
const ID_OUVERTE_P4 = "cccccccc-0000-7000-8000-00000009b1a4";
const ID_DATEE_RECENTE = "cccccccc-0000-7000-8000-00000009b1a5";
const ID_DATEE_ANCIENNE = "cccccccc-0000-7000-8000-00000009b1a6";
const TOUTES_LES_INTERVENTIONS = [
  ID_OUVERTE_P1,
  ID_OUVERTE_P4,
  ID_DATEE_RECENTE,
  ID_DATEE_ANCIENNE,
];

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_CAPTURE } });
    await client.client.deleteMany({ where: { id: CLIENT_CAPTURE } });
    await client.client.create({
      data: {
        id: CLIENT_CAPTURE,
        societe_id: societe.id,
        raison_sociale: "CAP9BL- Client de démonstration",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CAPTURE,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        agence_id: agence.id,
        libelle: "CAP9BL- Site de démonstration",
        temps_trajet_min: 10,
        actif: true,
      },
    });
    await client.intervention.create({
      data: {
        id: ID_OUVERTE_P1,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        site_id: SITE_CAPTURE,
        agence_id: agence.id,
        type: "curatif",
        priorite: "p1",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    await client.intervention.create({
      data: {
        id: ID_OUVERTE_P4,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        site_id: SITE_CAPTURE,
        agence_id: agence.id,
        type: "preventif_hors_contrat",
        priorite: "p4",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    await client.intervention.create({
      data: {
        id: ID_DATEE_RECENTE,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        site_id: SITE_CAPTURE,
        agence_id: agence.id,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: new Date(Date.UTC(2026, 0, 15)),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    await client.intervention.create({
      data: {
        id: ID_DATEE_ANCIENNE,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        site_id: SITE_CAPTURE,
        agence_id: agence.id,
        type: "controle_reglementaire",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: new Date(Date.UTC(2020, 0, 15)),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
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
    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_CAPTURE } });
    await client.client.deleteMany({ where: { id: CLIENT_CAPTURE } });
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
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — fiche site`, async ({ page }) => {
      await page.goto(`/sites/${SITE_CAPTURE}`);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "fiche-site", largeur);
    });

    test(`capture — fiche client`, async ({ page }) => {
      await page.goto(`/clients/${CLIENT_CAPTURE}`);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "fiche-client", largeur);
    });

    test(`capture — /interventions/nouvelle?client=`, async ({ page }) => {
      await page.goto(`/interventions/nouvelle?client=${CLIENT_CAPTURE}`);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "nouvelle-intervention-client", largeur);
    });
  });
}
