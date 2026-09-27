import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9AT-CG6-TRAJETS-ILES — LA LIGNE ÎLES DIT SA PHRASE UNE SEULE FOIS (audit du
 * 26/09/2026, constat C-G7).
 *
 * Écran en LECTURE : aucune donnée n'est créée — la zone Îles est sans
 * estimation par D107, et le serveur refuse tout réglage à cette maille (voir
 * `lib/sites/trajet-zone.ts`, `schemaTrajetZone`). Même compte que
 * `retour-parametres.spec.ts` (`COMPTE_ADMIN_SOCIETE_EPREUVE`).
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/trajets");
});

test("la ligne Îles porte sa phrase une seule fois, dans une cellule qui couvre deux colonnes", async ({
  page,
}) => {
  const ligneIles = page.getByRole("row").filter({ hasText: fr["zone.iles"] });
  await expect(ligneIles).toHaveCount(1);

  await expect(
    ligneIles.getByText(fr["trajets.sans_estimation_iles"], { exact: true }),
  ).toHaveCount(1);

  const celluleEtendue = ligneIles.locator('td[colspan="2"]');
  await expect(celluleEtendue).toHaveCount(1);
  await expect(celluleEtendue).toContainText(
    fr["trajets.sans_estimation_iles"],
  );
});

test("la ligne Îles compte une cellule de moins qu'une zone estimable", async ({
  page,
}) => {
  const ligneIles = page.getByRole("row").filter({ hasText: fr["zone.iles"] });
  const ligneNord = page.getByRole("row").filter({ hasText: fr["zone.nord"] });

  const cellulesIles = await ligneIles.locator("td").count();
  const cellulesNord = await ligneNord.locator("td").count();

  expect(cellulesIles).toBe(cellulesNord - 1);
});
