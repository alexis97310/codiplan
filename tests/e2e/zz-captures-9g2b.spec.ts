import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES « APRÈS » DE 9G2B-FINITIONS-CARTES-375 — en VIEWPORT (jamais
 * `fullPage`), 375 puis 1280 px, même recette que `zz-captures-9g2.spec.ts`
 * (mémoire « captures-avant-apres-e2e »). Aucune écriture en base : les deux
 * écrans se lisent sur le semis de démonstration.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9G2B-FINITIONS-CARTES-375/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 800 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-${largeur}.png`),
    fullPage: false,
  });
}

async function capturerEcran(
  page: Page,
  chemin: string,
  nom: string,
): Promise<void> {
  await page.goto(chemin);
  await expect(page.locator("main")).toBeVisible();
  for (const largeur of [1280, 375] as const) {
    await capturer(page, nom, largeur);
  }
}

test("captures — trajets et matériel, après correctif (9G2B)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await capturerEcran(page, "/parametres/trajets", "parametres-trajets");
  await capturerEcran(page, "/parametres/materiel", "parametres-materiel");
});
