/**
 * CE QUE LE CLASSEUR D'ÉPREUVE CONTIENT — écrit UNE FOIS (L1-11 ; I9).
 *
 * ## Pourquoi ces valeurs vivent ici et non dans le script qui les écrit
 *
 * Trois lecteurs en ont besoin : le script qui fabrique le classeur, le gardien
 * qui vérifie qu'il ne porte que des noms inventés, et le scénario de bout en
 * bout qui cherche ces noms à l'écran. *Trois recopies de la même donnée, et
 * rien ne les confronterait* — la seconde deviendrait fausse le jour où la
 * première change, sans rougir (§9, 01/09).
 *
 * ## Et il y a une seconde raison, mesurée
 *
 * Le gardien des chaînes visibles (L0-11) lit tout fichier qui interroge un
 * écran, et **il a rangé « Atelier Lisière Bleue » sous « chaîne visible écrite
 * en dur »** — à bon droit : il ne peut pas distinguer une donnée d'épreuve
 * d'un libellé. *C'est la DESTINATION d'un texte qui décide, et il ne peut pas
 * la lire.* Nommer la constante suffit ; c'est la même parade que
 * `lib/navigation/portes-parametrage.ts`.
 *
 * ## LES NOMS SONT INVENTÉS, ET DÉLIBÉRÉMENT INVRAISEMBLABLES
 *
 * *Aucun fichier de données réelles n'entre au dépôt, jamais* (I9), et le dépôt
 * est PUBLIC depuis le 12/09/2026 — **un dépôt rendu public publie aussi son
 * passé**. Un nom plausible finirait par ressembler à un client réel, et la
 * ressemblance est exactement ce dont I9 se méfie.
 */

export const MARQUEUR_EPREUVE = "CODIPLAN-clients-v1";

export const ENTETES_EPREUVE = [
  "Code externe",
  "Raison sociale",
  "RIDET",
  "Catégorie",
  "Conditions de règlement",
  "Commercial référent",
] as const;

/**
 * LES TROIS LIGNES, ET LA TROISIÈME EST LE CŒUR DE L'ÉPREUVE.
 *
 * Elle n'a **pas de raison sociale** — la seule colonne obligatoire du modèle —
 * et part donc en REJET avec son motif. *Une épreuve où tout passe ne montre
 * pas le rapport qu'on vient éprouver* : c'est la ligne rejetée qui prouve que
 * l'écran distingue ce qui sera écrit de ce qui ne le sera pas.
 */
export const LIGNES_EPREUVE: ReadonlyArray<readonly string[]> = [
  [
    "FIX-001",
    "Atelier Lisière Bleue",
    "1111111.001",
    "",
    "30 jours",
    "A. Ipsum",
  ],
  ["FIX-002", "Fonderie Papillon", "", "", "", ""],
  ["FIX-003", "", "", "", "", ""],
];

/** Les raisons sociales que le classeur porte — celles-là et aucune autre. */
export const RAISONS_INVENTEES: readonly string[] = LIGNES_EPREUVE.map(
  (ligne) => ligne[1] ?? "",
).filter((raison) => raison !== "");

/**
 * Ce que le rapport doit annoncer sur un parc VIDE — **dérivé des lignes**,
 * jamais écrit à côté d'elles. *Décider deux fois la même chose est la
 * divergence du §9* : ajouter une quatrième ligne ci-dessus change ces deux
 * nombres le jour même.
 */
export const CREATIONS_ATTENDUES = RAISONS_INVENTEES.length;
export const REJETS_ATTENDUS = LIGNES_EPREUVE.length - CREATIONS_ATTENDUES;

/** Le chemin du classeur, relatif à la racine du dépôt. */
export const CHEMIN_EPREUVE = "tests/fixtures/clients-fabrique.xlsx";
