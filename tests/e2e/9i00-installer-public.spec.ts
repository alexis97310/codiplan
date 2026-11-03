import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * 9I00-INSTALLATION-APPLICATION, point 4 — `/installer` S'OUVRE SANS SESSION
 * ET SANS AUCUNE DONNÉE DE SOCIÉTÉ.
 *
 * Simule le téléphone par le user-agent plutôt que par `beforeinstall-
 * prompt` (jamais disponible sous Playwright) — même critère que
 * `detecterPlateforme` (`lib/pwa/installation.ts`), lu côté serveur sur
 * l'en-tête de la requête.
 */
test("un iPhone voit les deux étapes Safari, et un lien vers la connexion", async ({
  browser,
}) => {
  const contexte = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  });
  const page = await contexte.newPage();
  await page.goto("/installer");

  await expect(
    page.getByRole("heading", { name: fr["pwa.page_installer.titre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["pwa.page_installer.ios.titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["pwa.installer.ios.etape1"])).toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["pwa.page_installer.connexion"] }),
  ).toHaveAttribute("href", "/connexion");

  // AUCUNE DONNÉE DE SOCIÉTÉ — la page ne nomme ni raison sociale, ni devise,
  // ni aucun des deux mots du vocabulaire imposé (agence, site).
  const texte = await page.locator("main").innerText();
  expect(texte.toLowerCase()).not.toContain("agence");
  expect(texte.toLowerCase()).not.toContain("site");

  await contexte.close();
});

test("un Android voit les deux étapes Chrome", async ({ browser }) => {
  const contexte = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  });
  const page = await contexte.newPage();
  await page.goto("/installer");

  await expect(
    page.getByRole("heading", {
      name: fr["pwa.page_installer.android.titre"],
    }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["pwa.page_installer.android.etape1"]),
  ).toBeVisible();

  await contexte.close();
});

test("un navigateur de bureau voit le message de repli", async ({ page }) => {
  await page.goto("/installer");
  await expect(page.getByText(fr["pwa.installer.autre"])).toBeVisible();
});
