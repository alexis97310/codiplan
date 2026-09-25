import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 89-DEMANDES-3 — « DEMANDES » ENTRE DANS LE MENU, AVEC UN ACCÈS DIRECT À LA
 * CRÉATION.
 *
 * ## Le constat, mesuré le 25/09/2026 (audit d'ergonomie, constats 3 et 6)
 *
 * `/demandes` n'était atteignable que par le lien « Demandes en attente de
 * qualification » du tableau de bord — aucune entrée de la colonne latérale
 * n'y menait, et rien ne s'y allumait une fois l'écran ouvert.
 *
 * ## ÉCART NOMMÉ, PAS UNE DÉRIVE (D133, docs/arbitrages.md)
 *
 * La maquette (`docs/maquette/codiplan-maquette-complete.html`) ne dessine
 * pas cette entrée — D121 en fait foi sur les quatorze destinations de sa
 * colonne. Alexis a tranché malgré cela (25/09/2026, 14h25) : ce fichier
 * n'éprouve donc pas une conformité à la maquette (`entrees.test.ts` s'en
 * charge), mais le PARCOURS réel que l'écart doit désormais offrir.
 *
 * ## Le compte de l'épreuve peut créer une intervention
 *
 * `COMPTE_EPREUVE` (rôle `adv`) porte `creer_demande` dans la matrice
 * (`lib/auth/habilitations.ts`) : le bouton « Créer une intervention » doit
 * donc être visible pour lui sur `/demandes`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/89-DEMANDES-3/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("depuis le tableau de bord, « Demandes » du menu mène à /demandes et s'y allume", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  await capturer(page, "menu-tableau-de-bord");

  const lienMenu = page.getByRole("navigation").getByRole("link", {
    name: fr["nav.demandes"],
  });
  await expect(lienMenu).toBeVisible();
  await expect(lienMenu).toHaveAttribute("href", "/demandes");

  await lienMenu.click();
  await page.waitForURL((url) => url.pathname === "/demandes");
  await expect(
    page.getByRole("heading", { name: fr["demande.titre"] }),
  ).toBeVisible();

  // L'ENTRÉE S'ALLUME (`aria-current="page"`, `Entree` de
  // `components/navigation/barre.tsx`) — c'est précisément ce que le
  // parcours par le lien du tableau de bord ne permettait pas de constater.
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: fr["nav.demandes"] }),
  ).toHaveAttribute("aria-current", "page");
  await capturer(page, "demandes-menu-allume");
});

test("« Créer une intervention » mène au formulaire de création, sans rien créer", async ({
  page,
}) => {
  await page.goto("/demandes");

  const bouton = page.getByRole("link", {
    name: fr["planning.creer"],
  });
  await expect(bouton).toBeVisible();
  await expect(bouton).toHaveAttribute("href", "/interventions/nouvelle");

  await bouton.click();
  await page.waitForURL((url) => url.pathname === "/interventions/nouvelle");
  await expect(
    page.getByRole("heading", { name: fr["planning.creer"] }),
  ).toBeVisible();
});
