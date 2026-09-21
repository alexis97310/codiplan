import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import type { CreationAgence, ModificationAgence } from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE D'UNE AGENCE — création et modification (AGENCE-1).
 *
 * ## Ce qu'il répare
 *
 * Aucun chemin de création n'existait hors du semis (`prisma/seed.ts`) :
 * `grep -rn "agence.create|creerAgence" lib app scripts` ne rendait rien. Sur
 * une base de PRODUCTION neuve — sans semis, par construction (I9) —, aucune
 * agence ne pouvait naître, et sans agence : l'import de sites ne résout plus
 * sa colonne « Agence (code) », le planning n'a aucun calendrier d'ouverture,
 * et `pnpm feries:etendre` n'a rien à étendre (D46).
 *
 * ## UNE AGENCE SANS CALENDRIER N'OUVRE JAMAIS (I7)
 *
 * `creerAgenceDans` crée donc les DEUX lignes dans la MÊME transaction : le
 * calendrier d'abord (même ordre que le semis — « les calendriers AVANT les
 * agences : `agence.calendrier_id` les référence »), l'agence ensuite, reliée
 * à lui. **Le calendrier neuf ne porte AUCUNE plage** : inventer un horaire par
 * défaut serait une donnée d'exploitation que le §8 interdit. L'agence naît
 * donc fermée tous les jours, et c'est à l'écran de le dire — ce module ne
 * fait qu'écrire ce qu'on lui donne.
 *
 * Le calendrier PARTAGE le code de l'agence plutôt que d'en recevoir un
 * propre : les deux tables portent chacune leur unicité `(societe_id, code)`
 * sur la MÊME valeur, si bien qu'un code déjà pris par une agence l'est
 * nécessairement aussi pour le calendrier qui naîtrait avec elle. Le refus se
 * lit donc comme UN SEUL motif, quelle que soit la table qui a mordu — pas de
 * lecture d'attribution à écrire après coup (le motif de
 * `lib/tarification/depot-forfaits.ts`, qui lui a deux clés naturelles
 * distinctes et n'a pas cette chance).
 *
 * Il n'y a pas de `lib/calendriers/` séparé pour ces trois lignes : la
 * création d'un calendrier vide n'a qu'un seul appelant, ici, et lui donner un
 * module serait une abstraction sans second usage.
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * Tout passe par `avecContexteApplicatif` ; `agence` et `calendrier` sont de
 * forme « société » (politique `cloisonnement_societe`), et un `findFirst`
 * sans `where` de société ne rend que les lignes de la société active.
 */

/** Une agence telle qu'elle est rendue. */
export type FicheAgence = {
  id: string;
  code: string;
  libelle: string;
  territoire: string;
  fuseau_horaire: string | null;
  calendrier_id: string | null;
  actif: boolean;
};

const CHAMPS_FICHE = {
  id: true,
  code: true,
  libelle: true,
  territoire: true,
  fuseau_horaire: true,
  calendrier_id: true,
  actif: true,
} as const;

/**
 * Motif d'un refus. Une CLÉ, jamais une phrase : la couche de rendu choisit
 * son texte au dictionnaire.
 */
export type MotifRefusAgence =
  /** `(societe_id, code)` — sur l'agence ou sur le calendrier créé pour elle. */
  | "code_pris"
  /** Hors périmètre — il n'est JAMAIS dit si elle existe ailleurs (D50). */
  | "introuvable";

export type ResultatAgence =
  | { readonly accepte: true; readonly fiche: FicheAgence }
  | { readonly accepte: false; readonly motif: MotifRefusAgence };

const VIOLATION_UNICITE = "P2002";
const ENREGISTREMENT_ABSENT = "P2025";

function motifDeLErreur(erreur: unknown): MotifRefusAgence | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    return "code_pris";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "introuvable";
  }
  return null;
}

/**
 * Crée une agence ET son calendrier d'ouverture — voir l'en-tête du module.
 */
export async function creerAgence(
  contexte: ContexteSession,
  saisie: CreationAgence,
  client?: PrismaClient,
): Promise<ResultatAgence> {
  try {
    const fiche = await avecContexteApplicatif(
      contexte,
      (tx) => creerAgenceDans(tx, exigerSocieteActive(contexte), saisie),
      client,
    );
    return { accepte: true, fiche };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * L'ÉCRITURE ELLE-MÊME, DANS UNE TRANSACTION QUE L'APPELANT TIENT (R6-01) —
 * le calendrier avant l'agence, comme le semis.
 */
export async function creerAgenceDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  saisie: CreationAgence,
): Promise<FicheAgence> {
  const calendrier = await tx.calendrier.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      code: saisie.code,
      libelle: saisie.libelle,
    },
    select: { id: true },
  });
  return tx.agence.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      code: saisie.code,
      libelle: saisie.libelle,
      territoire: saisie.territoire,
      fuseau_horaire: saisie.fuseau_horaire,
      calendrier_id: calendrier.id,
      actif: saisie.actif,
    },
    select: CHAMPS_FICHE,
  });
}

/** Lit une agence par son identifiant. `null` si elle n'est pas dans le périmètre. */
export async function lireAgence(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<FicheAgence | null> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.agence.findFirst({ where: { id }, select: CHAMPS_FICHE }),
    client,
  );
}

/**
 * Modifie une agence. Une fiche hors périmètre lève `P2025`, rendu en
 * « introuvable » — le refus ne dit pas si elle existe ailleurs (D50).
 */
export async function modifierAgence(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationAgence,
  client?: PrismaClient,
): Promise<ResultatAgence> {
  try {
    const fiche = await avecContexteApplicatif(
      contexte,
      (tx) => modifierAgenceDans(tx, id, saisie),
      client,
    );
    return { accepte: true, fiche };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/** La MODIFICATION dans une transaction que l'appelant tient (R6-01). */
export async function modifierAgenceDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: ModificationAgence,
): Promise<FicheAgence> {
  return tx.agence.update({
    where: { id },
    data: saisie,
    select: CHAMPS_FICHE,
  });
}
