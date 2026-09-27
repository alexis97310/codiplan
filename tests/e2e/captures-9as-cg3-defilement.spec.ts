import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9AS-CG3-DEFILEMENT — même recette que
 * `captures-9aq-cg1-retour-parametres.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`CAPTURES_9AS_FASE=avant`), une fois sur le code
 * livré (`CAPTURES_9AS_FASE=apres`). LECTURE SEULE pour `/vgp` : le registre
 * se lit tel que le semis le rend déjà. Pour `/clients/[id]`, la fiche vient
 * du semis (aucune scène propre).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AS ?? "";
const FASE = process.env.CAPTURES_9AS_FASE ?? "";

async function capturer(page: Page, ecran: string, largeur: number) {
  if (DOSSIER === "" || FASE === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${FASE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — vgp à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/vgp");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "vgp", largeur);

    if (largeur === 375) {
      const conteneur = page.locator(".overflow-x-auto").first();
      if ((await conteneur.count()) > 0) {
        await conteneur.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        await capturer(page, "vgp-defile", largeur);
      }
    }
  });

  test(`capture — fiche client à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/clients");
    await expect(page.locator("main")).toBeVisible();
    // Exclut `/clients/nouveau` — un lien de création, présent AVANT les
    // lignes du tableau, qui ne porte aucun `Tableau` à photographier.
    const premierLien = page
      .locator("main a[href^='/clients/']:not([href='/clients/nouveau'])")
      .first();
    await premierLien.click();
    await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-client", largeur);
  });
}
