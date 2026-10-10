import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EFA-REPRISE-9EF-2, Y19 — aucune des deux fiches ne déborde en largeur,
 * à 1280 ni à 375 px.
 *
 * Mesuré par le pilote (captures de 9EF-TP-UX4-2-FICHES-1) : la fiche site
 * débordait à 742 px de large sous une fenêtre de 375 (la grille
 * `1fr_300px` de l'onglet « Aperçu » ne laissait pas sa colonne de gauche
 * rétrécir sous le `minWidth` posé par `Tableau`), et la fiche client à
 * 380 px (la grille des sites de l'onglet « Aperçu » imposait
 * `repeat(2, 1fr)` par un `style` en ligne, qui prime toujours sur la
 * classe Tailwind `max-[900px]:grid-cols-1` censée la remplacer).
 *
 * Lecture SEULE sur la scène de démonstration déjà semée (I9) : aucune
 * donnée n'est forgée par cette épreuve. Le client et le site choisis sont
 * ceux qui exercent le plus ces deux grilles — au moins deux sites pour le
 * premier, au moins une machine ET une intervention pour le second (sans
 * quoi `Tableau` ne se rend pas et la grille n'est jamais mise sous
 * tension).
 */

const FENETRE_TELEPHONE = { width: 375, height: 812 };
const FENETRE_BUREAU = { width: 1280, height: 900 };

let clientAvecPlusieursSites: string;
let siteAvecMachineEtIntervention: string;

test.beforeAll(async () => {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await admin.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    const sitesParClient = await admin.site.groupBy({
      by: ["client_id"],
      where: { societe_id: societe.id },
      _count: { _all: true },
      having: { client_id: { _count: { gte: 2 } } },
    });
    expect(sitesParClient.length).toBeGreaterThan(0);
    clientAvecPlusieursSites = sitesParClient[0].client_id;

    const siteAvecMachine = await admin.machine.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        site: { interventions: { some: {} } },
      },
      select: { site_id: true },
    });
    siteAvecMachineEtIntervention = siteAvecMachine.site_id;
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const fenetre of [FENETRE_BUREAU, FENETRE_TELEPHONE]) {
  test(`fiche client, aperçu — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/clients/${clientAvecPlusieursSites}`);
    await expect(page.locator("main")).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test(`fiche site, aperçu — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/sites/${siteAvecMachineEtIntervention}`);
    await expect(page.locator("main")).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
