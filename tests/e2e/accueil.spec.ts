import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/*
 * Ticket L0-01 — la page d'accueil affiche le nom du produit, servie par un
 * build de production. Le texte attendu vient du dictionnaire (L0-11) : un
 * scénario de bout en bout qui recopie la chaîne la sort du dictionnaire aussi
 * sûrement qu'un composant le ferait.
 */
test("la page d'accueil affiche le titre du dictionnaire", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    fr["accueil.titre"],
  );
  await expect(page).toHaveTitle(fr["app.nom"]);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
