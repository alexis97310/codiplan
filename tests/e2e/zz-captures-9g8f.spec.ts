import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9G8F-DECLARATION-ABSENCE-FORMULAIRE-SEUL — la
 * page vue par un technicien sur `/absences?declarer=1` (AVANT : la page
 * bureau entière, volet ouvert par-dessus ; APRÈS : le formulaire seul), et
 * celle vue par un rôle bureau sur `/absences`, APRÈS seulement (inchangée).
 *
 * Recette de la mémoire de session « captures-avant-apres-e2e » : ce fichier
 * tourne une fois sur le commit d'AVANT (`CAPTURES_9G8F_ETAPE=avant`), une
 * fois sur le code livré (`CAPTURES_9G8F_ETAPE=apres`). Silencieux sans
 * `CAPTURES_9G8F` (le dossier).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G8F ?? "";
const ETAPE = process.env.CAPTURES_9G8F_ETAPE ?? "avant";

test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9G8F");

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
  test(`capture — technicien sur /absences?declarer=1, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto("/absences?declarer=1");
    await expect(page.getByRole("dialog")).toBeVisible();
    await capturer(page, `absences-declarer-technicien-${largeur}`);
  });

  test(`capture — responsable sur /absences (inchangée), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/absences");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, `absences-bureau-${largeur}`);
  });
}
