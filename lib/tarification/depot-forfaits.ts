import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import type { SaisieForfait } from "./forfaits";

/**
 * LE CHEMIN D'ÉCRITURE DU CATALOGUE DE FORFAITS (R2-20).
 *
 * ## Ce qu'il répare
 *
 * L1-06 a livré la RÈGLE — les trois axes, le rang, `forfaitRetenu` —, la BASE
 * et l'écran de LECTURE. **Rien ne créait un forfait.** *Le catalogue naît vide
 * par décision, et il le restait : l'exploitation n'avait aucun moyen d'y
 * mettre une ligne autrement qu'en SQL.* Une règle de tarification que personne
 * ne peut alimenter est une règle qui ne s'applique jamais.
 *
 * ## « AUCUNE CONDITION » S'ÉCRIT `NULL`, ET PRISMA NE SAIT PAS L'ÉCRIRE
 *
 * C'est la mesure qui a décidé de la forme de ce module, et elle contredit
 * l'hypothèse du ticket. Trois faits, mesurés le 13/09/2026 :
 *
 * | Ce qui a été mesuré | Résultat |
 * |---|---|
 * | la contrainte `condition_multivaluee_valide` | accepte `NULL`, **refuse `{}`**, refuse les doublons |
 * | `Prisma.ForfaitCreateInput["zone_geo"] = null` | **refusé par le compilateur** — `ForfaitCreatezone_geoInput \| string[] \| undefined` |
 * | une création qui OMET la colonne | la ligne ressort **`zone_geo = null`** |
 *
 * **La troisième ligne est la solution, et le ticket l'avait manquée** : il
 * annonçait que *« le chemin d'écriture devra passer par du SQL explicite »*.
 * Il n'en a pas besoin à la CRÉATION — une colonne nullable et sans `DEFAULT`
 * qu'on n'écrit pas reçoit `NULL`. *Le §2 interdit le SQL brut hors migrations
 * et politiques ; il n'a pas fallu l'enfreindre.*
 *
 * ## CE QUE CE MODULE NE SAIT PAS FAIRE, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * **RETIRER une condition d'un forfait existant.** À la modification, omettre
 * une colonne veut dire « ne la change pas », et Prisma refuse `null` sur une
 * liste scalaire — les deux mesures ci-dessus valent aussi pour
 * `ForfaitUpdateInput`. Il n'existe donc aucune écriture, dans les bornes du
 * §2, qui fasse repasser une condition de « posée » à « absente ».
 *
 * *Le refus est NOMMÉ (`condition_non_retirable`) plutôt que silencieux* : une
 * modification qui omettrait la colonne réussirait en laissant l'ancienne
 * valeur, et l'écran dirait « enregistré » sur un forfait dont la condition
 * n'a pas bougé. **Un succès qui ne fait pas ce qu'on lui a demandé est pire
 * qu'un refus.** La voie qui reste est de désactiver le forfait et d'en créer
 * un autre — ce que le message dit.
 */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const ENREGISTREMENT_ABSENT = "P2025";
const CONTRAINTE_BASE = "P2010";

/** Ce qu'un refus dit, et il n'en dit jamais plus. */
export type MotifRefusForfait =
  /** `(societe_id, type, rang)` — le rang ne se compare qu'entre pairs (D86). */
  | "rang_pris"
  /** `(societe_id, code)` — le code est la clé naturelle du catalogue. */
  | "code_pris"
  /**
   * UN DOUBLON DONT ON NE SAIT PAS LEQUEL — la troisième valeur, et elle
   * existe parce qu'un booléen ne porte pas trois états.
   *
   * Elle ne devrait pas s'afficher : `attribuerDoublon` retrouve presque
   * toujours la cause par une lecture. **Elle reste néanmoins prononçable**,
   * pour le cas où la ligne fautive aurait disparu entre l'échec et la
   * lecture. *« Je ne sais pas lequel » et « c'est le code » ne se corrigent
   * pas au même endroit*, et les confondre enverrait changer le mauvais champ.
   */
  | "doublon"
  /** La famille n'appartient pas à la société active, ou n'existe pas. */
  | "famille_hors_societe"
  /** La devise n'est pas connue du référentiel de plateforme. */
  | "devise_inconnue"
  /** Le forfait n'est pas dans le périmètre — il n'est jamais dit s'il existe ailleurs (D50). */
  | "introuvable"
  /** Voir l'en-tête : une condition posée ne se retire pas par une modification. */
  | "condition_non_retirable";

export type ResultatForfait =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusForfait };

/**
 * Traduit un refus de la base en motif.
 *
 * **Les deux unicités se distinguent par leur CIBLE, jamais par le message** :
 * `meta.target` nomme les colonnes, et c'est une donnée de Prisma plutôt qu'un
 * texte destiné à un humain.
 */
function motifDeLErreur(erreur: unknown): MotifRefusForfait | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    // **PRISMA NE DIT PAS LAQUELLE DES DEUX UNICITÉS A MORDU**, et c'est
    // mesuré plutôt que supposé. Deux rédactions ont échoué avant celle-ci :
    //
    // | Ce qui a été lu | Ce que le harnais a rendu |
    // |---|---|
    // | `meta.target` comme tableau de colonnes | hors harnais : `["societe_id","type","rang"]` — **dans le harnais : `null`** |
    // | `erreur.message` | *« Unique constraint failed on the **(not available)** »* |
    //
    // *Le même code, contre la même base, rend la cible à un endroit et pas à
    // l'autre* — c'est la divergence du §9 (07/09) prise comme instrument :
    // elle dit que l'attribution ne peut PAS venir de l'erreur.
    //
    // Ce motif-ci est donc le doublon SANS attribution ; `attribuerDoublon`
    // la retrouve par une lecture, APRÈS coup — la transaction ayant déjà
    // échoué, il n'y a plus de course à perdre.
    return "doublon";
  }
  if (erreur.code === VIOLATION_CLE_ETRANGERE) {
    // La famille est chaînée sur le COUPLE (société, famille) : une famille
    // d'une autre société est donc refusée par la clé, jamais par une
    // comparaison écrite au-dessus de la politique.
    return /devise/.test(erreur.message)
      ? "devise_inconnue"
      : "famille_hors_societe";
  }
  if (erreur.code === CONTRAINTE_BASE) {
    return "famille_hors_societe";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "introuvable";
  }
  return null;
}

/**
 * Les colonnes de CONDITION, telles qu'on les passe à Prisma.
 *
 * **`undefined` et `null` ne veulent pas dire la même chose ici**, et c'est
 * tout le sujet : `undefined` fait OMETTRE la colonne — donc `NULL` en base à
 * la création —, tandis que `null` est refusé par le compilateur. La saisie,
 * elle, porte bien `null` : c'est la traduction qui se fait ici, une fois.
 */
function conditions(saisie: SaisieForfait): {
  zone_geo?: string[];
  type_intervention?: string[];
  famille_id: string | null;
} {
  return {
    ...(saisie.zone_geo === null ? {} : { zone_geo: saisie.zone_geo }),
    ...(saisie.type_intervention === null
      ? {}
      : { type_intervention: saisie.type_intervention }),
    // `famille_id` est une colonne ORDINAIRE, pas une liste : `null` y passe.
    famille_id: saisie.famille_id,
  };
}

/**
 * RETROUVE LAQUELLE DES DEUX UNICITÉS A MORDU — par une LECTURE, après coup.
 *
 * **Ce n'est pas un contrôle préalable**, et la distinction est celle que
 * `documents/depot.ts` fait déjà : un contrôle avant l'écriture laisse une
 * course entre le `SELECT` et l'`INSERT`. Ici la base a **déjà** refusé ; il ne
 * reste qu'à nommer ce qu'elle a refusé, pour que l'écran dise quel champ
 * changer.
 *
 * L'ordre n'est pas indifférent : **le CODE d'abord**. C'est la clé naturelle
 * du catalogue, celle qu'un humain reconnaît ; un rang se choisit après.
 */
async function attribuerDoublon(
  contexte: ContexteSession,
  saisie: SaisieForfait,
  exclure: string | null,
  client?: PrismaClient,
): Promise<MotifRefusForfait> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const hors = exclure === null ? {} : { id: { not: exclure } };
      const parCode = await tx.forfait.findFirst({
        where: { code: saisie.code, ...hors },
        select: { id: true },
      });
      if (parCode !== null) {
        return "code_pris" as const;
      }
      const parRang = await tx.forfait.findFirst({
        where: { type: saisie.type, rang: saisie.rang, ...hors },
        select: { id: true },
      });
      return parRang === null ? ("doublon" as const) : ("rang_pris" as const);
    },
    client,
  );
}

/** Crée un forfait dans la société active. */
export async function creerForfait(
  contexte: ContexteSession,
  saisie: SaisieForfait,
  deviseCode: string,
  client?: PrismaClient,
): Promise<ResultatForfait> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.forfait.create({
          data: {
            id,
            societe_id: exigerSocieteActive(contexte),
            code: saisie.code,
            libelle: saisie.libelle,
            type: saisie.type,
            rang: saisie.rang,
            montant_mineur: BigInt(saisie.montant_mineur),
            devise_code: deviseCode,
            cumulable_temps: saisie.cumulable_temps,
            actif: saisie.actif,
            ...conditions(saisie),
          },
          select: { id: true },
        }),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    if (motif === "doublon") {
      return {
        accepte: false,
        motif: await attribuerDoublon(contexte, saisie, null, client),
      };
    }
    return { accepte: false, motif };
  }
}

/**
 * Modifie un forfait.
 *
 * **Le refus de retrait tombe AVANT toute écriture**, et il lit l'état courant
 * plutôt que la saisie seule : *on ne peut refuser « vous retirez une
 * condition » qu'en sachant qu'il y en avait une.* La lecture se fait sous le
 * même contexte cloisonné, dans la même transaction que l'écriture.
 */
export async function modifierForfait(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieForfait,
  deviseCode: string,
  client?: PrismaClient,
): Promise<ResultatForfait> {
  try {
    return await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const courant = await tx.forfait.findFirst({
          where: { id },
          select: { zone_geo: true, type_intervention: true },
        });
        if (courant === null) {
          return { accepte: false as const, motif: "introuvable" as const };
        }

        // LA LIMITE, PRONONCÉE ICI ET NULLE PART AILLEURS. Prisma rend `[]` à la
        // lecture d'une colonne NULLE : une condition posée est donc une liste
        // NON VIDE, et la retirer reviendrait à écrire `null`, ce que le
        // compilateur refuse. Voir l'en-tête.
        const retire =
          (courant.zone_geo.length > 0 && saisie.zone_geo === null) ||
          (courant.type_intervention.length > 0 &&
            saisie.type_intervention === null);
        if (retire) {
          return {
            accepte: false as const,
            motif: "condition_non_retirable" as const,
          };
        }

        await tx.forfait.update({
          where: { id },
          data: {
            code: saisie.code,
            libelle: saisie.libelle,
            type: saisie.type,
            rang: saisie.rang,
            montant_mineur: BigInt(saisie.montant_mineur),
            devise_code: deviseCode,
            cumulable_temps: saisie.cumulable_temps,
            actif: saisie.actif,
            ...conditions(saisie),
          },
          select: { id: true },
        });
        return { accepte: true as const, id };
      },
      client,
    );
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    if (motif === "doublon") {
      // `exclure` est la ligne qu'on MODIFIE : sans elle, elle serait son
      // propre doublon, et le refus nommerait un conflit avec elle-même.
      return {
        accepte: false,
        motif: await attribuerDoublon(contexte, saisie, id, client),
      };
    }
    return { accepte: false, motif };
  }
}

/**
 * Active ou désactive un forfait.
 *
 * **Un forfait ne se supprime pas**, et ce n'est pas une commodité : une
 * intervention le DÉSIGNE (`intervention.forfait_id`, `onDelete: Restrict`), et
 * une facture émise sous un forfait disparu ne s'explique plus. *Désactiver
 * retire du CHOIX sans toucher au passé.*
 */
export async function changerActiviteForfait(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatForfait> {
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.forfait.update({
          where: { id },
          data: { actif },
          select: { id: true },
        }),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}
