/**
 * LES COULEURS DES STATUTS D'INTERVENTION — annexe D du cahier des charges,
 * PROMUE AU RANG DE RÈGLE (CLAUDE.md §1).
 *
 * *Le document de maquette est une illustration d'intention, pas une
 * spécification. Deux exceptions sont promues au rang de règle : le formatage
 * monétaire et les codes couleur des statuts.* Celle-ci en est une — et depuis
 * D95 la maquette fait foi sur les couleurs, si bien que les deux sources
 * disent désormais la même chose par deux chemins.
 *
 * **Ce que D95 change ici, et c'est tout ce qu'il change.** Les huit statuts
 * gardent exactement les couleurs que l'annexe D leur donne ; ce qui change est
 * la MANIÈRE de les écrire. Les classes de palette Tailwind — `bg-blue-200`,
 * `bg-red-600` — étaient des couleurs choisies par Tailwind, proches de la
 * charte sans en être. Elles nomment maintenant les JETONS d'apparence, dont
 * les valeurs sont celles de la maquette, elles-mêmes celles de l'annexe C.
 * *Une couleur « à peu près la bonne » est une couleur fausse : personne ne
 * l'aurait vue, et elle aurait vieilli dans le code.*
 *
 * **Pourquoi ce fichier est dans `lib/theme/` et nulle part ailleurs.** C'est
 * le seul endroit du dépôt où une couleur s'écrit en clair (CLAUDE.md §6), et
 * un gardien le tient (`tests/unit/theme/sans-couleur-en-dur.test.ts`). La
 * grille du planning et la fiche d'intervention la LISENT ici ; aucune des deux
 * n'en garde une copie, sans quoi les deux écrans finiraient par ne plus
 * s'accorder sur ce qu'est « en cours » (§9, 01/09).
 *
 * **Ce n'est PAS la charte de la société.** La charte est une donnée, propre à
 * chaque société, et elle vit dans les variables `--societe-*`. Les couleurs de
 * statut sont une RÈGLE du produit : « en cours » est rouge chez tout le monde,
 * parce que c'est un code de lecture partagé entre le planificateur et le
 * technicien, pas une préférence d'apparence.
 *
 * ## DEUX POINTS OÙ LA MAQUETTE ET L'ANNEXE D NE SE RECOUVRENT PAS
 *
 * Ils sont écrits plutôt que tranchés — *si la source est muette ou ambiguë,
 * on s'arrête et on demande* (CLAUDE.md §1 et §8). En attendant, la lecture
 * retenue est la plus conservatrice : elle n'invente aucune valeur, elle
 * n'emploie que des jetons que la maquette porte déjà.
 *
 * **1. « Envoyée » et « clôturée ».** L'annexe D les distingue de leurs
 * voisines par la profondeur — *bleu FONCÉ* contre bleu, *vert* contre *vert
 * CLAIR*. La maquette ne porte qu'UN style de bloc bleu et UN vert (`.ev.bl`,
 * `.ev.vt`) : sa légende compte six entrées pour huit statuts. Les deux jetons
 * « pleins » employés ici sont ceux de son onglet actif et de son bouton de
 * validation — `--bleu-plein`, `--vert-plein` —, c'est-à-dire les mêmes
 * couleurs à pleine saturation. Aucune valeur nouvelle n'est introduite.
 *
 * **2. « Suspendue : orange HACHURÉ ».** L'annexe D demande une hachure ; la
 * maquette réserve sa trame au SITE FERMÉ (`.ferme`), et peint la suspension
 * en orange plein. Donner la trame aux deux rendrait indiscernables « ce
 * technicien est suspendu » et « ce jour n'est pas ouvert » — un contresens de
 * lecture sur l'écran même qui sert à poser un rendez-vous. L'orange plein de
 * la maquette est donc retenu, et la question va au registre.
 */

/** Les huit statuts du cycle de vie, dans l'ordre de l'annexe D. */
export type StatutAffiche =
  | "a_planifier"
  | "planifiee"
  | "affectee"
  | "en_cours"
  | "suspendue"
  | "terminee"
  | "cloturee"
  | "annulee";

/**
 * Les classes utilitaires qui portent la couleur de chaque statut, sous la
 * forme d'une PASTILLE — fond teinté, encre lisible sur ce fond.
 *
 * C'est `.b-*` de la maquette : une pastille de liste ou de fiche.
 */
export const CLASSES_STATUT: Record<StatutAffiche, string> = {
  a_planifier: "bg-app-gris-fond text-app-gris-encre",
  planifiee: "bg-app-bleu-fond text-app-bleu-encre",
  affectee: "bg-app-bleu-plein text-app-bleu-plein-encre",
  en_cours: "bg-app-rouge-fond text-app-rouge-encre",
  suspendue: "bg-app-orange-fond text-app-orange-encre",
  terminee: "bg-app-vert-fond text-app-vert-encre",
  cloturee: "bg-app-vert-plein text-app-vert-plein-encre",
  annulee: "bg-app-gris-fond text-app-encre-faible line-through",
};

/**
 * Les classes du BLOC d'intervention posé dans une case de la grille — `.ev.*`
 * de la maquette : fond teinté, **liseré gauche de 3 px** à la couleur pleine.
 *
 * **Ce n'est pas une seconde écriture des couleurs ci-dessus, c'est un second
 * USAGE des mêmes jetons.** Une pastille et un bloc de calendrier ne se lisent
 * pas de la même façon — l'une est un mot dans une ligne, l'autre un objet
 * qu'on saisit —, et la maquette leur donne deux formes. Les valeurs, elles,
 * viennent du même endroit : changer `--app-rouge-bord` change les deux.
 */
export const CLASSES_BLOC: Record<StatutAffiche, string> = {
  a_planifier: "bg-app-gris-fond text-app-gris-encre border-app-gris-bord",
  planifiee: "bg-app-bleu-fond text-app-bleu-encre border-app-bleu-bord",
  affectee: "bg-app-bleu-fond text-app-bleu-encre border-app-bleu-bord",
  en_cours: "bg-app-rouge-fond text-app-rouge-encre border-app-rouge-bord",
  suspendue: "bg-app-orange-fond text-app-orange-encre border-app-orange-bord",
  terminee: "bg-app-vert-fond text-app-vert-encre border-app-vert-bord",
  cloturee: "bg-app-vert-fond text-app-vert-encre border-app-vert-bord",
  annulee:
    "bg-app-gris-fond text-app-encre-faible border-app-gris-bord line-through",
};

/**
 * LA LÉGENDE — six entrées, celles de la maquette, dans son ordre.
 *
 * Elle est ici et non dans l'écran pour la raison qui vaut pour tout le
 * fichier : la légende et les blocs qu'elle explique doivent bouger ensemble.
 * Une légende recopiée dans un composant serait fausse au premier statut
 * ajouté, et *elle ne rougirait pas* — elle décrirait simplement autre chose
 * que ce qu'on voit à côté.
 *
 * `cle` est la clé de dictionnaire du libellé : aucun texte lisible n'est
 * écrit ici (CLAUDE.md §5).
 */
export const LEGENDE_PLANNING = [
  {
    cle: "planning.legende.planifiee",
    classes: "bg-app-bleu-fond border-app-bleu-bord",
  },
  {
    cle: "planning.legende.en_cours",
    classes: "bg-app-rouge-fond border-app-rouge-bord",
  },
  {
    cle: "planning.legende.terminee",
    classes: "bg-app-vert-fond border-app-vert-bord",
  },
  {
    cle: "planning.legende.suspendue",
    classes: "bg-app-orange-fond border-app-orange-bord",
  },
  {
    cle: "planning.legende.interne",
    classes: "bg-app-gris-fond border-app-gris-bord",
  },
  { cle: "planning.legende.ferme", classes: "trame-fermee border-app-bord" },
] as const;

/**
 * LE TON D'UN BANDEAU DE RETOUR — succès, avertissement, refus (L1-11).
 *
 * **Ce n'est pas un neuvième statut d'intervention.** « Le lot a été appliqué »
 * ou « une partie n'a pas pu être défaite » ne décrivent aucune intervention :
 * ce sont des comptes rendus d'un geste qu'on vient de faire. Mais la même
 * garantie doit tenir des deux côtés de l'écran — *un succès ne se dit pas
 * dans la couleur d'un refus* —, et inventer une quatrième palette pour trois
 * mots referait le travail que ce fichier a déjà fait : les trois tons
 * empruntent donc aux MÊMES familles que les statuts ci-dessus — vert, orange,
 * rouge —, avec le même contraste vérifié à 4,5:1.
 *
 * *Mesuré le 16/09/2026 : l'écran de rapport d'un import affichait « Le lot a
 * été appliqué » — un succès — dans le bandeau rouge du refus, faute d'un
 * second habillage.*
 */
export type TonMessage = "succes" | "avertissement" | "refus";

/** Le bandeau — fond teinté, bordure et encre assortie, comme les refus déjà écrits à l'écran. */
export const CLASSES_TON: Record<TonMessage, string> = {
  succes: "border-app-vert-bord bg-app-vert-fond text-app-vert-encre",
  avertissement:
    "border-app-orange-bord bg-app-orange-fond text-app-orange-encre",
  refus: "border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre",
};
