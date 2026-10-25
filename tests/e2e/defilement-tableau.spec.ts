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
 *
 * **Scopé à `[data-bloc="tableau-registre"]` depuis 9DP-TP-VGP2-REGISTRE** —
 * `Onglets` (`components/ui/onglets.tsx`), posé au-dessus du bandeau de KPI
 * par ce même lot, porte LUI AUSSI `overflow-x-auto` (un second conteneur
 * défilant, pour ses propres onglets sur un petit écran). `.first()` sans
 * portée retrouvait donc les onglets, jamais le tableau — même précaution
 * que `planning-largeur-et-carte.spec.ts` prend déjà avec
 * `[data-conteneur-tableau-semaine] .overflow-x-auto`.
 *
 * **901px, pas 375 (9G2A-REPRISE-9G2)** — depuis 9G2-TABLEAUX-EN-CARTES-375,
 * ce tableau se masque sous 901 px (`max-[900px]:hidden`, remplacé par une
 * liste de cartes) : à 375 px, `[data-bloc="tableau-registre"]
 * .overflow-x-auto` n'est plus VISIBLE, et ce que cette épreuve prouve — le
 * cycle complet de l'indice de défilement — n'a plus de sens à cette
 * largeur. 901 px est la largeur la plus étroite où le tableau existe
 * encore ; la colonne de navigation y laisse moins de place qu'au tableau
 * (minimum `890px`, `app/(back-office)/vgp/page.tsx`), donc le débordement
 * mesuré ci-dessous reste garanti.
 */
test.describe.configure({ mode: "serial" });

test("à 901px, le registre déborde et porte l'indice de droite, puis l'indice de gauche après défilement complet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 901, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/vgp");

  const conteneur = page.locator(
    '[data-bloc="tableau-registre"] .overflow-x-auto',
  );
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

  const conteneur = page.locator(
    '[data-bloc="tableau-registre"] .overflow-x-auto',
  );
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
