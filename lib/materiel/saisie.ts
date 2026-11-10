import { z } from "zod";

/**
 * SAISIE DES FAMILLES ET MODÈLES DE MATÉRIEL (ticket L1-05).
 *
 * ## Ce que ce module est, et ce qu'il n'est pas
 *
 * L'entrée serveur, validée par Zod sans exception (CLAUDE.md §2). Il ne porte
 * **aucune énumération** : ni les familles, ni les marques, ni les références.
 *
 * **Et c'est le fond du ticket, pas une économie.** D4 rangeait ces tables parmi
 * les référentiels de plateforme, avec un catalogue partagé qu'une société
 * pouvait surcharger par copie. L'amendement du 08/09/2026 retire ce mécanisme :
 * *chez CODIMA, les modèles viennent du fichier de suivi — équipement, marque,
 * modèle, numéro de série —, pas d'un catalogue d'éditeur.* Ce sont des données
 * saisies, et une liste close ici serait la même faute, déplacée d'une couche.
 *
 * C'est le raisonnement des **zones géographiques** pris à l'envers, et il faut
 * le dire pour que les deux ne se lisent pas comme une contradiction : les zones
 * sont closes à l'entrée serveur parce qu'elles ne bougeront pas — six valeurs
 * d'UN territoire. Les familles de matériel bougeront à chaque société.
 *
 * ## Les bornes qui restent, et pourquoi elles sont EN BASE aussi
 *
 * Ni code, ni libellé, ni marque, ni référence vides ; les périodicités
 * strictement positives. Ces bornes sont vraies de la **donnée elle-même**, pas
 * du formulaire : l'import Excel (L1-08) et une correction manuelle sont deux
 * chemins de plus, et la migration les porte en `CHECK`. Zod les répète pour que
 * le refus arrive à l'écran plutôt qu'en `500`.
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

/**
 * Une périodicité en jours ou au compteur, NULLE quand la maintenance n'est pas
 * périodique.
 *
 * **Aucune valeur par défaut** : une périodicité est une décision
 * d'exploitation, jamais un défaut technique (CLAUDE.md §8). Et zéro n'est pas
 * une périodicité — une maintenance due tous les zéro jours est due en
 * permanence.
 */
const periodicite = z.number().int().positive().nullable();

export const schemaFamilleMateriel = z.object({
  code: texteNonVide,
  libelle: texteNonVide,
  actif: z.boolean().default(true),
});

export type SaisieFamilleMateriel = z.infer<typeof schemaFamilleMateriel>;

/**
 * SAISIE D'UN SOUS-TYPE STRUCTURÉ (ticket 9K17A, décision d'Alexis du
 * 10/11/2026, D238) — même discipline que `schemaFamilleMateriel` : aucune
 * énumération, le sous-type est une DONNÉE SAISIE, propre à chaque société
 * ET à chaque famille.
 */
export const schemaSousTypeMateriel = z.object({
  /**
   * La famille est NOMMÉE par son identifiant, même raisonnement que
   * `famille_id` de `schemaModeleMateriel` ci-dessous : la base vérifie
   * qu'elle appartient à la même société par une clé étrangère composite.
   */
  famille_id: z.uuid(),
  code: texteNonVide,
  libelle: texteNonVide,
  actif: z.boolean().default(true),
});

export type SaisieSousTypeMateriel = z.infer<typeof schemaSousTypeMateriel>;

export const schemaModeleMateriel = z.object({
  /**
   * La famille est NOMMÉE par son identifiant, et la base vérifie qu'elle
   * appartient à la même société : la clé étrangère est composite
   * `(societe_id, famille_id)`, et les contrôles d'intégrité référentielle
   * contournent les politiques RLS par construction. Sans la société dans la
   * clé, le verrou serait muet là où le cloisonnement doit mordre.
   */
  famille_id: z.uuid(),
  /**
   * FACULTATIF (D238) — la base vérifie en plus qu'il appartient à LA MÊME
   * FAMILLE que `famille_id` ci-dessus, par une clé étrangère composite à
   * TROIS colonnes : un sous-type d'une autre famille est refusé PAR LA CLÉ,
   * jamais par une comparaison écrite ici.
   */
  sous_type_id: z.uuid().nullable().default(null),
  marque: texteNonVide,
  reference: texteNonVide,
  /**
   * Le chapitre 11 les nomme ; leur CONTENU n'est fixé par personne, et ce
   * n'est pas à une validation de l'inventer.
   */
  caracteristiques: z.record(z.string(), z.unknown()).nullable().default(null),
  periodicite_jours: periodicite.default(null),
  periodicite_compteur: periodicite.default(null),
  actif: z.boolean().default(true),
});

export type SaisieModeleMateriel = z.infer<typeof schemaModeleMateriel>;

/**
 * BORNES DE LA RECHERCHE DE MODÈLES (SELECTEURS-1, 24/09/2026) — même
 * contrat que `LIMITE_RECHERCHE_PAR_DEFAUT`/`MAXIMALE` de `lib/clients/saisie.ts`
 * et `lib/sites/saisie.ts` : un maximum PAR REQUÊTE, jamais sur ce qu'on peut
 * voir.
 */
export const LIMITE_RECHERCHE_MODELE_PAR_DEFAUT = 20;
export const LIMITE_RECHERCHE_MODELE_MAXIMALE = 200;

/**
 * Critères de recherche d'un modèle — le sélecteur de `/parc/nouvelle`
 * (SELECTEURS-1). `texte` cherche dans la marque ET la référence, les deux
 * façons dont un modèle se désigne.
 */
export const schemaRechercheModele = z
  .object({
    texte: z
      .string()
      .trim()
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
    famille_id: z.uuid().nullable().default(null),
    limite: z
      .number()
      .int()
      .min(1)
      .max(LIMITE_RECHERCHE_MODELE_MAXIMALE)
      .default(LIMITE_RECHERCHE_MODELE_PAR_DEFAUT),
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();
export type RechercheModele = z.output<typeof schemaRechercheModele>;
