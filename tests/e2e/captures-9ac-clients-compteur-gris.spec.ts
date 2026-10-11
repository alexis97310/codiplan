import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { SOCIETES } from "@/prisma/seed-data";

import { ouvrirUneSession } from "./setup/session";

// LE CLIENT ET LE SITE SEMÉS, JAMAIS LE PREMIER DE LA LISTE (9ER) —
// `.first()` visait n'importe quelle fiche de l'écran, qu'une fixture
// étrangère au libellé (triant avant « Atelier Ducos »/« Atelier principal »)
// peut faire passer devant.
const CLIENT_ATELIER_DUCOS = (() => {
  const societe = SOCIETES.find((s) => s.code === "CODIMA-NC");
  const client = societe?.clients.find(
    (c) => c.raison_sociale === "Atelier Ducos",
  );
  if (client === undefined) {
    throw new Error(
      "client « Atelier Ducos » absent du semis (prisma/seed-data.ts)",
    );
  }
  return client.id;
})();

const SITE_DUCOS_PRINCIPAL = (() => {
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
 * LES CAPTURES DE 9AC-CLIENTS-COMPTEUR-GRIS (27/09/2026) — même recette que
 * `captures-gr12-sites.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * `/clients` et `/sites`, à 1280 et 375 px — les deux écrans dont le
 * compteur d'équipements passe de rouge (PASTILLES-1) à gris (décision
 * d'Alexis du 26/09).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`git show <parent>:...` remis temporairement sur
 * le disque), une fois sur le code livré — jamais en comparant deux fichiers
 * distincts.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AC_CLIENTS_COMPTEUR_GRIS ?? "";

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

    test(`capture — /clients`, async ({ page }) => {
      await page.goto("/clients");
      await expect(
        page.locator(`article a[href="/clients/${CLIENT_ATELIER_DUCOS}"]`),
      ).toBeVisible();
      await capturer(page, "liste-clients", largeur);
    });

    test(`capture — /sites`, async ({ page }) => {
      await page.goto("/sites");
      await expect(
        page.locator(`article a[href="/sites/${SITE_DUCOS_PRINCIPAL}"]`),
      ).toBeVisible();
      await capturer(page, "liste-sites", largeur);
    });
  });
}
