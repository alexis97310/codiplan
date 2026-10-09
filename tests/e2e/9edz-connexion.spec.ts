import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 5 (D188) — /connexion AU GABARIT
 * DE LA MAQUETTE DU 28/09.
 *
 * Aucune fixture : cette page ne lit que la session (absente ici) et le
 * paramètre `motif` de l'URL — jamais la base.
 */

const dictionnaire = fr as Record<string, string>;

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

test("la page rend le titre « Se connecter »", async ({ page }) => {
  await page.goto("/connexion");
  await expect(
    page.getByRole("heading", { name: dictionnaire["connexion.titre_page"] }),
  ).toBeVisible();
});

test("le bouton « Afficher » bascule le type du champ, sans soumettre, et le libellé reste trouvable", async ({
  page,
}) => {
  await page.goto("/connexion");
  const champ = page.getByLabel(dictionnaire["connexion.mot_de_passe"]);
  await expect(champ).toHaveCount(1);
  await expect(champ).toHaveAttribute("type", "password");

  const bouton = page.getByRole("button", {
    name: dictionnaire["connexion.mot_de_passe.afficher"],
  });
  await bouton.click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(champ).toHaveAttribute("type", "text");
  await expect(
    page.getByRole("button", {
      name: dictionnaire["connexion.mot_de_passe.masquer"],
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel(dictionnaire["connexion.mot_de_passe"]),
  ).toHaveCount(1);
});

test("« Mot de passe oublié ? » précède « Se connecter » dans l'ordre du DOM, et mène à /mot-de-passe-oublie", async ({
  page,
}) => {
  await page.goto("/connexion");
  const lienOublie = page.getByRole("link", {
    name: dictionnaire["connexion.mot_de_passe_oublie"],
  });
  const boutonValider = page.getByRole("button", {
    name: dictionnaire["connexion.valider"],
  });
  await expect(lienOublie).toBeVisible();
  await expect(boutonValider).toBeVisible();

  const ordre = await page.evaluate(() => {
    const noeuds = Array.from(document.querySelectorAll("a, button"));
    const lien = noeuds.find((n) => n.tagName === "A");
    const bouton = noeuds.find(
      (n) => n.tagName === "BUTTON" && n.getAttribute("type") === "submit",
    );
    if (lien === undefined || bouton === undefined) return null;
    return (
      (lien.compareDocumentPosition(bouton) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
    );
  });
  expect(ordre).toBe(true);

  await lienOublie.click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
});

test("à 1280 px la colonne gauche est visible, à 375 px elle est masquée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/connexion");
  await expect(
    page.getByText(dictionnaire["connexion.cadre.titre"]),
  ).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(
    page.getByText(dictionnaire["connexion.cadre.titre"]),
  ).toBeHidden();
});

test("la marque n'apparaît qu'une seule fois (a[href=\"/\"])", async ({
  page,
}) => {
  await page.goto("/connexion");
  await expect(page.locator('a[href="/"]')).toHaveCount(1);
});

test("un mot de passe faux revient sur /connexion avec le refus, en ton refus", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(dictionnaire["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(dictionnaire["connexion.mot_de_passe"])
    .fill("un-mot-de-passe-faux");
  await page
    .getByRole("button", { name: dictionnaire["connexion.valider"] })
    .click();
  await expect(page).toHaveURL(/\/connexion\?motif=auth\.refus/);
  await expect(page.getByText(dictionnaire["auth.refus"])).toBeVisible();

  // Le mot de passe RÉEL fonctionne toujours (le formulaire reste utilisable).
  await page.getByLabel(dictionnaire["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(dictionnaire["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page
    .getByRole("button", { name: dictionnaire["connexion.valider"] })
    .click();
  await expect(page).not.toHaveURL(/\/connexion/);
});
