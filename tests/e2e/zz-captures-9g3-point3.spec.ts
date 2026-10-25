import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DU POINT 3 DE 9G3-TITRES-CIBLES-ACTIONS —
 * `BarreActionCollee` étire désormais son action sur toute la largeur sous
 * 901 px, sur le seul écran déjà câblé (QE-6d, `/interventions/nouvelle`).
 *
 * Recette de la mémoire de session « captures-avant-apres-e2e ». Silencieux
 * sans `CAPTURES_9G3P3`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G3P3 ?? "";
const ETAPE = process.env.CAPTURES_9G3P3_ETAPE ?? "avant";

test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9G3P3");

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${ETAPE}.png`) });
}

const LARGEURS = [1280, 375] as const;

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const largeur of LARGEURS) {
  test(`capture — /interventions/nouvelle, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/interventions/nouvelle");
    await expect(
      page
        .locator("#contenu")
        .getByRole("button", { name: fr["intervention.action.creer"] }),
    ).toBeVisible();
    await capturer(page, `interventions-nouvelle-${largeur}`);
  });
}
