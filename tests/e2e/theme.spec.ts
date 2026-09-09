import { expect, test } from "@playwright/test";

/**
 * Ticket L0-09 — les variables de thème sont posées CÔTÉ SERVEUR.
 *
 * Le test lit d'abord le HTML brut, avant tout script : si les couleurs y sont
 * déjà, aucun clignotement n'est possible au chargement — ce qui compte sur un
 * réseau calédonien. Puis il vérifie que le document rendu les porte bien.
 *
 * Sans société active — le cas d'un visiteur non authentifié — c'est le thème
 * neutre CODIPLAN qui s'applique, et il se déclare comme tel.
 */
test("le thème part avec le HTML, et vaut le thème neutre sans session", async ({
  page,
  request,
}) => {
  const brut = await (await request.get("/")).text();
  expect(brut).toContain("--societe-primaire");
  expect(brut).toContain('data-origine-theme="defaut"');

  await page.goto("/");

  const corps = page.locator("body");
  await expect(corps).toHaveAttribute("data-origine-theme", "defaut");

  const primaire = await corps.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--societe-primaire").trim(),
  );
  expect(primaire).toMatch(/^#[0-9a-f]{6}$/);

  // L'encre du bandeau est CALCULÉE, jamais choisie : sur l'ardoise du thème
  // neutre, elle est claire.
  const encre = await corps.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--societe-primaire-encre")
      .trim(),
  );
  expect(encre).toBe("#ffffff");
});
