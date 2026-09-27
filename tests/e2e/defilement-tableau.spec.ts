import { expect, test } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * L'INDICE DE DÉFILEMENT DU TABLEAU PARTAGÉ (9AS-CG3, 28/09/2026).
 *
 * `/vgp` rend `Tableau` (`components/ui/tableau.tsx`) même vide
 * (`LignePleine`) : le conteneur existe quelle que soit la scène, et cette
 * épreuve LECTURE SEULE ne crée aucune donnée.
 *
 * `mode: "serial"` — même convention que les autres épreuves de captures/
 * défilement de ce dépôt (`tests/e2e/planning-largeur-et-carte.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

test("à 375px, le registre déborde et porte l'indice de droite, puis l'indice de gauche après défilement complet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/vgp");

  const conteneur = page.locator(".overflow-x-auto").first();
  await expect(conteneur).toBeVisible();

  const { scrollWidth, clientWidth } = await conteneur.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  await expect(conteneur).toHaveAttribute("data-defile-droite", "");

  await conteneur.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  await expect(conteneur).toHaveAttribute("data-defile-gauche", "");
  await expect(conteneur).not.toHaveAttribute("data-defile-droite", "");
});

test("à 1280px, l'indice de droite n'est présent que si le registre déborde réellement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/vgp");

  const conteneur = page.locator(".overflow-x-auto").first();
  await expect(conteneur).toBeVisible();

  const { scrollWidth, clientWidth } = await conteneur.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));

  if (scrollWidth > clientWidth) {
    await expect(conteneur).toHaveAttribute("data-defile-droite", "");
  } else {
    await expect(conteneur).not.toHaveAttribute("data-defile-droite", "");
  }
});
