import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 99E-EVITEMENT (26/09/2026) — un lien d'évitement, et deux tableaux nommés.
 *
 * ## LE CONSTAT — audit d'ergonomie du 25/09/2026, constat 39
 *
 * Aucun lien d'évitement n'existait dans la coque du back-office, et les
 * tableaux du registre (`/interventions`) et du planning (`/planning`)
 * n'avaient ni `caption` ni `aria-label` — une personne au clavier ou au
 * lecteur d'écran traversait toute la barre de navigation avant d'atteindre
 * le contenu, et ne pouvait pas nommer ce qu'un tableau représentait.
 *
 * ## CE QUE CETTE ÉPREUVE MESURE
 *
 * Aucune scène n'est forgée : les trois écrans (`/tableau-de-bord`,
 * `/interventions`, `/planning`) se mesurent tels quels, sur le compte de
 * l'épreuve. Le premier scénario suit le clavier — `Tab` puis `Entrée` — sur
 * `/tableau-de-bord` ; les deux autres vérifient le nom accessible des deux
 * tableaux (`getByRole('table', { name })`).
 */

const DOSSIER = process.env.CAPTURES_99E_EVITEMENT ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("le lien d'évitement se focalise au premier Tab et mène au contenu", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");

  await page.keyboard.press("Tab");
  const lien = page.getByRole("link", {
    name: fr["navigation.aller_au_contenu"],
  });
  await expect(lien).toBeFocused();
  await expect(lien).toBeVisible();
  await capturer(page, "lien-evitement-focalise-1280");

  await page.keyboard.press("Enter");
  await expect(page.locator("#contenu")).toBeFocused();
});

test("le registre des interventions expose son nom accessible", async ({
  page,
}) => {
  await page.goto("/interventions");
  await expect(
    page.getByRole("table", { name: fr["interventions.titre"] }),
  ).toBeVisible();
  await capturer(page, "registre-nom-accessible-1280");
});

test("la grille du planning expose son nom accessible", async ({ page }) => {
  await page.goto("/planning");
  await expect(
    page.getByRole("table", { name: fr["planning.titre"] }),
  ).toBeVisible();
  await capturer(page, "planning-nom-accessible-1280");
});
