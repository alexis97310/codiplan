import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9EWA-RENDU-VISUEL-1, point 3 — mini-barres de défilement verticales
 * constatées en production (Windows, Chrome) sur `components/ui/onglets.tsx`.
 *
 * `overflow-x-auto` SEUL force, par la cascade CSS2.1, `overflow-y` à
 * `auto` quand il valait `visible` — la place réservée au défilement
 * horizontal grignote alors la hauteur disponible et déclenche un
 * défilement vertical d'un pixel. `overflow-y-hidden` l'annule sans
 * toucher au défilement horizontal, toujours mesuré par
 * `planning-largeur-et-carte.spec.ts` et consorts.
 */
test("à 1280px, la nav des onglets de /demandes ne déborde jamais verticalement", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");

  const nav = page.getByRole("navigation", { name: fr["demande.titre"] });
  await expect(nav).toBeVisible();

  const { overflowX, overflowY } = await nav.evaluate((element) => {
    const style = getComputedStyle(element);
    return { overflowX: style.overflowX, overflowY: style.overflowY };
  });
  // `overflow-y: hidden` — jamais `auto` — garantit qu'AUCUNE barre verticale
  // ne peut apparaître, quel que soit le débordement intrinsèque du
  // gabarit (`-mb-px` sur chaque onglet) ; `overflow-x` garde `auto`, le
  // défilement horizontal mesuré par les épreuves voisines.
  expect(overflowY).toBe("hidden");
  expect(overflowX).toBe("auto");
});
