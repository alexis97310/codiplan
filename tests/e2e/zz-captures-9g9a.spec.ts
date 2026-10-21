import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G9A-CONTENEURS-ET-TUILES — AVANT/APRÈS, même recette que
 * `captures-9eq-fiche-onglets.spec.ts` : rien n'est écrit sans
 * `CAPTURES_9G9A` (le dossier), `CAPTURES_9G9A_PHASE` choisit entre `avant`
 * et `apres` (par défaut `apres`). Cinq écrans, deux largeurs — Paramètres,
 * Nouveau client, la fiche intervention (la première ligne du registre,
 * jamais un identifiant fixe), le tableau de bord ADV, Indicateurs.
 *
 * AVANT se joue sur un `git worktree` planté sur le commit `013857b7` (le
 * tout premier de ce lot) — même recette que la note de
 * `captures-avant-apres-e2e` : `tests/e2e/` et `tests/e2e/setup/` copiés
 * sur l'ancien code, lancé avec `CI=1`, jamais `reuseExistingServer`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G9A ?? "";
const PHASE = process.env.CAPTURES_9G9A_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${PHASE}-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`paramètres — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/parametres");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "parametres", largeur);
  });

  test(`nouveau client — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "clients-nouveau", largeur);
  });

  test(`fiche intervention — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/interventions");
    await expect(page.locator("main")).toBeVisible();
    // LA PREMIÈRE LIGNE DU REGISTRE, jamais un identifiant fixe (la scène de
    // démonstration n'en promet aucun) — le même principe que les captures
    // qui visent `/interventions/abc` pour un écran d'erreur.
    await page.locator('a[href^="/interventions/"]').first().click();
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-intervention", largeur);
  });

  test(`tableau de bord ADV — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "tableau-de-bord-adv", largeur);
  });

  test(`indicateurs — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/indicateurs");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "indicateurs", largeur);
  });
}
