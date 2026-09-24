import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * UN NOM MÈNE À SA FICHE, ET « + INTERVENTION » ARRIVE PRÉREMPLI (LIENS-1).
 *
 * Les gardiens unitaires ne peuvent pas prouver qu'une fenêtre réelle rend un
 * VRAI lien cliquable, ni qu'un `<select>` arrive avec la BONNE option cochée
 * après une navigation par l'adresse — c'est l'objet de ce fichier, sur le
 * modèle de `tests/e2e/fiche-machine.spec.ts` et `tests/e2e/parc.spec.ts`.
 *
 * **Aucun identifiant n'est écrit en dur.** Chaque scénario part d'une LISTE
 * (`/parc`, `/interventions`) et suit un lien pour connaître l'identifiant
 * visé — jamais une adresse recopiée à la main, qui redeviendrait fausse au
 * premier semis rejoué avec un ordre différent.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("depuis /parc, le client et le site de la fiche mènent à leur fiche", async ({
  page,
}) => {
  await page.goto("/parc");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  // Témoin : sans au moins une machine, ce scénario ne prouve rien.
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();

  const identite = page.locator('[data-bloc="carte-identite"]');
  await expect(identite).toBeVisible();

  const lienClient = identite.locator('a[href^="/clients/"]');
  await expect(lienClient).toHaveCount(1);
  const hrefClient = await lienClient.getAttribute("href");
  expect(hrefClient).not.toBeNull();
  await lienClient.click();
  await expect(page).toHaveURL(hrefClient as string);

  await page.goBack();
  const lienSite = page.locator(
    '[data-bloc="carte-identite"] a[href^="/sites/"]',
  );
  await expect(lienSite).toHaveCount(1);
  const hrefSite = await lienSite.getAttribute("href");
  expect(hrefSite).not.toBeNull();
  await lienSite.click();
  await expect(page).toHaveURL(hrefSite as string);
});

test("« + Intervention » depuis une fiche machine arrive PRÉREMPLI, et un site inexistant est ignoré en silence", async ({
  page,
}) => {
  await page.goto("/parc");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();

  const ajouter = page.locator('[data-bloc="historique-ajouter"]');
  await expect(ajouter).toBeVisible();
  const href = await ajouter.getAttribute("href");
  expect(href).not.toBeNull();
  await ajouter.click();
  await page.waitForURL(/\/interventions\/nouvelle\?/);

  const url = new URL(page.url());
  const siteAttendu = url.searchParams.get("site");
  const machineAttendue = url.searchParams.get("machine");
  expect(siteAttendu).not.toBeNull();
  expect(machineAttendue).not.toBeNull();

  // LE SITE ARRIVE PRÉREMPLI — champ CACHÉ posé par `SelecteurRecherche`
  // (SELECTEURS-1), plus un `<select>` : `versValeurChamp` compose
  // `client_id:site_id`, exactement ce que `/api/interventions/creer`
  // attend.
  const siteValeurCachee = page.locator(
    '[data-selecteur="site"] input[type="hidden"]',
  );
  await expect(siteValeurCachee).toHaveValue(new RegExp(`:${siteAttendu}$`));

  const machineSelect = page.locator('select[name="machine_ids"]');
  const optionCochee = machineSelect.locator("option:checked");
  await expect(optionCochee).toHaveCount(1);
  await expect(optionCochee).toHaveAttribute(
    "value",
    machineAttendue as string,
  );

  // TÉMOIN DU REFUS SILENCIEUX — un site qui n'existe pas ne fait ni erreur
  // ni page morte : le formulaire s'ouvre dans son état par défaut.
  const reponse = await page.goto(
    "/interventions/nouvelle?site=00000000-0000-0000-0000-000000000000",
  );
  expect(reponse?.status()).toBe(200);
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  await expect(page.locator('[data-selecteur="site"]')).toBeVisible();
});

test("depuis /interventions, le client et la machine de la fiche mènent à leur fiche", async ({
  page,
}) => {
  await page.goto("/interventions");
  // La ligne dont la TROISIÈME colonne (« Machine ») n'est pas le signe
  // d'absence — la seule que ce scénario puisse éprouver. Filtrer sur la
  // ligne entière serait faux : la colonne « Priorité » porte elle-même un
  // tiret cadratin (« P1 — critique »), présent sur chaque ligne.
  const ligneAvecMachine = page
    .locator("table tbody tr")
    .filter({ has: page.locator('td:nth-child(3):not(:text-is("—"))') })
    .first();
  await expect(ligneAvecMachine).toBeVisible();
  await ligneAvecMachine.locator('a[href^="/interventions/"]').click();

  const lienClient = page.locator('a[href^="/clients/"]').first();
  await expect(lienClient).toBeVisible();
  const hrefClient = await lienClient.getAttribute("href");
  expect(hrefClient).not.toBeNull();
  await lienClient.click();
  await expect(page).toHaveURL(hrefClient as string);

  await page.goBack();
  const lienMachine = page.locator('a[href^="/parc/"]').first();
  await expect(lienMachine).toBeVisible();
  const hrefMachine = await lienMachine.getAttribute("href");
  expect(hrefMachine).not.toBeNull();
  await lienMachine.click();
  await expect(page).toHaveURL(hrefMachine as string);
});
