import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EA-TP-UX3-1-REGISTRE-2 — même recette que
 * `captures-aa4-registre-filtre.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le ticket, une fois sur le code livré. Les captures
 * s'appuient sur les DONNÉES DE DÉMONSTRATION du semis (jamais une scène à
 * soi) : ce ticket ne change aucune règle de gestion ni aucune donnée, et le
 * même semis existe des deux côtés de la comparaison.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EA2 ?? "";

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

const ONGLETS = [
  "a_planifier",
  "aujourdhui",
  "en_retard",
  "en_cours",
  "bloquees",
  "a_controler",
  "toutes",
] as const;

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    for (const vue of ONGLETS) {
      test(`capture — l'onglet « ${vue} », à ${largeur}px`, async ({
        page,
      }) => {
        await page.goto(`/interventions?vue=${vue}`);
        await expect(page.locator("main")).toBeVisible();
        await capturer(page, vue.replaceAll("_", "-"), largeur);
      });
    }

    test(`capture — densité « Compact », à ${largeur}px`, async ({ page }) => {
      await page.goto("/interventions?vue=toutes&densite=compact");
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "compact", largeur);
    });
  });
}

// SÉLECTION ET « POSER » — à 1280 px seulement (actions réservées au
// bureau, ≥ 901 px, choix du pilote C5).
test.describe("bureau — sélection et « Poser »", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — une sélection active sur « Aujourd'hui »", async ({
    page,
  }) => {
    await page.goto("/interventions?vue=aujourdhui");
    const cases = page.locator('tbody input[type="checkbox"]');
    const total = await cases.count();
    if (total > 0) {
      await cases.first().check();
      await expect(page.getByRole("status")).toBeVisible();
    }
    await capturer(page, "selection-aujourdhui", 1280);
  });

  test("capture — la fenêtre ouverte par « Poser »", async ({ page }) => {
    await page.goto("/interventions?vue=a_planifier");
    const boutons = page.locator("tbody button", { hasText: /./ });
    const total = await boutons.count();
    if (total > 0) {
      await boutons.first().click();
      await expect(page.locator("[data-fenetre-pose]").first()).toBeVisible();
    }
    await capturer(page, "fenetre-poser", 1280);
  });
});
