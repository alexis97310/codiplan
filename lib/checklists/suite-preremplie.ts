import { t } from "@/lib/i18n/fr";

/**
 * LA LIGNE PRÉREMPLIE D'UN POINT NON CONFORME (9K21-CHECKLIST-TERRAIN-
 * SAISIE, CK5, point 3) — « <section> — <libellé> : Non conforme », composée
 * avec les MÊMES séparateurs que le reste de l'écran terrain
 * (`ponctuation.separateur`, `ponctuation.deux_points` — voir
 * `app/(mobile)/terrain/[id]/page.tsx`), jamais un tiret ou des deux-points
 * écrits en dur dans ce fichier.
 *
 * FONCTION PURE, testable sans React : `checklist-terrain.tsx` l'appelle
 * pour composer le signal envoyé à `RapportTerrainAutomatique`
 * (`EVENEMENT_CHECKLIST_NON_CONFORME`, `lib/terrain/file-saisies.ts`).
 */
export function ligneNonConforme(section: string, libelle: string): string {
  return `${section}${t("ponctuation.separateur")}${libelle}${t(
    "ponctuation.deux_points",
  )}${t("checklist.terrain.non_conforme")}`;
}

/**
 * AJOUTE `ligne` À `suiteActuelle`, JAMAIS EN DOUBLE (point 3 du ticket) —
 * une simple présence dans le texte COURANT suffit à ne pas la répéter,
 * qu'elle y soit depuis cette session ou qu'un technicien l'y ait laissée
 * d'une précédente. Si le technicien l'a EFFACÉE lui-même, un nouveau
 * passage à « non conforme » la réécrit — cette fonction ne connaît que le
 * texte actuel, jamais un historique de ce qui a déjà été proposé.
 */
export function suiteAvecLigne(suiteActuelle: string, ligne: string): string {
  if (suiteActuelle.includes(ligne)) {
    return suiteActuelle;
  }
  return suiteActuelle.length === 0 ? ligne : `${suiteActuelle}\n${ligne}`;
}
