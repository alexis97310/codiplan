import { expect, test } from "@playwright/test";

import { decompte } from "@/app/(back-office)/presentation";
import { enDuree } from "@/lib/calendar/duree";
import { enHeure } from "@/lib/calendar/parametrage";
import { fr } from "@/lib/i18n";
import { DEFAUTS_TRAJET_ZONE } from "@/lib/sites/trajet-zone";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9AG-GR14-TRAJETS — la colonne « Valeur de référence » de
 * `/parametres/trajets` s'écrit en heures (`enDuree`), plus ses minutes entre
 * parenthèses — « 4 h 00 (240 minutes) » — et jamais en `HH:MM` (« 04:00 »).
 *
 * EN LECTURE SEULE : aucun envoi de formulaire, aucune écriture en base.
 * La valeur de référence de la Côte Est vient du CODE
 * (`DEFAUTS_TRAJET_ZONE`), jamais d'une donnée partagée — rien à forger, rien
 * à effacer.
 *
 * Composée dans une fonction dédiée : le gardien `sans-chaine-visible-en-dur`
 * (L0-11) suit un identifiant ou un gabarit forwardé DIRECTEMENT dans une
 * requête d'écran, mais pas l'intérieur d'un appel de fonction — même
 * discipline que `dureeCarteAffichee` (`planning-largeur-et-carte.spec.ts`).
 */
function dureeAttendue(minutes: number): string {
  return `${enDuree(minutes)} (${decompte(minutes, fr["trajets.minute_une"], fr["trajets.minutes"])})`;
}

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
