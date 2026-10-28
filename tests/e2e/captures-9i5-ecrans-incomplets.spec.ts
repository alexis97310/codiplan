import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9I5-ECRANS-INCOMPLETS-LE-DISENT — AVANT/APRÈS.
 *
 * Rien n'est écrit sans `CAPTURES_9I5=<dossier>` — même recette que
 * `captures-9eg1-tableau-de-bord.spec.ts`. Lancé une fois sur le code
 * d'avant ce lot (rouge attendu : pas de phrase), une fois après (vert).
 * Scène de DÉMONSTRATION (le semis), jamais une fixture propre.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I5 ?? "";
const LARGEURS = [1280, 375] as const;

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function connecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("tableau de bord", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
  for (const largeur of LARGEURS) {
    await capturer(page, "tableau-de-bord", largeur);
  }
});

test("VGP", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/vgp");
  for (const largeur of LARGEURS) {
    await capturer(page, "vgp", largeur);
  }
});

test("données à compléter", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  for (const largeur of LARGEURS) {
    await capturer(page, "donnees-a-completer", largeur);
  }
});

test("fiche machine", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parc");
  const ficheComplete = page
    .getByRole("link", { name: fr["parc.fiche_complete"] })
    .first();
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  for (const largeur of LARGEURS) {
    await capturer(page, "fiche-machine", largeur);
  }
});

test("Ma journée (terrain)", async ({ page }) => {
  await connecterTechnicien(page);
  for (const largeur of LARGEURS) {
    await capturer(page, "terrain-ma-journee", largeur);
  }
});
