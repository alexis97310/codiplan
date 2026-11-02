import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { SECTIONS_FEUILLE_DE_ROUTE } from "@/lib/feuille-de-route/contenu";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9IC5-FEUILLE-DE-ROUTE — LA PAGE PAR L'ÉCRAN, PAS SEULEMENT PAR LA MATRICE.
 *
 * `tests/unit/navigation/feuille-de-route-entree.test.ts` éprouve
 * `entreeVisible` en isolation, pour les dix rôles ; ce fichier éprouve la
 * CHAÎNE ENTIÈRE pour les deux rôles qui comptent : admin_societe voit le
 * lien et la page, ADV ne voit ni l'un ni l'autre, et l'adresse ouverte à la
 * main rend le refus nommé — jamais un renvoi silencieux.
 */

test("admin_societe voit le lien dans le menu, et la page qu'il ouvre", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/planning");

  const lien = page.getByRole("link", { name: fr["nav.feuille_de_route"] });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "/feuille-de-route");

  await lien.click();
  await expect(page).toHaveURL(/\/feuille-de-route$/);
  await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  // Au moins un titre de section du contenu est bien rendu — lu dans le
  // module de données, jamais recopié en dur (L0-11). Le titre d'une
  // section (`[1]`) plutôt que `[0]` : « En cours » (`[0]`) coïncide avec le
  // libellé de son propre statut, et le couple n'est alors plus unique à
  // l'écran.
  await expect(
    page.getByRole("heading", { name: SECTIONS_FEUILLE_DE_ROUTE[1].titre }),
  ).toBeVisible();
});

test("ADV ne voit pas le lien, et l'adresse ouverte à la main rend le refus", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/planning");
  await expect(
    page.getByRole("link", { name: fr["nav.feuille_de_route"] }),
  ).toBeHidden();
  await expect(page.getByText(fr["nav.feuille_de_route"])).toBeHidden();

  await page.goto("/feuille-de-route");
  await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();
});

test("ouvert sans session, l'adresse redirige vers la connexion", async ({
  page,
}) => {
  await page.goto("/feuille-de-route");
  await expect(page).toHaveURL(/\/connexion$/);
});
