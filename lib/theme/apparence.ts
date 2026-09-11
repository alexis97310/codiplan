/**
 * L'APPARENCE — le jeu de jetons visuels de l'application (D95).
 *
 * ## Ce que ce module est, et ce qu'il n'est pas
 *
 * **Ce n'est pas la charte d'une société.** La charte est une DONNÉE, propre à
 * chaque société, et elle vit dans les six variables `--societe-*` posées par
 * `variables.ts`. L'apparence, elle, est le socle sur lequel cette charte se
 * pose : surfaces, bordures, encres, et les cinq familles de couleur que les
 * statuts d'intervention empruntent.
 *
 * **Ce n'est pas non plus une liste de couleurs.** Aucune valeur n'est écrite
 * ici : les palettes sont déclarées dans `app/globals.css`, sous la seule forme
 * qu'une feuille de style admet pour une couleur — une DÉCLARATION DE VARIABLE.
 * Ce module ne porte que les NOMS, l'apparence par défaut, et de quoi garder
 * les deux.
 *
 * ## Pourquoi ajouter un thème ne demandera de toucher à aucun écran
 *
 * Un écran ne nomme jamais une couleur : il nomme un RÔLE — `bg-app-surface`,
 * `text-app-encre-faible`. Le rôle est résolu par la variable, la variable est
 * choisie par l'attribut `data-apparence` posé sur le document, et l'attribut
 * vient d'ici. Ajouter « le tableau » comme second thème, c'est écrire un bloc
 * `[data-apparence="tableau"]` dans la feuille de style et une entrée dans
 * `APPARENCES` — et rien d'autre. *Le jour où le thème deviendra une propriété
 * de la société, c'est cette fonction de choix qui lira la base ; les écrans ne
 * bougeront pas davantage.*
 *
 * ## Ce qui est délibérément ABSENT
 *
 * **Le sélecteur.** D95 le renvoie explicitement à plus tard : ce qui est dû
 * ici est que l'ajout soit possible sans reprise, pas que le choix soit offert.
 * Une interface de choix sans second thème à choisir serait un réglage sans
 * usage — la faute exacte que `parametrage.ts` évite sur les créneaux.
 *
 * **Une apparence sombre.** La maquette, qui fait foi depuis D95, n'en décrit
 * aucune. En inventer une serait inventer des couleurs que personne n'a
 * validées ; c'est un second thème, et il se décide.
 */

/**
 * Les apparences connues. **Liste close**, gardée dans les deux sens par
 * `tests/unit/theme/apparence.test.ts` : toute entrée doit avoir son bloc de
 * déclaration dans `app/globals.css`, et tout bloc doit avoir son entrée.
 *
 * *Le retrait est le sens silencieux* — une entrée retirée laisse un bloc CSS
 * que plus rien ne désigne, et le document retombe sur l'apparence par défaut
 * sans qu'aucun écran ne change de forme visible.
 */
export const APPARENCES = ["maquette"] as const;

export type Apparence = (typeof APPARENCES)[number];

/**
 * L'APPARENCE PAR DÉFAUT — celle de `docs/CODIPLAN_Maquette.html` (D95).
 *
 * La maquette a été validée au départ du projet et fait foi sur la disposition
 * comme sur les couleurs. Ses jetons sont ceux de l'annexe C du cahier des
 * charges, à la valeur près — ce n'est donc pas une palette nouvelle, c'est la
 * charte du produit enfin appliquée.
 */
export const APPARENCE_PAR_DEFAUT: Apparence = "maquette";

/**
 * Les jetons qu'une apparence DOIT définir, tous sans exception.
 *
 * **C'est le contrat, et il est gardé dans les deux sens.** Une apparence à qui
 * il manque un jeton rendrait un écran à moitié peint — et pas au hasard :
 * l'écran qui emploie précisément ce rôle. Un jeton déclaré ici mais utilisé
 * nulle part est l'autre moitié du défaut, et le gardien le refuse aussi.
 *
 * Les cinq FAMILLES de couleur — bleu, rouge, vert, orange, gris — portent
 * chacune trois jetons : un fond, une bordure, une encre. C'est la forme exacte
 * des blocs d'intervention de la maquette (`.ev.bl`, `.ev.rg`, …) et des
 * pastilles de priorité (`.b-p1`, …) ; les statuts d'intervention s'y adossent
 * sans qu'aucun n'écrive de couleur (voir `statuts.ts`).
 */
export const JETONS = [
  // Surfaces et texte.
  "fond",
  "surface",
  "surface-creuse",
  "bord",
  "bord-faible",
  "encre",
  "encre-faible",
  // Identité de la plateforme — le bleu et le rouge de l'annexe C.
  "marque",
  "marque-encre",
  "accent",
  "accent-encre",
  // Les cinq familles, fond / bordure / encre.
  "bleu-fond",
  "bleu-bord",
  "bleu-encre",
  "rouge-fond",
  "rouge-bord",
  "rouge-encre",
  "vert-fond",
  "vert-bord",
  "vert-encre",
  "orange-fond",
  "orange-bord",
  "orange-encre",
  "gris-fond",
  "gris-bord",
  "gris-encre",
  // Les deux pleins : la maquette les emploie pour l'onglet actif et pour ses
  // boutons de validation, et les statuts « envoyée » et « clôturée » de
  // l'annexe D — bleu FONCÉ, vert PLEIN — n'ont pas d'autre support.
  "bleu-plein",
  "bleu-plein-encre",
  "vert-plein",
  "vert-plein-encre",
] as const;

export type Jeton = (typeof JETONS)[number];

/** Le nom de la variable CSS qui porte un jeton. */
export function variableDuJeton(jeton: Jeton): string {
  return `--app-${jeton}`;
}

/**
 * LA LARGEUR UTILE, en pixels — `.wrap{max-width:1400px}` de la maquette.
 *
 * Elle est ici plutôt que dans une classe parce qu'un gardien la lit : une
 * largeur écrite dans un écran serait une largeur par écran, et c'est très
 * exactement l'état mesuré le 11/09/2026 — cinq écrans, cinq largeurs, de 448
 * à 1024 px, aucune valant celle de la maquette.
 */
export const LARGEUR_UTILE_PX = 1400;
