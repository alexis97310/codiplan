import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9I7E-CREER-MACHINE-LISTES-DEROULANTES (30/10/2026) — même
 * recette que `captures-selecteurs-1.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que l'exécution
 * ordinaire de `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * Capture le champ Client de `/parc/nouvelle`, simple focus (comme Alexis l'a
 * mesuré — aucun texte tapé), aux deux viewports. Jouée une fois AVANT le
 * correctif (`CAPTURES_9I7E=…/avant`) et une fois APRÈS
 * (`CAPTURES_9I7E=…/apres`), sur les clients de démonstration du semis — pas
 * de scène fabriquée, pour rester fidèle à ce qu'Alexis a vu en ligne.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I7E ?? "";
const LARGEURS = [
  { largeur: 375, hauteur: 800, suffixe: "375" },
  { largeur: 1280, hauteur: 900, suffixe: "1280" },
] as const;

async function capturer(
  page: Page,
  nom: string,
  suffixe: string,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}--${suffixe}.png`),
    fullPage: true,
  });
}

for (const { largeur, hauteur, suffixe } of LARGEURS) {
  test(`parc/nouvelle — le sélecteur de client ouvert, focus simple, à ${suffixe} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);
    await page.goto("/parc/nouvelle");

    const bloc = page.locator('[data-selecteur="client_id"]');
    await bloc.locator('input[type="text"]').click();
    const premiere = page
      .locator('#client_id-resultats li[role="option"]')
      .first();
    await expect(premiere).toBeVisible();
    await capturer(page, "parc-nouvelle--client_id--ouvert", suffixe);
  });
}
