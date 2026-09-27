import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9AT-CG6-TRAJETS-ILES — même recette que
 * `captures-9aq-cg1-retour-parametres.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré. LECTURE SEULE : aucune
 * scène propre, l'écran se lit tel que le semis le rend déjà.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AT ?? "";
const FASE = process.env.CAPTURES_9AT_FASE ?? "";

for (const largeur of [1280, 375] as const) {
  test(`capture — trajets à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/trajets");
    await expect(page.locator("main")).toBeVisible();
    if (DOSSIER === "" || FASE === "") return;
    mkdirSync(DOSSIER, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER, `trajets-${FASE}-${largeur}.png`),
      fullPage: true,
    });
  });
}
