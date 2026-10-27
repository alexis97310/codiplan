import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9H4-FINITIONS-AVANT-AUDIT, point 4 — LA LÉGENDE DE LA VUE JOUR DIT
 * « ANNULÉE » QUAND `annulees=1`, COMME LA VUE SEMAINE.
 *
 * `VueJour` posait déjà `afficherAnnulees` par défaut à `false` (sa propre
 * signature) et ne le recevait jamais de l'appel réel (`page.tsx`, l.2309) :
 * la légende Jour n'affichait donc jamais « Annulée », quel que soit
 * `?annulees=1`. La puce de la légende ne dépend d'AUCUNE intervention
 * annulée réellement présente — seulement du drapeau — donc aucune donnée
 * n'est écrite pour cette épreuve, seul le paramètre d'URL varie.
 *
 * `MARDI + 126` (18 semaines, multiple de 7) : un de plus que `MARDI + 119`
 * n'étant réservé par aucun autre fichier à l'écriture de ce point ; au-delà
 * de `MARDI + 112` (`planning-jour-en-tete.spec.ts`), le plus grand déjà
 * réservé.
 */

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("« Annulée » apparaît dans la légende Jour avec ?annulees=1, jamais sans", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourDeLaScene(reperes, MARDI + 126);
  const jourVise = cleDeJour(jour);

  await page.goto(`/planning?vue=jour&jour=${jourVise}`);
  const legende = page.locator('[data-maquette-bloc="vue-jour"] > ul').first();
  await expect(legende).toBeVisible();
  await expect(legende).not.toContainText(fr["planning.legende.annulee"]);

  await page.goto(`/planning?vue=jour&jour=${jourVise}&annulees=1`);
  const legendeAvecAnnulees = page
    .locator('[data-maquette-bloc="vue-jour"] > ul')
    .first();
  await expect(legendeAvecAnnulees).toBeVisible();
  await expect(legendeAvecAnnulees).toContainText(
    fr["planning.legende.annulee"],
  );
});
