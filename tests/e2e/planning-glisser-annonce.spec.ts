import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 99J-PLANNING-GLISSER — AU BUREAU, LE PLANNING DIT QU'ON PEUT GLISSER-DÉPOSER.
 *
 * ## Ce qui a été mesuré (audit d'ergonomie du 25/09/2026, constat 15, partie
 * restante)
 *
 * Les cartes de `/planning` sont `draggable` (`components/planning/pose.tsx`)
 * mais rien ne le DISAIT au bureau — sous `lg`, `planning.liste_lecture_seule`
 * dit déjà l'inverse (« ouvrez sa fiche »), mais à partir de `lg`, où la
 * grille EST la cible de dépôt, aucun mot n'annonçait le geste. La maquette
 * qui fait foi (D95, `docs/maquette/CODIPLAN_Maquette.html` l.~261) porte
 * pourtant ce sous-titre : « Glisser-déposer pour réaffecter ».
 *
 * ## Pourquoi le rôle compte
 *
 * `modifier_planning` (`lib/auth/habilitations.ts`) n'est complet que pour
 * `admin_societe`, `direction`, `responsable_materiel`, `responsable_sav` et
 * `adv` — jamais pour `technicien` ni `client`, et c'est la MÊME capacité que
 * la route `/api/interventions/[id]/deplacer` exige déjà côté serveur. La
 * mention n'apparaît qu'à un rôle qui la détient : `admin_societe`, seule
 * identité de ce type dans la scène de l'épreuve (`COMPTE_ADMIN_SOCIETE_EPREUVE`).
 *
 * ## Ce que ce fichier NE crée pas
 *
 * Aucune donnée : la grille est non vide grâce aux témoins déjà posés par la
 * scène partagée (`poigoune@codima.test`, `guerin@codima.test`), et cette
 * épreuve ne compte que la présence d'un texte, jamais une population du
 * semis — jamais de piège de comptage sous `fullyParallel`.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("à 1280 px, un rôle qui peut déplacer voit la mention « Glisser-déposer pour réaffecter »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/planning");
  await expect(page.locator("main")).toBeVisible();

  const mention = page.locator("[data-mention-glisser-reaffecter]");
  await expect(mention).toBeVisible();
  await expect(mention).toContainText(fr["planning.glisser_pour_reaffecter"]);
});

test("à 375 px, la mention disparaît et l'avertissement de la liste lecture seule reste visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/planning");
  await expect(page.locator("main")).toBeVisible();

  await expect(
    page.locator("[data-mention-glisser-reaffecter]"),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["planning.liste_lecture_seule"]),
  ).toBeVisible();
});
