import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LA FICHE MACHINE, À L'IDENTIQUE DE `machinePage()` (N-11, D125, D126).
 *
 * Les gardiens unitaires (`tests/unit/machines/composition-fiche.test.ts`,
 * `tests/unit/ui/composants-maquette.test.ts`) confrontent des TEXTES — la
 * fonction `machinePage()` de la maquette contre le code source. Aucun des
 * deux ne peut prouver qu'une fenêtre réelle rend, ou ne rend pas, le bandeau
 * d'alerte selon le statut de la machine sélectionnée : c'est l'objet de ce
 * fichier, sur le modèle de `tests/e2e/parc.spec.ts` (N-10).
 *
 * **La navigation part de `/parc?statut=…`, jamais d'un identifiant recopié
 * à la main.** `/parc` sélectionne déjà la PREMIÈRE ligne du périmètre filtré
 * dans son aperçu (N-10) ; ce scénario suit son lien « Fiche complète »
 * plutôt que de viser une adresse — un identifiant de machine écrit en dur
 * redeviendrait faux au premier semis rejoué avec un ordre différent.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("une machine EN SERVICE ne rend PAS le bandeau d'alerte", async ({
  page,
}) => {
  await page.goto("/parc?statut=en_service");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  // Témoin : sans au moins une machine en service, ce scénario ne prouve rien.
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  await expect(page.locator('[data-bloc="alert-strip"]')).toHaveCount(0);
});

test("une machine EN PANNE rend le bandeau d'alerte", async ({ page }) => {
  await page.goto("/parc?statut=en_panne");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();
  await expect(page.locator('[data-bloc="alert-strip"]')).toBeVisible();
  await expect(page.locator('[data-bloc="alert-num"]')).toBeVisible();
});

test("la fiche rend ses faits d'identité, son historique et sa carte QR", async ({
  page,
}) => {
  await page.goto("/parc");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();

  await expect(page.locator('[data-bloc="carte-identite"]')).toBeVisible();
  await expect(page.locator('[data-bloc="identite-kv"]')).toBeVisible();
  await expect(page.locator('[data-bloc="carte-historique"]')).toBeVisible();
  await expect(page.locator('[data-bloc="historique-table"]')).toBeVisible();

  const carteQr = page.locator('[data-bloc="qr-card"]');
  await expect(carteQr).toBeVisible();
  // Le QR est un SVG rendu côté serveur, jamais un <canvas> (N-11, §4).
  await expect(carteQr.locator("svg")).toBeVisible();
  await expect(carteQr.locator("canvas")).toHaveCount(0);
});
