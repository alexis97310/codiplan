import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9I00-INSTALLATION-APPLICATION, point 3 — L'ÉTAPE D'INSTALLATION APRÈS LE
 * PREMIER ACCÈS.
 *
 * `COMPTE_TECHNICIEN_EPREUVE` a déjà choisi son mot de passe AVANT ce fichier
 * (`tests/e2e/setup/global.ts`, `beforeAll`) : rejouer `/premier-acces` pour
 * de vrai exigerait sa PROPRE scène (une identité, une habilitation, un
 * jeton émis) — voir la passation pour ce point ouvert. Ce fichier éprouve
 * donc, en lecture seule sur le compte partagé :
 *   1. qu'une connexion ORDINAIRE (jamais passée par `/premier-acces`) ne
 *      voit PAS l'étape — elle n'a pas de sens pour un compte qui a déjà
 *      choisi son mot de passe il y a longtemps ;
 *   2. que `/installation` elle-même, une fois atteinte, rend les mêmes
 *      trois cas que le bouton de la journée, et que « Plus tard » mène à
 *      la destination reçue ;
 *   3. qu'elle exige une session, comme `/arrivee`.
 */
test("une connexion ordinaire ne passe jamais par l'étape d'installation", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
});

test("« Plus tard » mène à la destination reçue, jamais recalculée", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);

  // La session est désormais ouverte — l'écran ATTEINT depuis `/arrivee`
  // (jamais rejoué ici, voir l'en-tête) pour éprouver son rendu et son lien.
  await page.goto("/installation?suite=/terrain");
  await expect(
    page.getByRole("heading", { name: fr["pwa.etape.titre"] }),
  ).toBeVisible();
  await page.getByRole("link", { name: fr["pwa.etape.plus_tard"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
});

test("exige une session, comme /arrivee", async ({ page }) => {
  await page.goto("/installation?suite=/terrain");
  await expect(page).toHaveURL(/\/connexion/);
});
