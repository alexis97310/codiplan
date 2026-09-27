import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";
import { PORTES_PARAMETRAGE } from "@/lib/navigation/portes-parametrage";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9AQ-CG1-RETOUR-PARAMETRES — LE RETOUR VERS « Sociétés & tarifs » DEPUIS SES
 * NEUF SOUS-PAGES (audit du 26/09/2026, constat C-G2).
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
  test(`${chemin} renvoie vers Sociétés & tarifs`, async ({ page }) => {
    await page.goto(chemin);
    const lien = page.getByRole("link", { name: fr["parametres.retour"] });
    await expect(lien).toBeVisible();
    await lien.click();
    await expect(page).toHaveURL("/parametres");
  });
}
