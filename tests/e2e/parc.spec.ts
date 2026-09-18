import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LE MAÎTRE-DÉTAIL DE `/parc` (N-10, D125).
 *
 * Les gardiens unitaires (`tests/unit/machines/composition-parc.test.ts`,
 * `tests/unit/ui/composants-maquette.test.ts`) confrontent des TEXTES — la
 * fonction `parc()` de la maquette contre le code source. Aucun des deux ne
 * peut prouver qu'une fenêtre réelle rend deux colonnes au-delà de 900px et
 * une seule en dessous, ni qu'un clic change VRAIMENT le panneau de droite ET
 * l'adresse : c'est l'objet de ce fichier, sur le modèle du harnais de
 * bout en bout posé par R2-18 (`tests/e2e/setup/`).
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("deux colonnes au-delà du seuil de la maquette, une seule en dessous (900px)", async ({
  page,
}) => {
  // Au-delà du seuil : la liste et l'aperçu sont CÔTE À CÔTE.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  const [liste, apercu] = await Promise.all([
    page.locator('[data-bloc="liste-machines"]').boundingBox(),
    page.locator('[data-bloc="apercu-hero"]').boundingBox(),
  ]);
  if (liste === null || apercu === null) {
    throw new Error(
      "liste ou aperçu introuvable — le maître-détail ne rend rien",
    );
  }
  // « Côte à côte » se mesure : la liste se termine avant que l'aperçu ne
  // commence sur l'axe horizontal, jamais l'un sous l'autre.
  expect(liste.x + liste.width).toBeLessThanOrEqual(apercu.x + 1);

  // En dessous du seuil : le repli à une colonne de la maquette
  // (`@media(max-width:900px)`), éprouvé ici plutôt que supposé du gardien
  // unitaire, qui ne rend aucune fenêtre.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
  const [listeEtroite, apercuEtroit] = await Promise.all([
    page.locator('[data-bloc="liste-machines"]').boundingBox(),
    page.locator('[data-bloc="apercu-hero"]').boundingBox(),
  ]);
  if (listeEtroite === null || apercuEtroit === null) {
    throw new Error("liste ou aperçu introuvable en repli étroit");
  }
  // Une seule colonne : l'aperçu commence SOUS la liste, jamais à côté.
  expect(apercuEtroit.y).toBeGreaterThanOrEqual(
    listeEtroite.y + listeEtroite.height - 1,
  );
});

test("cliquer une ligne change le panneau de droite ET l'adresse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parc");

  const lignes = page.locator('[data-bloc="liste-machines"] a');
  const nombreDeLignes = await lignes.count();
  // Témoin : sans au moins deux lignes, changer de sélection ne prouverait
  // rien — la seconde ligne pourrait être la même que la première.
  expect(nombreDeLignes).toBeGreaterThan(1);

  const referenceInitiale = await page
    .locator('[data-bloc="apercu-hero"] .font-mono')
    .textContent();

  const secondeLigne = lignes.nth(1);
  const hrefSeconde = await secondeLigne.getAttribute("href");
  if (hrefSeconde === null) {
    throw new Error("la seconde ligne n'a pas d'adresse");
  }
  const machineId = new URL(hrefSeconde, "http://localhost").searchParams.get(
    "machine",
  );
  expect(machineId).not.toBeNull();
  await secondeLigne.click();

  // L'ADRESSE — la sélection vit dans l'URL (`?machine=<id>`), tranché par
  // le ticket N-10 : jamais un état de composant qui ne survivrait pas au
  // rechargement.
  await expect(page).toHaveURL(new RegExp(`machine=${machineId}`));

  // LE PANNEAU — une référence DIFFÉRENTE de celle affichée avant le clic.
  const referenceApresClic = await page
    .locator('[data-bloc="apercu-hero"] .font-mono')
    .textContent();
  expect(referenceApresClic).not.toBe(referenceInitiale);

  // La sélection SURVIT AU RECHARGEMENT — c'est tout l'intérêt d'un état
  // porté par l'URL plutôt que par un composant.
  await page.reload();
  const referenceApresRechargement = await page
    .locator('[data-bloc="apercu-hero"] .font-mono')
    .textContent();
  expect(referenceApresRechargement).toBe(referenceApresClic);
});

test("une recherche sans résultat rend l'état vide, et « Réinitialiser » fonctionne", async ({
  page,
}) => {
  await page.goto(
    "/parc?q=" + encodeURIComponent("aucune-machine-ne-porte-ce-texte-zzz"),
  );

  await expect(page.getByText(fr["parc.aucune_trouvee"])).toBeVisible();
  await expect(page.locator('[data-bloc="maitre-detail"]')).toHaveCount(0);

  // DEUX liens portent ce libellé sur l'état vide — celui de la barre
  // d'outils et celui de la carte vide elle-même (la maquette pose le
  // second À L'INTÉRIEUR de `.card.empty`) : le premier suffit à éprouver
  // que le geste fonctionne.
  const reinitialiser = page
    .getByRole("link", { name: fr["parc.reinitialiser"] })
    .first();
  await expect(reinitialiser).toBeVisible();
  await reinitialiser.click();

  await expect(page).toHaveURL(/\/parc$/);
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
});
