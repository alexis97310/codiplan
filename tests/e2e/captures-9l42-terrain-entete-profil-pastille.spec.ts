import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES AVANT/APRÈS de 9L42-TERRAIN-ENTETE-PROFIL-PASTILLE — « Ma
 * journée » et « Profil », à 375 px, avant puis après le déplacement
 * d'« Installer l'application » et l'arrivée de la pastille réseau.
 *
 * Lancé deux fois (recette « captures AVANT/APRÈS » : la session de
 * mémoire), `MOMENT_CAPTURE` choisit le préfixe des fichiers produits.
 * Aucune assertion sur le CONTENU neuf de ce lot (pastille, absence
 * d'« Installer ») — les deux titres visés existaient déjà avant ce lot,
 * pour que ce même fichier tourne sans modification sur l'ancien code.
 */
test.describe.configure({ mode: "serial" });

const MOMENT = process.env.MOMENT_CAPTURE === "apres" ? "apres" : "avant";

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L42-TERRAIN-ENTETE-PROFIL-PASTILLE/captures",
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

test("375 px — « Ma journée »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await connecterLeTechnicien(page);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
  await capturer(page, "ma-journee");
});

test("375 px — « Profil »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await connecterLeTechnicien(page);
  await page.goto("/terrain/profil");
  await expect(
    page.getByRole("heading", { name: fr["terrain.profil.titre"] }),
  ).toBeVisible();
  await capturer(page, "profil");
});
