/**
 * LA COPIE ANCIENNE, TOLÉRÉE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1).
 *
 * `lireCopie` (`copie-locale.ts`) rend l'objet IndexedDB TEL QUEL, sans
 * contrôle de forme ni de version (voir son en-tête). `catalogue` (sur
 * l'instantané) et `prestationsRealiseesIds` (sur chaque fiche) sont nés tous
 * les deux au même point de 9F4H6 : une copie écrite par un appareil AVANT ce
 * lot, et jamais rafraîchie depuis (pas de réseau, pas de nouvel instantané),
 * ne les porte pas. Sans ce fichier, `catalogue.map(...)` dans
 * `components/terrain/consultation-hors-reseau.tsx` lève sur `undefined` —
 * le mode hors réseau cesse de fonctionner pour ce téléphone précis.
 *
 * ## DEUX ABSENCES, DEUX RÉPONSES DIFFÉRENTES
 *
 * `catalogue` absent devient `[]` — le même cas que « catalogue jamais
 * emporté » que `terrain.prestations.catalogue_indisponible_hors_reseau`
 * nomme déjà (9F4H4B-OUVERTURE-A-FROID) : aucune nouvelle clé n'est due.
 *
 * `prestationsRealiseesIds` absent devient `[]` AUSSI, mais avec un second
 * signal, `indisponibles: true` — jamais un simple ensemble vide : un
 * ensemble vide dirait « rien n'a été fait », quand la vérité est « on ne
 * sait pas ». `components/terrain/consultation-hors-reseau.tsx` lit ce
 * signal pour rendre les prestations NON cochables sur cette fiche plutôt que
 * de risquer d'écraser un travail déjà réalisé, servi au prochain
 * « Terminer » sous un ensemble vide.
 */

import type {
  FicheJSON,
  InstantaneJSON,
} from "@/app/api/terrain/instantane/route";

/** `copie.catalogue`, sûr quelle que soit l'ancienneté de la copie. */
export function catalogueDeLaCopie(copie: InstantaneJSON): {
  readonly catalogue: InstantaneJSON["catalogue"];
  readonly indisponible: boolean;
} {
  return Array.isArray(copie.catalogue)
    ? { catalogue: copie.catalogue, indisponible: false }
    : { catalogue: [], indisponible: true };
}

/** `fiche.prestationsRealiseesIds`, sûr — voir l'en-tête : `[]` ne veut
 * jamais dire « rien de fait » quand `indisponibles` est vrai. */
export function prestationsRealiseesDeLaFiche(fiche: FicheJSON): {
  readonly ids: readonly string[];
  readonly indisponibles: boolean;
} {
  return Array.isArray(fiche.prestationsRealiseesIds)
    ? { ids: fiche.prestationsRealiseesIds, indisponibles: false }
    : { ids: [], indisponibles: true };
}
