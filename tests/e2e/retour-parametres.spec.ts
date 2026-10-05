import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";
import { PORTES_PARAMETRAGE } from "@/lib/navigation/portes-parametrage";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9AQ-CG1-RETOUR-PARAMETRES — LE RETOUR VERS « Paramètres » DEPUIS SES
 * SOUS-PAGES (audit du 26/09/2026, constat C-G2 ; renommé QT-21, D167,
 * 05/10/2026, TP-NAV1 ; devenu un FIL D'ARIANE le 06/10/2026,
 * 9DR-TP-NAV2-RETOURS-FIL, D168).
 *
 * L'ancien retour nu (`parametres.retour`) a été retiré : chaque sous-page
 * porte désormais un fil d'Ariane dont le PREMIER maillon est « Paramètres »,
 * `t("nav.societes_tarifs")` — même destination, même geste.
 *
 * Écrans en LECTURE : aucune donnée n'est créée, même compte que
 * `tous-les-ecrans-rendent.spec.ts` (`COMPTE_ADMIN_SOCIETE_EPREUVE`). La
 * population se déduit de `PORTES_PARAMETRAGE`, pas d'une liste écrite à la
 * main.
 */
test.describe.configure({ mode: "serial" });

const CHEMINS_DE_PARAMETRAGE = PORTES_PARAMETRAGE.filter((porte) =>
  porte.chemin.startsWith("/parametres/"),
).map((porte) => porte.chemin);

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

for (const chemin of CHEMINS_DE_PARAMETRAGE) {
  test(`${chemin} renvoie vers Paramètres`, async ({ page }) => {
    await page.goto(chemin);
    const fil = page.getByRole("navigation", {
      name: fr["navigation.fil_ariane"],
    });
    const lien = fil.getByRole("link", { name: fr["nav.societes_tarifs"] });
    await expect(lien).toBeVisible();
    await lien.click();
    await expect(page).toHaveURL("/parametres");
  });
}
