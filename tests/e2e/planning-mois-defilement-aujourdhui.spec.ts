import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9H4-FINITIONS-AVANT-AUDIT, POINT 6 — `DefilerVersAujourdhuiMois` REJOUE
 * APRÈS UNE NAVIGATION DOUCE (lien client, jamais un rechargement de page)
 * ENTRE DEUX MOIS, PAS SEULEMENT AU TOUT PREMIER MONTAGE.
 *
 * Son effet ne porte aucune dépendance (`[]`) : SANS `key` liée au mois
 * affiché, une navigation douce vers un autre mois puis le retour sur le
 * mois d'aujourd'hui ne remonte jamais ce composant — son effet ne rejoue
 * donc jamais, et le défilement HÉRITE de la position laissée par le mois
 * intermédiaire, jamais recalé sur aujourd'hui.
 *
 * ## Déterminisme SANS connaître le jour du mois à l'exécution
 *
 * Le jour « aujourd'hui » n'est pas maîtrisé par cette épreuve (horloge du
 * SERVEUR, jamais simulée ici). Plutôt que de deviner sa position, le
 * défilement correct du tout premier montage (`decalageCorrect`, mesuré une
 * fois, sur le mois d'aujourd'hui) dicte la position à imposer sur le mois
 * ÉLOIGNÉ avant de revenir : l'OPPOSÉ de `decalageCorrect` — si aujourd'hui
 * exigeait de défiler (`decalageCorrect > 0`), la position imposée est 0
 * (son absence) ; sinon (déjà visible sans défiler), la position imposée est
 * le MAXIMUM. Dans les deux cas, revenir avec cette position imposée exclut
 * aujourd'hui de la fenêtre visible SAUF SI ce composant rejoue.
 */
test("le retour sur le mois d'aujourd'hui, par navigation douce, recale le défilement sur aujourd'hui", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  await page.goto("/planning?vue=mois");

  const cadre = page
    .locator('[data-maquette-bloc="tableau-mois"]')
    .locator("xpath=ancestor::*[contains(@class,'overflow-x-auto')][1]");
  const aujourdhui = page.locator(
    '[data-maquette-bloc="tableau-mois"] [data-aujourdhui]',
  );
  await expect(aujourdhui).toBeVisible();

  const decalageCorrect = await cadre.evaluate((element) => element.scrollLeft);

  const versEloigne = page.getByRole("link", {
    name: fr["planning.mois_apres"],
  });
  await versEloigne.click();
  await expect(aujourdhui).toHaveCount(0);

  const positionImposee =
    decalageCorrect > 0
      ? 0
      : await cadre.evaluate((element) => element.scrollWidth);
  await cadre.evaluate((element, position) => {
    element.scrollLeft = position;
  }, positionImposee);

  const versAujourdhui = page.getByRole("link", {
    name: fr["planning.mois_avant"],
  });
  await versAujourdhui.click();
  await expect(aujourdhui).toBeVisible();

  const { rectCadre, rectAujourdhui } = await page.evaluate(() => {
    const table = document.querySelector('[data-maquette-bloc="tableau-mois"]');
    const cible = table?.querySelector("[data-aujourdhui]");
    const conteneur = table?.closest(".overflow-x-auto");
    if (
      table === null ||
      table === undefined ||
      cible === null ||
      cible === undefined ||
      conteneur === null ||
      conteneur === undefined
    ) {
      throw new Error("structure attendue absente");
    }
    return {
      rectCadre: conteneur.getBoundingClientRect(),
      rectAujourdhui: cible.getBoundingClientRect(),
    };
  });

  // AUJOURD'HUI RESTE DANS LA FENÊTRE VISIBLE DU CADRE DÉFILANT — jamais
  // caché par la position que le mois intermédiaire avait laissée derrière
  // lui.
  expect(rectAujourdhui.left).toBeGreaterThanOrEqual(rectCadre.left - 1);
  expect(rectAujourdhui.right).toBeLessThanOrEqual(rectCadre.right + 1);
});
