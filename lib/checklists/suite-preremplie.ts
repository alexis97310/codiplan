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
 * LE NOM D'UN POINT, « <section> — <libellé> » (9K23-CHECKLIST-BLOCAGE-
 * TERMINER, CK7) — même séparateur que `ligneNonConforme`, sans suffixe :
 * utilisé pour NOMMER un point obligatoire sans réponse dans le refus de
 * « Terminer » et sur le lien qui y saute.
 */
export function libelleDuPoint(section: string, libelle: string): string {
  return `${section}${t("ponctuation.separateur")}${libelle}`;
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

/** Même garde anti-doublon que `suiteAvecLigne`, pour plusieurs lignes à la fois. */
export function suiteAvecLignes(
  suiteActuelle: string,
  lignes: readonly string[],
): string {
  return lignes.reduce(suiteAvecLigne, suiteActuelle);
}

/**
 * UN POINT NON CONFORME, TEL QUE « REPRENDRE LA NON-CONFORMITÉ DE LA
 * CHECKLIST » LE NOMME (9L04F-TERRAIN-RAPPORT-PHRASES-TYPES, point 3) —
 * `id` ne sert à rien à `lignesReprise` ci-dessous, mais voyage dans ce type
 * pour que 9L04I (le détail par point : suite, commentaire) puisse
 * s'ancrer sur lui sans changer cette forme.
 */
export type PointNonConformePourReprise = {
  readonly id: string;
  readonly section: string;
  readonly libelle: string;
};

/**
 * UNE LIGNE PAR POINT NON CONFORME (point 3 du ticket) — RÉUTILISE
 * `ligneNonConforme` : même format que l'ajout automatique de CK5 (9K21),
 * pour que le signal à la saisie et ce lien de reprise produisent toujours
 * la même ligne pour le même fait.
 */
export function lignesReprise(
  points: readonly PointNonConformePourReprise[],
): readonly string[] {
  return points.map((point) => ligneNonConforme(point.section, point.libelle));
}
