import { expect, test } from "@playwright/test";

import { duree as dureeAttendue } from "@/app/(back-office)/parametres/trajets/presentation";
import { enHeure } from "@/lib/calendar/parametrage";
import { fr } from "@/lib/i18n";
import { DEFAUTS_TRAJET_ZONE } from "@/lib/sites/trajet-zone";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9AG-GR14-TRAJETS — la colonne « Valeur de référence » de
 * `/parametres/trajets` s'écrit en heures (`enDuree`), plus ses minutes entre
 * parenthèses à partir de l'heure — « 4 h 00 (240 minutes) » — et jamais en
 * `HH:MM` (« 04:00 »). Sous l'heure, correctif PA-24 (audit du 28/09/2026) :
 * aucune parenthèse, « 30 min » et non « 30 min (30 minutes) ».
 *
 * EN LECTURE SEULE : aucun envoi de formulaire, aucune écriture en base.
 * La valeur de référence de la Côte Est vient du CODE
 * (`DEFAUTS_TRAJET_ZONE`), jamais d'une donnée partagée — rien à forger, rien
 * à effacer.
 *
 * `dureeAttendue` importe `duree` DE L'ÉCRAN plutôt que de recopier sa
 * formule (§9, 01/09 : une seconde implémentation d'un même critère
 * diverge en silence) — même discipline que `dureeCarteAffichee`
 * (`planning-largeur-et-carte.spec.ts`).
 */

test("la valeur de référence de la Côte Est s'affiche en heures, pas en HH:MM", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/trajets");
  await expect(
    page.getByRole("heading", { name: fr["trajets.titre"] }),
  ).toBeVisible();

  const defautCoteEst = DEFAUTS_TRAJET_ZONE.cote_est;
  if (defautCoteEst.nature !== "minutes") {
    throw new Error("La Côte Est doit admettre une estimation (D107).");
  }

  const celluleZone = page.getByRole("cell", {
    name: fr["zone.cote_est"],
    exact: true,
  });
  const ligne = celluleZone.locator("xpath=ancestor::tr");
  const celluleValeurReference = ligne.getByRole("cell").nth(1);

  await expect(celluleValeurReference).toHaveText(
    dureeAttendue(defautCoteEst.minutes),
  );
  await expect(celluleValeurReference).not.toContainText(
    enHeure(defautCoteEst.minutes),
  );
});
