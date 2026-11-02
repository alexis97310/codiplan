import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9IC-CORRECTIFS-COURTS, point 5 — LA VRAIE PAGE, PAS SA PROPRE COPIE
 * (réserve du solde 596 sur 9I5-ECRANS-INCOMPLETS-LE-DISENT).
 *
 * `tests/unit/*\/9i5-ce-qui-manque.test.tsx` rendaient leur PROPRE `<p>`/
 * `<Page>` avec la même clé qu'ils prétendaient éprouver — tautologique :
 * ils passaient encore même si la VRAIE page perdait la phrase. Ce fichier
 * ouvre les cinq écrans réels et lit la phrase par sa clé, dans le DOM
 * qu'ils rendent eux-mêmes — jamais une copie.
 */
async function connecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("Ma journée — la vraie page affiche terrain.sous_titre_manquant", async ({
  page,
}) => {
  await connecterTechnicien(page);
  await expect(page.getByText(fr["terrain.sous_titre_manquant"])).toBeVisible();
});

test("Tableau de bord — la vraie page affiche tableau_de_bord.sous_titre_manquant", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
  await expect(
    page.getByText(fr["tableau_de_bord.sous_titre_manquant"]),
  ).toBeVisible();
});

test("VGP — la vraie page affiche vgp.sous_titre_manquant", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/vgp");
  await expect(page.getByText(fr["vgp.sous_titre_manquant"])).toBeVisible();
});

test("Données à compléter — la vraie page affiche les trois clés et les mots composés", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  // LA CHAÎNE EST INLINE, JAMAIS DANS UN `const` INTERMÉDIAIRE — le gardien
  // L0-11 (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) résout un
  // `const` avec un contexte d'accesseurs VIDE (`constantesLitterales`,
  // `tests/unit/outils/rendu-visible.ts`), pour éviter une dépendance
  // circulaire : un `motDansUnePhrase("site", true)` niché dans ce
  // `const`-là n'y est alors plus reconnu comme une lecture du dictionnaire,
  // et ses arguments littéraux sont signalés comme écrits en dur. Une
  // expression passée EN DIRECT à `getByText` ne traverse jamais ce
  // contexte vide.
  await expect(
    page.getByText(
      `${fr["donnees_a_completer.sous_titre_manquant_1"]} ${motDansUnePhrase("site", true)} ${fr["donnees_a_completer.sous_titre_manquant_2"]} ${motDansUnePhrase("agence", true)} ${fr["donnees_a_completer.sous_titre_manquant_3"]}`,
    ),
  ).toBeVisible();
});

test("Fiche machine — la vraie page affiche machine.fiche.sous_titre_manquant, dans le sous-titre de Page", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parc");
  const ficheComplete = page
    .getByRole("link", { name: fr["parc.fiche_complete"] })
    .first();
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  await expect(
    page.getByText(fr["machine.fiche.sous_titre_manquant"]),
  ).toBeVisible();
});
