import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES AVANT/APRÈS de 9L49-TERRAIN-PROFIL-JETONS-EPURES — « Profil »
 * et son sous-écran « Changer mon mot de passe », à 375 px, avant puis après
 * leur migration vers les jetons de la fiche terrain « épurée » (décision
 * d'Alexis du 13/11/2026).
 *
 * Même recette que `captures-9l42-terrain-entete-profil-pastille.spec.ts` :
 * `MOMENT_CAPTURE` choisit le préfixe, lancé une fois sur le code d'avant,
 * une fois après son commit. Aucune assertion sur l'HABILLAGE neuf (jetons,
 * composants) — seuls les deux titres, déjà présents avant ce lot, pour que
 * ce même fichier tourne sans modification sur l'ancien code.
 */
test.describe.configure({ mode: "serial" });

const MOMENT = process.env.MOMENT_CAPTURE === "apres" ? "apres" : "avant";

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L49-TERRAIN-PROFIL-JETONS-EPURES/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${MOMENT}-${nom}.png`) });
}

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("375 px — « Profil »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await connecterLeTechnicien(page);
  await page.goto("/terrain/profil");
  await expect(
    page.getByRole("heading", { name: fr["terrain.profil.titre"] }),
  ).toBeVisible();
  await capturer(page, "profil");
});

test("375 px — « Changer mon mot de passe »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await connecterLeTechnicien(page);
  await page.goto("/terrain/profil/mot-de-passe");
  await expect(
    page.getByRole("heading", { name: fr["terrain.mot_de_passe.titre"] }),
  ).toBeVisible();
  await capturer(page, "mot-de-passe");
});
