import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURE — 9L27-PLANCHER-JAMAIS-ZERO, décision d'Alexis du 10/11/2026
 * (« Non, jamais 0 ») : un plancher à `0`, saisi en contournant les
 * contraintes HTML du champ (`min`, `required` — même patron que
 * `captures-9br-tpa4b-messages.spec.ts`), est refusé par la route, pas
 * seulement par le navigateur.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L27-PLANCHER-JAMAIS-ZERO/captures",
);

async function capturer(page: Page, nom: string, largeur: number) {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `apres-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [375, 1280] as const) {
  test(`un plancher à 0 est refusé, à l'écran — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/tarifs");
    await expect(
      page.getByText(fr["tarifs.regle_facturation.titre"]),
    ).toBeVisible();

    const formulaire = page.locator(
      'form[action="/api/parametres/tarifs/regle-facturation"]',
    );
    await formulaire.locator('input[name="plancher_min"]').fill("0");
    // Le champ porte `min={1}` côté client, et le bouton se désactive dès
    // que l'exemple devient invalide (aperçu seulement, voir le commentaire
    // de `FormulaireRegleFacturation`) : on retire les deux pour éprouver le
    // refus SERVEUR, pas la seule saisie du navigateur.
    await formulaire.evaluate((forme) => {
      forme.querySelector('[name="plancher_min"]')?.removeAttribute("min");
      forme.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    });
    await formulaire.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(fr["tarifs.regle_facturation.refus_saisie"]),
    ).toBeVisible();
    // Le réglage affiché reste le défaut de la migration — rien n'a été
    // écrit (le défaut n'est modifié par aucun autre scénario e2e, voir
    // `tests/e2e/9i8b-conditions-de-facturation-sans-montant.spec.ts`).
    await expect(formulaire.locator('input[name="plancher_min"]')).toHaveValue(
      "60",
    );

    await capturer(page, "tarifs-plancher-refuse", largeur);
  });
}
