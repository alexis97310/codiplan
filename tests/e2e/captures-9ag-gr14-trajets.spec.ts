import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AG-GR14-TRAJETS (27/09/2026) — même recette que
 * `captures-gr14-duree-unique.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * `/parametres/trajets` lit ses six zones et leurs valeurs de référence
 * depuis le CODE (`DEFAUTS_TRAJET_ZONE`), jamais d'une donnée forgée : rien à
 * écrire ni à effacer, la capture est purement une lecture de l'écran.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */
const DOSSIER = process.env.CAPTURES_9AG ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — temps de trajet par zone à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/parametres/trajets");
    await expect(
      page.getByRole("heading", { name: fr["trajets.titre"] }),
    ).toBeVisible();
    await capturer(page, "trajets", largeur);
  });
}
