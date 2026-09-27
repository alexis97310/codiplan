import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M14 (audit GR du 26/09/2026, constat M14) — LE CHAMP EN CAUSE D'UN
 * REFUS DE SAISIE EST ENCADRÉ ET FOCALISÉ.
 *
 * ## Le constat
 *
 * Après un refus de saisie, `/interventions/nouvelle` montrait le motif en
 * bandeau (`role="status"`) — mais AUCUN champ n'était marqué : le
 * bandeau était le seul repère, et un lecteur d'écran ne le lie à rien.
 *
 * ## Ce que ce fichier prouve
 *
 * `tests/unit/interventions/champ-en-cause.test.ts` éprouve `champEnCause`,
 * pure. Ce fichier prouve qu'un écran RÉEL encadre et focalise le bon champ
 * — aucune donnée créée, l'URL porte le motif directement, comme un retour
 * de `versLeFormulaire` (`app/api/interventions/creer/formulaire.ts`).
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la panne manquante encadre et focalise la description", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.panne_manquante",
  );
  const textarea = page.locator('textarea[name="description"]');
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(textarea).toBeFocused();
  await expect(page.locator('select[name="type"]')).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("la nature manquante encadre et focalise le select", async ({ page }) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.nature_manquante",
  );
  const select = page.locator('select[name="type"]');
  await expect(select).toHaveAttribute("aria-invalid", "true");
  await expect(select).toBeFocused();
  await expect(
    page.locator('textarea[name="description"]'),
  ).not.toHaveAttribute("aria-invalid", "true");
});

test("le repli « lieu inconnu » n'encadre aucun champ", async ({ page }) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.lieu_inconnu",
  );
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});
