import { z } from "zod";

/**
 * SAISIE DU CATALOGUE DES PRESTATIONS (L1-12 ; D109, D113).
 *
 * ## LA RÈGLE QUI GOUVERNE CE FICHIER
 *
 * > **UNE PRESTATION PORTE UNE DURÉE, JAMAIS UN TAUX** *(D109)*.
 *
 * *Une facture ne change pas quand un tarif change* — c'est RG-TAR-04, et c'est
 * `lib/tarification/` tout entier, qui refuse jusqu'à une fonction « le taux
 * courant ». **Deux endroits qui portent un prix, c'est une préséance à
 * inventer et une seconde historisation à tenir, pour rien.**
 *
 * **Aucun champ de ce module ne porte un montant, et un gardien le refuse** :
 * `tests/unit/prestations/aucun-montant.test.ts`.
 *
 * ## ET ELLE NE DÉSIGNE AUCUN FORFAIT NON PLUS *(D113, 12/09/2026)*
 *
 * Le pont de D109 — *« quand une prestation se vend à prix fixe, elle DÉSIGNE un
 * forfait »* — vaut au sens où **l'intervention** qui exécute cette prestation
 * reçoit le forfait par les trois axes de RG-TAR-06, jamais au sens d'une clé
 * étrangère portée par le catalogue.
 *
 * *La colonne `forfait_id` a été écartée pour une raison mesurable* : elle
 * aurait fait naître une question que personne n'a posée — **que se passe-t-il
 * si le forfait désigné ne s'applique pas à la zone de l'intervention ?** Les
 * trois axes peuvent le disqualifier, et il aurait fallu arbitrer d'avance une
 * préséance entre deux sélections de forfait. *Une question qui disparaît vaut
 * mieux qu'une question arbitrée d'avance.*
 *
 * ## PROPRE À CHAQUE SOCIÉTÉ, et la raison n'est pas technique
 *
 * `societe_id NOT NULL`, table métier de la première catégorie de I1, auditée à
 * sa naissance (I8, périmètre inversé de D55). *Une durée standard et une
 * checklist décrivent la façon de travailler d'une entreprise et le niveau de
 * ses techniciens* — et le jour où CODIPLAN est vendu à un concurrent de
 * CODIMA, il n'héritera pas de ce catalogue.
 *
 * ## AUCUNE ÉNUMÉRATION DE PRESTATIONS
 *
 * Ni codes, ni libellés, ni durées de référence. C'est le raisonnement de
 * `lib/materiel/saisie.ts` : *les familles de matériel bougeront à chaque
 * société*, et les prestations davantage encore — elles sont le métier lui-même.
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

/**
 * LA DURÉE STANDARD, EN MINUTES — et elle est FACULTATIVE.
 *
 * **Aucune valeur par défaut** : une durée standard est une donnée
 * d'exploitation, et le §8 interdit d'inventer un délai. `null` dit « personne
 * ne l'a encore estimée », ce qui est un état ordinaire d'un catalogue qu'on
 * remplit — *et qui ne se confond pas avec zéro, qui dirait « instantané ».*
 *
 * **Zéro est refusé pour cette raison exacte**, comme la périodicité de
 * `lib/materiel/saisie.ts` : une prestation qui dure zéro minute n'est pas une
 * prestation.
 */
const dureeStandard = z.number().int().positive().nullable();

export const schemaPrestation = z.object({
  code: texteNonVide,
  libelle: texteNonVide,
  /**
   * La famille est NOMMÉE par son identifiant, et la base vérifie qu'elle
   * appartient à la même société : la clé étrangère est composite
   * `(societe_id, famille_id)`. *Sans la société dans la clé, le verrou serait
   * muet là où le cloisonnement doit mordre* — la leçon de `modele_materiel`.
   *
   * **Facultative** : une prestation peut ne viser aucune famille — un
   * déplacement, un diagnostic, une formation.
   */
  famille_id: z.uuid().nullable().default(null),
  duree_standard_min: dureeStandard.default(null),
  /**
   * LA CHECKLIST TYPE — un texte libre, et c'est délibéré.
   *
   * Le chapitre 10 ne pose aucune structure de checklist, et en inventer une
   * ici la figerait pour toutes les sociétés avant que quiconque en ait écrit
   * une seule. *Fermer une énumération avant d'avoir tranché à qui l'on vend est
   * une erreur que ce dépôt a déjà faite* (§9, 20/08).
   */
  checklist_type: z.string().trim().nullable().default(null),
  actif: z.boolean().default(true),
});

export type SaisiePrestation = z.infer<typeof schemaPrestation>;
