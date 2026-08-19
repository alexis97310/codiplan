import { expect, test } from "@playwright/test";

// Ticket L0-01 — la page d'accueil affiche « CODIPLAN », servie par un build de production.
test("la page d'accueil affiche CODIPLAN", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CODIPLAN");
  await expect(page).toHaveTitle("CODIPLAN");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
