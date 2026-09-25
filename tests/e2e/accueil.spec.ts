import { expect, test } from "@playwright/test";

/*
 * Ticket 99-ACCUEIL-1 — la racine du site ne s'affiche jamais : elle
 * redirige. Sans session, `/` mène à `/connexion`, qui décide seule de la
 * suite pour un compte déjà identifié (Better Auth, `lib/auth/session.ts`).
 */
test("sans session, la racine du site mène à la connexion", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
