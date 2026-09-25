import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99A-ARRIVEE/captures",
);

/**
 * Capture le point d'entrée où la connexion mène DÉSORMAIS directement,
 * plutôt que « Vous êtes connecté ». Aucune image AVANT : la redirection est
 * un fait serveur, pas un rendu — c'est l'URL et le titre affiché qui la
 * prouvent (ci-dessous), et l'image documente l'état après le lot.
 */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/**
 * `/arrivee` S'EFFACE QUAND IL N'Y A QU'UNE SOCIÉTÉ (99A-ARRIVEE, sur
 * constat 2 de l'audit d'ergonomie du 25/09/2026).
 *
 * ## Ce que ce fichier mesure
 *
 * Avant ce ticket, tout compte connecté voyait « Vous êtes connecté » avant
 * de pouvoir cliquer un lien vers son écran réel — même les deux tiers du
 * parc qui n'ont jamais qu'une société. Ce fichier prouve la redirection
 * DIRECTE, pour deux rôles dont le point d'entrée diffère (ADV → `/planning`,
 * technicien → `/terrain`), et qu'aucun des deux ne voit plus le titre de
 * l'ancien écran.
 *
 * ## Ce qu'il NE mesure PAS, et pourquoi
 *
 * Le cas « plusieurs sociétés » (la page garde son sélecteur) n'a pas de
 * compte dans `tests/e2e/setup/scene.ts` — en forger un romprait le
 * cloisonnement d'une scène partagée sous `fullyParallel`. Il est éprouvé sur
 * la fonction pure de décision, sans navigateur :
 * `tests/unit/app/arrivee-decision.test.ts`.
 */

test("compte ADV (une société) : la connexion mène directement au planning", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();

  await expect(page).toHaveURL(/\/planning/);
  await expect(
    page.getByRole("heading", { name: fr["planning.titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["arrivee.titre"])).toHaveCount(0);

  // Une visite DIRECTE de `/arrivee` redirige aussi — c'est la page qui
  // décide, pas un hasard de la connexion.
  await page.goto("/arrivee");
  await expect(page).toHaveURL(/\/planning/);

  await capturer(page, "planning-apres-connexion-directe", 1280);
});

test("compte technicien (une société, accès restreint) : la connexion mène directement au terrain", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();

  await expect(page).toHaveURL(/\/terrain$/);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["arrivee.titre"])).toHaveCount(0);

  await page.goto("/arrivee");
  await expect(page).toHaveURL(/\/terrain$/);

  await capturer(page, "terrain-apres-connexion-directe", 390);
});
