import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU — la
 * barre vue par un technicien sur `/absences?declarer=1` (seule page où le
 * chrome du back-office reste visible pour ce rôle) et sur `/arrivee` (qui,
 * pour ce compte à une seule société, redirige AVANT toute peinture — voir
 * `tests/e2e/9g8e-garde-navigation-douce.spec.ts` ; la capture porte donc sur
 * l'écran d'atterrissage réel, `/terrain`, identique avant et après ce lot).
 *
 * Recette de la mémoire de session « captures-avant-apres-e2e » : ce fichier
 * tourne une fois dans un worktree sur le commit d'AVANT (`CAPTURES_9G8E_ETAPE=avant`),
 * une fois sur le code livré (`CAPTURES_9G8E_ETAPE=apres`). Silencieux sans
 * `CAPTURES_9G8E` (le dossier).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G8E ?? "";
const ETAPE = process.env.CAPTURES_9G8E_ETAPE ?? "avant";

test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9G8E");

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}.png`),
    fullPage: true,
  });
}

const LARGEURS = [1280, 375] as const;

for (const largeur of LARGEURS) {
  test(`capture — barre du technicien sur /absences?declarer=1, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto("/absences?declarer=1");
    await expect(page.getByRole("dialog")).toBeVisible();
    await capturer(page, `absences-declarer-technicien-${largeur}`);
  });

  test(`capture — /arrivee pour le technicien (redirige vers /terrain), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto("/arrivee");
    await expect(page).toHaveURL(/\/terrain$/);
    await capturer(page, `arrivee-technicien-${largeur}`);
  });
}
