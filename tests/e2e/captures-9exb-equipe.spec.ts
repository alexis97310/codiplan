import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9EXB-EQUIPE-EPREUVES-CAPTURES (point 1) — demandées par le
 * ticket, jamais prises par 9EXA (passation de 9EX-EQUIPE-TECHNICIENS-
 * MAQUETTE : « aucune épreuve de capture neuve n'a été écrite »).
 *
 * **EN VIEWPORT, SANS `fullPage`** — contrairement à `captures-aa3-equipe.
 * spec.ts` et `captures-9dja-acces-technicien.spec.ts` : le ticket demande
 * explicitement ce que l'écran montre SANS défiler.
 *
 * **AUCUNE FIXTURE NEUVE** : la scène globale (`tests/e2e/setup/scene.ts`)
 * ouvre déjà un compte ACTIF pour un technicien (`COMPTE_TECHNICIEN_EPREUVE`,
 * « Garnier ») et pour plusieurs comptes de bureau
 * (`COMPTE_ADMIN_SOCIETE_EPREUVE`, RM, RS, ADV) — de quoi montrer le menu
 * « … » pour les deux types de personne sans rien écrire en base.
 *
 * Rien n'est écrit sur disque sans la variable d'environnement qui nomme le
 * dossier — même discipline que les captures existantes.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EXB ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}.png`) });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe");
      await expect(
        page.getByRole("heading", { name: fr["equipe.titre_ecran"] }),
      ).toBeVisible();
    });

    test(`capture — onglet Techniciens rempli, à ${largeur}px`, async ({
      page,
    }) => {
      await capturer(page, "equipe-techniciens-rempli", largeur);
    });

    test(`capture — menu « … » ouvert sur un technicien, à ${largeur}px`, async ({
      page,
    }) => {
      const bouton = page
        .getByRole("button", { name: fr["ui.menu_plus.titre"] })
        .first();
      await bouton.click();
      await expect(
        page.getByText(fr["equipe.menu.nouveau_lien"]).first(),
      ).toBeVisible();
      await capturer(page, "equipe-menu-ouvert", largeur);
    });

    test(`capture — dialogue « nouveau lien », à ${largeur}px`, async ({
      page,
    }) => {
      const bouton = page
        .getByRole("button", { name: fr["ui.menu_plus.titre"] })
        .first();
      await bouton.click();
      await page
        .getByRole("menuitem", { name: fr["equipe.menu.nouveau_lien"] })
        .first()
        .click();
      const dialogue = page.getByRole("dialog");
      await expect(
        dialogue.getByRole("button", { name: fr["equipe.dialogue.envoyer"] }),
      ).toBeVisible();
      await capturer(page, "equipe-dialogue-nouveau-lien", largeur);
    });

    test(`capture — onglet Comptes de bureau, à ${largeur}px`, async ({
      page,
    }) => {
      await page
        .getByRole("link", { name: fr["equipe.onglet.bureau"] })
        .click();
      await page.waitForURL(/onglet=bureau/);
      await expect(
        page.getByRole("columnheader", {
          name: fr["equipe.bureau.colonne.personne"],
        }),
      ).toBeVisible();
      await capturer(page, "equipe-onglet-bureau", largeur);
    });
  });
}

test(`capture — cartes à 375px (hors boucle, dédiée)`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");
  await expect(page.locator("ul[aria-label]").first()).toBeVisible();
  await capturer(page, "equipe-cartes", 375);
});
