import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 85-PARC-SITES (25/09/2026) — même recette que
 * `captures-parcours-1.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * `/parc`, filtre Site OUVERT, et `/sites`, à 1280 px — les deux écrans
 * touchés par ce ticket.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER = process.env.CAPTURES_PARC_SITES ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("capture — /parc, le filtre Site avec sa valeur composée", async ({
  page,
}) => {
  // Le menu déroulant NATIF du navigateur ne se capture pas — Chromium bloque
  // la capture tant qu'il reste ouvert (mesuré : `page.screenshot` expire).
  // La capture montre donc la valeur CHOISIE, « Client — Site », ce que
  // l'ouverture aurait montré option par option.
  await page.goto("/parc");
  const select = page.locator('select[name="site"]');
  await expect(select).toBeVisible();
  const options = select.locator("option:not([value=''])");
  const premiere = await options.first().getAttribute("value");
  await select.selectOption(premiere ?? "");
  await capturer(page, "filtre-site-valeur-composee");
});

test("capture — /sites, les cartes titrées par leur client", async ({
  page,
}) => {
  await page.goto("/sites");
  await expect(page.locator("article").first()).toBeVisible();
  await capturer(page, "cartes-titrees-par-client");
});
