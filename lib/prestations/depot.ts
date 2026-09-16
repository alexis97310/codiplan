import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import type { SaisiePrestation } from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE DU CATALOGUE DES PRESTATIONS (R3-15).
 *
 * ## Ce qu'il répare
 *
 * L1-12 a livré la TABLE, la SAISIE Zod et le gabarit d'import. **Entre les
 * deux il n'y avait rien** : ni dépôt, ni route, ni écran — *mesuré le
 * 14/09/2026, `ls lib/prestations/` rendait un seul fichier.* Et l'import ne
 * sauvait pas ce module : une seule fonction d'application existe dans tout le
 * dépôt, et c'est celle des clients. **Le gabarit des prestations sait produire
 * un rapport et ne sait pas l'appliquer.**
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * Tout passe par `avecContexteApplicatif`, donc sous les politiques :
 * `prestation` est une table métier ordinaire, de forme « société ». *Une
 * comparaison écrite au-dessus de la politique serait une seconde lecture d'un
 * même critère*, et c'est celle qui vieillit sans rougir. Une prestation d'une
 * autre société et une prestation inexistante rendent donc **le même refus** —
 * les distinguer ferait un oracle (D35, D50).
 *
 * ## Aucun montant, et le gardien est déjà posé
 *
 * D109 : *une prestation porte une durée, jamais un taux.* D113 : *elle ne
 * désigne aucun forfait*, le pont passant par l'intervention et ses trois axes
 * (RG-TAR-06). Ce module n'écrit donc aucune colonne de montant — il n'en
 * existe pas —, et `tests/unit/prestations/aucun-montant.test.ts` refuse qu'il
 * en apparaisse une.
 *
 * ## Aucune SUPPRESSION, et c'est le raisonnement des forfaits
 *
 * Une prestation sera désignée par des interventions, et *une facture émise sous
 * une prestation disparue ne s'explique plus.* Le catalogue porte donc une
 * bascule d'activité — elle retire du CHOIX sans toucher au passé —, et aucun
 * chemin de suppression n'existe.
 */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const ENREGISTREMENT_ABSENT = "P2025";
const CONTRAINTE_BASE = "P2010";

/** Ce qu'un refus dit, et il n'en dit jamais plus. */
export type MotifRefusPrestation =
  /** `(societe_id, code)` — le code est la clé naturelle du catalogue. */
  | "code_pris"
  /** La famille n'appartient pas à la société active, ou n'existe pas. */
  | "famille_hors_societe"
  /** Hors périmètre — il n'est JAMAIS dit si elle existe ailleurs (D50). */
  | "introuvable";

export type ResultatPrestation =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusPrestation };

/**
 * Traduit un refus de la base en motif.
 *
 * **Une seule unicité sur cette table**, à la différence des forfaits : le code
 * est la seule clé naturelle, et `P2002` ne peut donc désigner qu'elle. *C'est
 * ce qui dispense ce module de la lecture d'attribution que `depot-forfaits.ts`
 * a dû écrire* — là-bas, `meta.target` vaut `null` dans le harnais et l'erreur
 * ne dit pas laquelle des deux unicités a mordu.
 */
function motifDeLErreur(erreur: unknown): MotifRefusPrestation | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    return "code_pris";
  }
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    // La famille est chaînée sur le COUPLE (société, famille) : une famille
    // d'une autre société est refusée par la clé, jamais par une comparaison
    // écrite au-dessus de la politique.
    return "famille_hors_societe";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "introuvable";
  }
  return null;
}

/** Une prestation telle qu'un écran la lit. */
export type LignePrestation = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
  readonly famille_id: string | null;
  readonly duree_standard_min: number | null;
  readonly actif: boolean;
};

const CHAMPS: { readonly [K in keyof LignePrestation]: true } = {
  id: true,
  code: true,
  libelle: true,
  famille_id: true,
  duree_standard_min: true,
  actif: true,
};

/**
 * LE CATALOGUE, sous le contexte cloisonné.
 *
 * **La checklist type n'est PAS lue**, et ce n'est pas un oubli : R3-15 a
 * tranché qu'elle ne se saisit pas encore — *personne n'a dit ce que porte cette
 * colonne*, et l'afficher dans un tableau qui ne sait pas l'écrire montrerait
 * une donnée que rien ne remplit.
 */
export async function listerLesPrestations(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LignePrestation[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.prestation.findMany({
        select: CHAMPS,
        // L'ordre est TOTAL : sans le dernier rang, deux prestations de même
        // code — impossible aujourd'hui, mais l'ordre ne doit pas en dépendre —
        // se rangeraient par la place physique des lignes (leçon de L3-03).
        orderBy: [{ code: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Une prestation par son identifiant, ou `null` si elle est hors périmètre. */
export async function lirePrestation(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<LignePrestation | null> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.prestation.findFirst({ where: { id }, select: CHAMPS }),
    client,
  );
}

/**
 * LES FAMILLES QU'UNE PRESTATION PEUT VISER — et elle peut n'en viser aucune.
 *
 * *C'est le premier parent FACULTATIF de ce dépôt* : un déplacement, un
 * diagnostic ou une formation ne visent aucune famille de matériel. Une famille
 * absente n'est pas une famille introuvable, et l'écran ne doit pas obliger à
 * en choisir une.
 */
export async function famillesVisables(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly { readonly id: string; readonly libelle: string }[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.familleMateriel.findMany({
        select: { id: true, libelle: true },
        orderBy: [{ libelle: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Crée une prestation dans la société active. */
export async function creerPrestation(
  contexte: ContexteSession,
  saisie: SaisiePrestation,
  client?: PrismaClient,
): Promise<ResultatPrestation> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) =>
        creerPrestationDans(tx, exigerSocieteActive(contexte), id, saisie),
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

/**
 * Modifie une prestation.
 *
 * `updateMany` plutôt que `update` : *zéro ligne touchée n'est pas une erreur
 * technique, c'est la politique qui a refusé*, et elle refuse en silence. Le
 * refus rendu est le même que pour un identifiant inconnu.
 */
export async function modifierPrestation(
  contexte: ContexteSession,
  id: string,
  saisie: SaisiePrestation,
  client?: PrismaClient,
): Promise<ResultatPrestation> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) => modifierPrestationDans(tx, id, saisie),
      client,
    );
    return touchees === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * L'ÉCRITURE ELLE-MÊME, DANS UNE TRANSACTION QUE L'APPELANT TIENT (R6-01).
 *
 * `creerPrestation` l'appelle, et `appliquerLeLotDePrestations` aussi — *un lot
 * s'applique dans UNE transaction* (L1-08i). **Extraite plutôt que recopiée**
 * (§9, 01/09), et l'identifiant est un PARAMÈTRE pour la raison de
 * `creerModeleDans` : l'appelant le tire avant d'ouvrir sa transaction.
 *
 * `checklist_type` n'est PAS écrite : R3-15 a tranché qu'elle ne se saisit pas
 * tant que personne n'a dit ce qu'elle porte. *Omettre la colonne la laisse à
 * `NULL`, ce qui est l'état « pas encore décidé » — et non un texte vide, qui
 * aurait l'air d'une réponse.*
 */
export async function creerPrestationDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisiePrestation,
): Promise<void> {
  await tx.prestation.create({
    data: {
      id,
      societe_id: societeId,
      code: saisie.code,
      libelle: saisie.libelle,
      famille_id: saisie.famille_id,
      duree_standard_min: saisie.duree_standard_min,
      actif: saisie.actif,
    },
    select: { id: true },
  });
}

/**
 * La MODIFICATION dans une transaction que l'appelant tient — le jumeau de
 * `creerPrestationDans`.
 *
 * `updateMany` plutôt que `update`, et le décompte est RENDU : *zéro ligne
 * touchée n'est pas une erreur technique, c'est la politique qui a refusé*, et
 * elle refuse en silence.
 */
export async function modifierPrestationDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: SaisiePrestation,
): Promise<number> {
  const touchees = await tx.prestation.updateMany({
    where: { id },
    data: {
      code: saisie.code,
      libelle: saisie.libelle,
      famille_id: saisie.famille_id,
      duree_standard_min: saisie.duree_standard_min,
      actif: saisie.actif,
    },
  });
  return touchees.count;
}

/**
 * BASCULE L'ACTIVITÉ — la seule façon de retirer une prestation du choix.
 *
 * Elle ne touche pas au passé : une intervention qui a désigné cette prestation
 * continue de la nommer. *Supprimer aurait rendu inexplicable une facture émise
 * sous une prestation disparue.*
 */
export async function basculerActivite(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatPrestation> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.prestation.updateMany({ where: { id }, data: { actif } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}
