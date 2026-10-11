import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { SOCIETES } from "@/prisma/seed-data";

import { ouvrirUneSession } from "./setup/session";

// LE SITE SEMÉ, JAMAIS LE PREMIER DE LA LISTE (9ER) — `.first()` visait
// n'importe quel article de l'écran, qu'une fixture étrangère au libellé
// (triant avant « Atelier principal ») peut faire passer devant.
const SITE_DUCOS_PRINCIPAL_ID = (() => {
  const societe = SOCIETES.find((s) => s.code === "CODIMA-NC");
  const site = societe?.clients
    .flatMap((client) => client.sites)
    .find((s) => s.libelle === "Atelier principal");
  if (site === undefined) {
    throw new Error(
      "site « Atelier principal » absent du semis (prisma/seed-data.ts)",
    );
  }
  return site.id;
})();

/**
 * LES CAPTURES DE 9AB-GR12-SITES (26/09/2026) — même recette que
 * `captures-parc-sites.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * `/sites` (GR12a : titre « Client — Site », GR12b : la phrase de rappel
 * quand un site est masqué) et une fiche site (GR12c : « Nouveau site »,
 * « ← Tous les sites »), à 1280 et 375 px.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`git show <parent>:...` remis temporairement sur
 * le disque), une fois sur le code livré — jamais en comparant deux fichiers
 * distincts.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_GR12_SITES ?? "";

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
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — /sites`, async ({ page }) => {
      await page.goto("/sites");
      await expect(
        page.locator(`article a[href="/sites/${SITE_DUCOS_PRINCIPAL_ID}"]`),
      ).toBeVisible();
      await capturer(page, "liste-sites", largeur);
    });

    test(`capture — une fiche site`, async ({ page }) => {
      await page.goto("/sites");
      const ficheSemee = page.locator(
        `article a[href="/sites/${SITE_DUCOS_PRINCIPAL_ID}"]`,
      );
      await expect(ficheSemee).toBeVisible();
      const href = await ficheSemee.getAttribute("href");
      await page.goto(href ?? "/sites");
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "fiche-site", largeur);
    });
  });
}
