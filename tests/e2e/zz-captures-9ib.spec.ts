import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_MULTI_SOCIETE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9IB-ARRIVEE-HORS-BACK-OFFICE/captures",
);

/**
 * CAPTURES AVANT/APRÈS DE `/arrivee` (9IB-ARRIVEE-HORS-BACK-OFFICE).
 *
 * Spec jumelle — recette éprouvée au lot VGP-2 (22/09/2026) : lancée une
 * première fois sur un worktree posé à `8384ace75` (le dernier commit avant
 * ce ticket, `/arrivee` dans `(back-office)`), les captures AVANT copiées
 * sous `*-avant-*.png` ; relancée ICI, sur le code APRÈS le déménagement vers
 * `(apres-session)`, pour produire `*-apres-*.png`. Même compte
 * (`COMPTE_MULTI_SOCIETE_EPREUVE`), même geste, deux largeurs de référence.
 */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("/arrivee — capture APRÈS aux deux largeurs", async ({ page }) => {
  await page.goto("/connexion");
  await page
    .getByLabel(fr["connexion.email"])
    .fill(COMPTE_MULTI_SOCIETE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
  await expect(
    page.getByRole("heading", { name: fr["arrivee.titre"] }),
  ).toBeVisible();

  await capturer(page, "arrivee-apres", 1280);
  await capturer(page, "arrivee-apres", 375);
});
