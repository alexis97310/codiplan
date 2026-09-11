import { expect, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./scene";

/**
 * OUVRIR UNE SESSION PAR L'ÉCRAN, jamais par un raccourci.
 *
 * Le scénario remplit le formulaire de connexion comme une personne le ferait :
 * c'est la seule façon d'éprouver la chaîne entière — la route, la
 * bibliothèque, les politiques de désignation, la pose du contexte cloisonné.
 * *Un harnais qui poserait un cookie fabriqué mesurerait le planning et rien
 * d'autre*, et le premier défaut de session lui échapperait — c'est exactement
 * ce qui est arrivé à L1-02c le 08/09/2026.
 */
export async function ouvrirUneSession(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Le compte de l'épreuve n'est habilité que sur UNE société : l'arrivée la
  // pose et ne propose aucun sélecteur.
  await expect(page).toHaveURL(/\/arrivee/);
}
