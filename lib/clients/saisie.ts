import { z } from "zod";

/**
 * Ce qu'on a le droit d'écrire sur une fiche client — validation d'entrée
 * (ticket L1-01 ; chapitre 11.2 ; RG-IMP-05 amendée par D29 ; CLAUDE.md §2 :
 * Zod sur toute entrée serveur, sans exception).
 *
 * Ce module est PUR : aucune base, aucun contexte de session. C'est ce qui
 * permet d'éprouver les règles de saisie sans ouvrir de transaction, et ce qui
 * fait qu'elles sont les mêmes quel que soit le chemin — formulaire, action
 * serveur, ou l'import Excel de L1-08 quand il arrivera.
 *
 * **Ce qui n'est PAS contrôlé ici, et pourquoi ce n'est pas un oubli.**
 *   — le format du RIDET : le cahier des charges n'en donne aucun, et un motif
 *     inventé refuserait des données justes (CLAUDE.md §8) ;
 *   — la catégorie client et les conditions de règlement : le chapitre 11 les
 *     nomme sans les énumérer. Fermer une énumération avant d'avoir tranché à
 *     qui l'on vend est l'erreur du 20/08 (CLAUDE.md §9) ;
 *   — l'unicité du code externe : elle ne se décide pas sur une saisie isolée,
 *     elle se mesure en base. C'est l'index unique `(societe_id, code_externe)`
 *     qui la tient, et le dépôt en rend le refus lisible.
 *
 * **Et la société n'est JAMAIS une entrée.** Aucun schéma d'ici ne porte de
 * `societe_id` : il vient du contexte de session et de lui seul. Une société
 * transmise par l'appelant serait une habilitation auto-déclarée — c'est le
 * même raisonnement que `lib/auth/societe-active.ts` sur le rôle.
 */

/**
 * Texte facultatif : vide ou blanc se range en `null`, jamais en chaîne vide.
 *
 * **Sans `.default()`, et c'est le point.** Un défaut posé ici serait appliqué
 * AVANT `.optional()` du côté modification, si bien qu'une modification qui ne
 * mentionne pas un champ le recevrait à `null` — et l'effacerait. Le défaut est
 * donc ajouté par le seul schéma de CRÉATION, où « non fourni » veut
 * effectivement dire « vide ». Un test le tient
 * (`tests/unit/clients/saisie.test.ts`, « accepte une modification partielle »),
 * et c'est lui qui a trouvé la faute.
 */
const texteFacultatif = z
  .string()
  .trim()
  .transform((valeur) => (valeur.length === 0 ? null : valeur))
  .nullable();

/**
 * Raison sociale — obligatoire, non vide après suppression des blancs.
 *
 * La même exigence est posée en base (`client_raison_sociale_non_vide`), et ce
 * n'est pas une redondance décorative : Zod ne voit ni l'import Excel de L1-08,
 * ni une correction faite à la main. Le filtre applicatif est la première
 * barrière, la contrainte est celle que tous les chemins traversent — c'est le
 * principe de I1 appliqué à autre chose que le cloisonnement.
 */
const raisonSociale = z.string().trim().min(1).max(200);

/**
 * Code externe — clé de rapprochement à l'import (RG-IMP-05).
 *
 * Facultatif depuis D29 : « son absence ne suffit plus à rejeter la ligne ».
 * La chaîne vide est ramenée à `null` plutôt qu'acceptée : elle se lirait
 * « code renseigné » côté rapprochement et « code absent » côté humain, et
 * RG-IMP-05 distingue précisément ces deux cas.
 */
const codeExterne = z
  .string()
  .trim()
  .max(64)
  .transform((valeur) => (valeur.length === 0 ? null : valeur))
  .nullable();

/**
 * Adresse de facturation, en JSON comme `agence.adresse` (chapitre 11.2).
 *
 * `z.json()` sur les valeurs, et non `z.unknown()` : ce qui entre ici part en
 * base dans une colonne `jsonb`, et une valeur non sérialisable y échouerait à
 * l'écriture plutôt qu'à la validation. La forme INTERNE de l'adresse n'est en
 * revanche pas contrainte — une adresse calédonienne (boîte postale, tribu,
 * commune) n'a pas celle d'une adresse métropolitaine, et le cahier des charges
 * n'en fixe aucune.
 */
const adresseFacturation = z.record(z.string(), z.json()).nullable();

/**
 * Création d'une fiche client. L'identifiant est attribué par le serveur (I10),
 * et la société vient du contexte : ni l'un ni l'autre n'est une entrée, et le
 * schéma est `strict()` pour que les fournir soit un REFUS plutôt qu'un champ
 * ignoré en silence.
 *
 * Les défauts sont posés ICI et nulle part ailleurs : à la création, « non
 * fourni » veut bien dire « vide ».
 */
export const schemaCreationClient = z
  .object({
    code_externe: codeExterne.default(null),
    raison_sociale: raisonSociale,
    ridet: texteFacultatif.default(null),
    categorie: texteFacultatif.default(null),
    adresse_facturation: adresseFacturation.default(null),
    conditions_reglement: texteFacultatif.default(null),
    commercial_referent: texteFacultatif.default(null),
    actif: z.boolean().default(true),
  })
  .strict();
export type CreationClient = z.output<typeof schemaCreationClient>;

/**
 * Modification d'une fiche client. Tous les champs sont facultatifs — une
 * modification partielle est le cas normal —, mais `raison_sociale` reste non
 * vide si elle est fournie : on n'efface pas le nom d'un client par omission.
 *
 * **Aucun défaut ici.** `undefined` signifie « ne touche pas à cette colonne »,
 * `null` signifie « efface-la », et le dépôt tient les deux séparés. Un
 * `.default(null)` transformerait toute modification partielle en effacement
 * de tout ce qu'elle ne mentionne pas.
 */
export const schemaModificationClient = z
  .object({
    code_externe: codeExterne.optional(),
    raison_sociale: raisonSociale.optional(),
    ridet: texteFacultatif.optional(),
    categorie: texteFacultatif.optional(),
    adresse_facturation: adresseFacturation.optional(),
    conditions_reglement: texteFacultatif.optional(),
    commercial_referent: texteFacultatif.optional(),
    actif: z.boolean().optional(),
  })
  .strict();
export type ModificationClient = z.output<typeof schemaModificationClient>;

/**
 * Nombre maximal de fiches rendues par une recherche.
 *
 * La volumétrie du chapitre 11.3 est de 200 à 500 clients actifs à trois ans :
 * la borne n'est donc pas une pagination — elle n'a rien à paginer — mais un
 * garde-fou contre une requête qui ramènerait tout le référentiel d'un coup
 * depuis Nouméa. Elle est explicite plutôt que laissée au défaut de personne :
 * c'est la leçon du 23/08 sur les délais.
 */
export const LIMITE_RECHERCHE_PAR_DEFAUT = 50;
export const LIMITE_RECHERCHE_MAXIMALE = 200;

/**
 * Critères de recherche (« recherche », ticket L1-01).
 *
 * `texte` cherche à la fois dans la raison sociale et dans le code externe :
 * ce sont les deux façons dont l'ADV désigne un client au téléphone, et ce sont
 * les deux clés de rapprochement de RG-IMP-05.
 */
export const schemaRechercheClient = z
  .object({
    texte: z
      .string()
      .trim()
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
    actifs_seulement: z.boolean().default(false),
    limite: z
      .number()
      .int()
      .min(1)
      .max(LIMITE_RECHERCHE_MAXIMALE)
      .default(LIMITE_RECHERCHE_PAR_DEFAUT),
    /**
     * LA PAGE, 1-INDEXÉE (AT-07). L'état de la pagination vit dans l'URL —
     * jamais dans un état de composant — et cette page-ci est donc une entrée
     * comme une autre, validée comme toute entrée serveur (§2).
     */
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();
export type RechercheClient = z.output<typeof schemaRechercheClient>;
