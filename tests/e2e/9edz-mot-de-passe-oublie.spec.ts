import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 7 (D188) — /mot-de-passe-oublie
 * AU GABARIT DE LA MAQUETTE DU 28/09.
 *
 * Aucune fixture : page synchrone, sans session ni base.
 */

const dictionnaire = fr as Record<string, string>;

test("les deux paragraphes s'affichent", async ({ page }) => {
  await page.goto("/mot-de-passe-oublie");
  await expect(
    page.getByText(dictionnaire["mot_de_passe_oublie.texte"]),
  ).toBeVisible();
  await expect(
    page.getByText(dictionnaire["mot_de_passe_oublie.texte_envoi"]),
  ).toBeVisible();
});

test("le lien de retour est PREMIER dans l'ordre du DOM, et mène à /connexion", async ({
  page,
}) => {
  await page.goto("/mot-de-passe-oublie");
  const retour = page.getByRole("link", {
    name: dictionnaire["mot_de_passe_oublie.retour_fleche"],
  });
  const titre = page.getByRole("heading", {
    name: dictionnaire["mot_de_passe_oublie.titre"],
  });
  await expect(retour).toBeVisible();
  await expect(titre).toBeVisible();

  const ordre = await page.evaluate(
    ([retourTexte, titreTexte]) => {
      const tous = Array.from(document.querySelectorAll("a, h1"));
      const r = tous.find((n) => n.textContent === retourTexte);
      const h = tous.find((n) => n.textContent === titreTexte);
      if (r === undefined || h === undefined) return null;
      return (
        (r.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    },
    [
      dictionnaire["mot_de_passe_oublie.retour_fleche"],
      dictionnaire["mot_de_passe_oublie.titre"],
    ],
  );
  expect(ordre).toBe(true);

  await retour.click();
  await expect(page).toHaveURL(/\/connexion$/);
});

test("aucun champ de saisie, aucun formulaire sur la page", async ({
  page,
}) => {
  await page.goto("/mot-de-passe-oublie");
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("input")).toHaveCount(0);
});

test("à 375 px de large, le document ne dépasse pas la fenêtre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/mot-de-passe-oublie");
  const largeur = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(largeur).toBeLessThanOrEqual(375);
});
