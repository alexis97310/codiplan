import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EG-TP-UX6-TABLEAU-DE-BORD-1 — APRÈS SEULEMENT.
 *
 * Rien n'est écrit sans `CAPTURES_9EG1=<dossier>` — même recette que
 * `captures-9af-gr14-charge-planning.spec.ts` : `pnpm test:e2e` ordinaire
 * n'écrit jamais de fichier. Scène de DÉMONSTRATION (le semis), jamais une
 * fixture propre : ces captures montrent l'écran, pas une mesure.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EG1 ?? "";

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

async function connecterRole(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

test("ADV — après", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
  await capturer(page, "apres-adv", 1280);
  await capturer(page, "apres-adv", 375);
});

test("responsable matériel — après", async ({ page }) => {
  await connecterRole(page, COMPTE_RM_EPREUVE);
  await page.goto("/tableau-de-bord");
  await capturer(page, "apres-responsable-materiel", 1280);
  await capturer(page, "apres-responsable-materiel", 375);
});

test("responsable SAV — après", async ({ page }) => {
  await connecterRole(page, COMPTE_RS_EPREUVE);
  await page.goto("/tableau-de-bord");
  await capturer(page, "apres-responsable-sav", 1280);
  await capturer(page, "apres-responsable-sav", 375);
});
