/**
 * LES COULEURS DES STATUTS D'INTERVENTION — annexe D du cahier des charges,
 * PROMUE AU RANG DE RÈGLE (CLAUDE.md §1).
 *
 * *Le document de maquette est une illustration d'intention, pas une
 * spécification. Deux exceptions sont promues au rang de règle : le formatage
 * monétaire et les codes couleur des statuts.* Celle-ci en est une.
 *
 * **Pourquoi ce fichier est dans `lib/theme/` et nulle part ailleurs.** C'est
 * le seul endroit du dépôt où une couleur s'écrit en clair (CLAUDE.md §6), et
 * un gardien le tient (`tests/unit/theme/sans-couleur-en-dur.test.ts`). La
 * liste du planning et la fiche d'intervention la LISENT ici ; aucune des deux
 * n'en garde une copie, sans quoi les deux écrans finiraient par ne plus
 * s'accorder sur ce qu'est « en cours » (§9, 01/09).
 *
 * **Ce n'est PAS la charte de la société.** La charte est une donnée, propre à
 * chaque société, et elle vit dans les variables CSS. Les couleurs de statut
 * sont une RÈGLE du produit : « en cours » est rouge chez tout le monde, parce
 * que c'est un code de lecture partagé entre le planificateur et le technicien,
 * pas une préférence d'apparence.
 *
 * La correspondance avec l'annexe D, mot pour mot : à planifier gris ;
 * planifiée bleu ; envoyée bleu foncé ; en cours rouge ; suspendue orange ;
 * terminée vert clair ; clôturée vert ; annulée gris barré.
 */

/** Les huit statuts du cycle de vie, dans l'ordre de l'annexe D. */
export type StatutAffiche =
  | "a_planifier"
  | "planifiee"
  | "envoyee"
  | "en_cours"
  | "suspendue"
  | "terminee"
  | "cloturee"
  | "annulee";

/** Les classes utilitaires qui portent la couleur de chaque statut. */
export const CLASSES_STATUT: Record<StatutAffiche, string> = {
  a_planifier: "bg-neutral-200 text-neutral-900",
  planifiee: "bg-blue-200 text-blue-950",
  envoyee: "bg-blue-700 text-white",
  en_cours: "bg-red-600 text-white",
  suspendue: "bg-orange-300 text-orange-950",
  terminee: "bg-green-200 text-green-950",
  cloturee: "bg-green-700 text-white",
  annulee: "bg-neutral-200 text-neutral-500 line-through",
};
