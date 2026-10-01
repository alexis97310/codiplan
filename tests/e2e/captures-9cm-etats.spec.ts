import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES D'ÉTATS DE 9CM-RETOUCHES-2B-REPRISE — même recette que
 * `captures-9cb-menu.spec.ts` (9CB) : AVANT sur le code d'avant ce ticket,
 * APRÈS sur le code livré, en rejouant ce même fichier deux fois.
 *
 * **Le tiroir de menu, à 375 px** — les icônes du back-office, inchangées par
 * ce ticket (D139, 9CB). « Portail client » en reçoit une désormais
 * (`globe`, décision du 30/09, point 15 ; D144) — NON photographiée ici :
 * aucun rôle de back-office ne porte `consulter_parc_propre`
 * (`lib/auth/habilitations.ts`, réservée à `CLI`), donc l'entrée ne s'affiche
 * pour AUCUN compte de l'épreuve, situation antérieure à ce ticket. Son icône
 * reste éprouvée par `tests/unit/navigation/icones-du-menu.test.tsx`, qui
 * rend la barre SANS rôle (donc sans ce filtre).
 *
 * **La barre du portail, à 1280 px** — `nav.portail_parc` porte maintenant
 * une icône (`machine`), là où elle n'en portait aucune avant ce ticket.
 * **Aucun compte de portail ne peut ouvrir de session (D96)** : le compte de
 * l'épreuve visite `/portail` comme `coque-375.spec.ts` le fait déjà — seule
 * la COQUE se mesure, jamais le contenu de la page.
 *
 * **Le focus clavier, au repos et sur l'entrée active, à 1280 px** — l'anneau
 * de la colonne sombre change de jeton (`--app-chrome-lien`, D144) ; AVANT ce
 * ticket, il restait calé sur `--ring`/`--app-marque`, sous le contraste AA.
 * Un seul thème est capturé : « tableau » n'est pas sélectionnable à
 * l'exécution (`APPARENCE_PAR_DEFAUT` fige « maquette », voir
 * `tests/unit/theme/focus-barre-sombre.test.ts`) — aucune route ni cookie ne
 * pose `data-apparence="tableau"`, donc ce fichier ne peut pas non plus
 * capturer ce second thème.
 *
 * **Les tuiles du tableau de bord et du registre, à 1280 px** — le lien
 * doublon a disparu sous les tuiles cliquables (D144, points 12-13).
 *
 * **« En retard » à zéro** — photographiée SEULEMENT si la scène partagée le
 * montre à zéro au moment de l'épreuve (lecture seule, aucune donnée forgée
 * ici) ; sinon ce fichier le dit en sortie, et la preuve reste le test
 * unitaire (`tests/unit/tableau-de-bord/presentation.test.ts`).
 *
 * LECTURE SEULE : aucune scène forgée, aucune donnée créée ni supprimée.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CM ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — le tiroir de menu ouvert (icônes du back-office)", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    await page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }).click();
    const colonne = page.locator("#colonne-navigation");
    await expect(colonne).toBeVisible();
    await expect(
      colonne.getByRole("link", { name: fr["nav.planning"] }).locator("svg"),
    ).toBeVisible();
    await page.waitForTimeout(200);
    await capturer(page, "tiroir-menu-375");
  });
});

test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
  });

  test("capture — la barre du portail (« Votre parc », icône machine)", async ({
    page,
  }) => {
    await page.goto("/portail");
    const lien = page
      .locator("#colonne-navigation")
      .getByRole("link", { name: fr["nav.portail_parc"] });
    await expect(lien).toBeVisible();
    await expect(lien.locator("svg")).toBeVisible();
    await page.waitForTimeout(200);
    await capturer(page, "barre-portail-parc-1280");
  });

  test("capture — focus clavier sur une entrée AU REPOS de la colonne sombre", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    const lien = page
      .locator("#colonne-navigation")
      .getByRole("link", { name: fr["nav.planning"] });
    await expect(lien).toBeVisible();
    await lien.focus();
    await page.waitForTimeout(200);
    await capturer(page, "focus-colonne-au-repos-1280");
  });

  test("capture — focus clavier sur l'entrée ACTIVE de la colonne sombre", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    const lien = page
      .locator("#colonne-navigation")
      .getByRole("link", { name: fr["nav.tableau_de_bord"] });
    await expect(lien).toHaveAttribute("aria-current", "page");
    await lien.focus();
    await page.waitForTimeout(200);
    await capturer(page, "focus-colonne-active-1280");
  });

  test("capture — les tuiles du tableau de bord, sans lien doublon", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    await expect(page.locator('[data-bloc="kpi-grille"]')).toBeVisible();
    await capturer(page, "tableau-de-bord-tuiles-1280");
  });

  test("capture — les tuiles du registre des interventions, sans lien doublon", async ({
    page,
  }) => {
    await page.goto("/interventions");
    await expect(page.locator('[data-bloc="kpi-en-cours"]')).toBeVisible();
    await capturer(page, "interventions-tuiles-1280");
  });

  test("capture — « En retard » à zéro, SI la scène le montre ainsi au moment de l'épreuve", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    const tuile = page.locator('[data-bloc="kpi-en-retard"]');
    await expect(tuile).toBeVisible();
    const texte = (await tuile.innerText()).trim();
    const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
    expect(correspondance).not.toBeNull();
    if (correspondance![1] === "0") {
      await capturer(page, "tableau-de-bord-en-retard-zero-1280");
    } else {
      // eslint-disable-next-line no-console -- README (passation), jamais un libellé d'écran : L0-11 ne s'applique pas.
      console.log(
        `« En retard » ne vaut pas 0 au moment de l'épreuve (${correspondance![1]}) — capture non prise, voir le README.`,
      );
    }
  });
});
