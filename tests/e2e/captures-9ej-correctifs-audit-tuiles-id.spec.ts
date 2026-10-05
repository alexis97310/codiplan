import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EJ-CORRECTIFS-AUDIT-TUILES-ID — même recette que
 * `captures-9ap-gr17-kpi-vgp-sante.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * LECTURE SEULE — aucune scène propre : les quatre écrans se lisent tels que
 * le semis les rend déjà.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant ce lot (`git worktree add` sur `eb17c838`), une fois sur le
 * code livré. `/interventions/abc` est le cas qui change de FORME entre les
 * deux : une erreur 500 crue avant, la page introuvable après — ce fichier ne
 * suppose donc aucun statut HTTP particulier avant de capturer.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EJ ?? "";

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
  test(`capture — registre VGP à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/vgp");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "vgp", largeur);
  });

  test(`capture — tableau de bord à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "tableau-de-bord", largeur);
  });

  test(`capture — registre des interventions à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/interventions");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "interventions", largeur);
  });

  test(`capture — /interventions/abc à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/interventions/abc");
    await expect(page.locator("body")).toBeVisible();
    await capturer(page, "interventions-abc", largeur);
  });
}
