import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LA VGP DÉPASSÉE, VUE DEPUIS LA FICHE MACHINE (99B-FICHE-MACHINE).
 *
 * ## LE CONSTAT — audit d'ergonomie du 25/09/2026, constat 31
 *
 * `/parc/[id]` affichait la ligne « Prochaine VGP » en texte noir, sans ton
 * ni lien — une machine dépassée depuis 177 jours s'y lisait comme n'importe
 * quelle autre ligne du `dl.kv`. `/vgp` colore déjà cet état (`tonEtat`,
 * désormais dans `lib/vgp/libelles.ts`, partagé) ; ce spec éprouve que la
 * fiche machine porte le MÊME repère, et mène au geste qui le corrige.
 *
 * ## LA SCÈNE — LUE, JAMAIS MODIFIÉE (piège connu de ce lot)
 *
 * `NUS-SPL-2022-0007` est la seule machine du SEMIS dont l'échéance VGP est
 * dépassée (voir `tests/e2e/vgp-retard-visible.spec.ts` et
 * `tests/e2e/vgp-4.spec.ts`, qui la lisent déjà sans la modifier). Ce spec ne
 * forge aucune donnée : il navigue depuis `/vgp`, où le numéro de série est
 * déjà un lien vers la fiche, plutôt que de recopier un identifiant à la
 * main (même règle que `tests/e2e/fiche-machine.spec.ts`).
 *
 * ## LES CAPTURES — même recette que `captures-selecteurs-1.spec.ts`
 *
 * Rien n'est écrit sans `CAPTURES_99B_FICHE_MACHINE` : l'exécution ordinaire
 * de `pnpm test:e2e` n'écrit jamais de fichier.
 */

const MACHINE_DEPASSEE = "NUS-SPL-2022-0007";
const DOSSIER = process.env.CAPTURES_99B_FICHE_MACHINE ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la fiche machine d'une VGP dépassée porte un badge rouge, et mène à l'enregistrement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vgp");
  // `.locator(…, { hasText })` — jamais `getByRole(…, { name })` : le second
  // est une REQUÊTE D'ÉCRAN au sens du gardien L0-11, le premier ne l'est
  // pas (`tests/unit/outils/rendu-visible.ts`, `REQUETES_ROLE`) — et
  // `MACHINE_DEPASSEE` est un numéro de série du SEMIS, jamais un texte du
  // dictionnaire.
  await page.locator("a", { hasText: MACHINE_DEPASSEE }).first().click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();

  // LA LIGNE « PROCHAINE VGP » DU `dl.kv` — la seule dont le `dt` porte ce
  // libellé, jamais une seconde lecture par position.
  const ligneVgp = page.locator('[data-bloc="identite-kv"] > div', {
    hasText: fr["machine.fiche.kv_vgp"],
  });
  await expect(ligneVgp).toBeVisible();

  // LE BADGE — même géométrie que `/vgp` (`rounded-[20px]`), au ton ROUGE :
  // `tonEtat` dit « dépassée » avant de dire l'état sous-jacent (VGP-2).
  const badge = ligneVgp.locator("span.rounded-\\[20px\\]").first();
  await expect(badge).toBeVisible();
  const classes = (await badge.getAttribute("class")) ?? "";
  expect(classes).toContain("bg-app-rouge-fond");
  await capturer(page, "fiche-machine-vgp-depassee--1280");

  // LE LIEN D'ENREGISTREMENT — présent parce que l'échéance est CONNUE
  // (dépassée), et menant à une page qui rend RÉELLEMENT son formulaire
  // (200 sincère, jamais un 404 masqué par un simple changement d'URL).
  const lien = ligneVgp.getByRole("link", {
    name: fr["machine.fiche.vgp_enregistrer"],
  });
  await expect(lien).toBeVisible();
  await lien.click();
  await expect(page).toHaveURL(/\/vgp\/enregistrer\//);
  // `form` seul est AMBIGU (deux formulaires sur l'écran : la déconnexion de
  // la barre, et celui-ci) — l'`action` cible le second sans ambiguïté.
  await expect(
    page.locator('form[action*="/api/vgp/enregistrer/"]'),
  ).toBeVisible();
});

test("capture — même fiche, à 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/vgp");
  await page.locator("a", { hasText: MACHINE_DEPASSEE }).first().click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  await capturer(page, "fiche-machine-vgp-depassee--375");
});
