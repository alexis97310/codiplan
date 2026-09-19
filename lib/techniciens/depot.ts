import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  VARIABLE_SESSION_AUTH_EMAIL,
  VARIABLE_SESSION_AUTH_UTILISATEUR,
} from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import type {
  SaisieModificationTechnicien,
  SaisieTechnicien,
} from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE D'UN TECHNICIEN (ÉQUIPE-1).
 *
 * ## Ce qu'il répare
 *
 * Mesuré sur 4fead41 : `prisma/seed.ts` et un scénario d'isolation sont les
 * SEULES écritures de `technicien` du dépôt. Aucune route, aucun écran — un
 * technicien n'existait que semé, et rien ne pouvait en ajouter un ni faire
 * partir celui qui s'en va.
 *
 * ## UN TECHNICIEN, C'EST TROIS LIGNES, DANS UNE SEULE TRANSACTION
 *
 * `Utilisateur` (l'identité), `UtilisateurSociete` (la personne DANS la
 * société, avec son rôle) et `Technicien` (le rattachement à une agence).
 * Les trois s'écrivent ensemble ou pas du tout — un `$transaction` interactif
 * les porte toutes, et une exception à n'importe quelle étape les annule
 * toutes.
 *
 * ## AUCUN CHEMIN D'AUTHENTIFICATION N'EST OUVERT ICI
 *
 * Ce module n'appelle jamais `auth.api.signUpEmail` — ce point d'entrée est
 * fermé à toute écriture hors de `lib/auth/amorcage.ts`, du script
 * d'amorçage et de leurs tests (`tests/unit/auth/amorcage-retrait.test.ts`
 * le fait échouer sinon). **Créer un technicien crée son identité, pas son
 * accès** : `tx.utilisateur.create(...)` est une écriture ORDINAIRE, une
 * ligne dans une table, comme n'importe quel autre dépôt de ce dépôt — elle
 * n'ouvre ni compte de connexion (`compte`), ni session, ni jeton. La
 * personne obtient son accès par le flux d'enrôlement existant, hors
 * périmètre de ce lot.
 *
 * ## LA POLICE `utilisateur_ouverture`, ET POURQUOI ELLE ADMET CETTE ÉCRITURE
 *
 * `utilisateur` est la QUATRIÈME catégorie de I1 — aucun `societe_id`, une
 * personne travaille légitimement pour deux sociétés. Ses politiques portent
 * donc la forme « DÉSIGNATION » (L1-02c) : une ligne n'est lisible ou
 * inscriptible que par qui la NOMME déjà, via `app.authentification_email`
 * ou `app.authentification_utilisateur_id`.
 *
 * La migration `20260909100000_amorcage_premier_compte_q1` l'écrit
 * noir sur blanc : la branche générale de `utilisateur_ouverture` — société
 * active ET `app_peut_administrer_identites()` (= rôle `admin_societe` seul,
 * D37) — **« vaudra telle quelle pour le chemin ADMINISTRATIF d'ouverture de
 * compte du lot 7 »**. C'est ce lot. Un `admin_societe` dont la session porte
 * une société active peut donc insérer une ligne `utilisateur`, sans qu'aucun
 * mot de passe, aucune session, aucun jeton n'existe pour elle.
 *
 * ## LA DÉSIGNATION EST POSÉE À LA MAIN, ET C'EST LE SEUL SQL BRUT D'ICI
 *
 * `avecContexteApplicatif` pose six variables de session par transaction
 * (`lib/db/rls.ts`), et REMET TOUJOURS À VIDE les deux variables de
 * désignation — c'est leur pose la plus importante, celle qui referme la
 * porte de l'authentification à toute transaction ordinaire. Ce module en a
 * BESOIN, ouvertes, le temps d'une écriture : sans elles, `utilisateur_lecture`
 * refuse le `RETURNING` de l'`INSERT`, et Prisma le rapporte comme un échec
 * (mesuré et écrit dans `lib/auth/lecture-identite.ts`).
 *
 * `avecDesignationAuth` (le module qui pose la même chose pour Better Auth)
 * ouvre sa PROPRE transaction à chaque appel — il ne peut donc pas porter,
 * dans la MÊME transaction, l'écriture de `utilisateur_societe` et de
 * `technicien` qui doivent suivre. Ce module pose donc les deux variables
 * lui-même, par les DEUX constantes exportées de `lib/db/rls.ts`
 * (`VARIABLE_SESSION_AUTH_EMAIL`, `VARIABLE_SESSION_AUTH_UTILISATEUR`),
 * dans la transaction ouverte par `avecContexteApplicatif` — jamais une
 * transaction à lui.
 *
 * ## UN COURRIEL DÉJÀ PRIS RATTACHE, NE DUPLIQUE PAS
 *
 * `Utilisateur.email` est `@unique` — une personne qui travaille déjà pour
 * une autre société de la plateforme ne doit pas recevoir une seconde
 * identité. La désignation par courriel permet de LIRE cette ligne existante
 * (la lecture par désignation ne demande aucune habilitation, exactement
 * comme la vérification d'identifiants à la connexion) : si elle existe,
 * l'écriture de `utilisateur` est simplement SAUTÉE, et les deux lignes
 * suivantes la rattachent à cette société.
 */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const CONTRAINTE_BASE = "P2010";

/** Ce qu'un refus dit, et il n'en dit jamais plus. */
export type MotifRefusTechnicien =
  /** `(societe_id, utilisateur_id)` — cette personne est déjà membre. */
  | "deja_membre"
  /** L'agence n'appartient pas à la société active, ou n'existe pas. */
  | "agence_hors_societe"
  /** Hors périmètre — jamais dit si le technicien existe ailleurs (D50). */
  | "introuvable";

export type ResultatCreationTechnicien =
  | {
      readonly accepte: true;
      readonly utilisateurId: string;
      /** Vrai si la personne existait déjà (un autre courriel pris) — voir l'en-tête. */
      readonly rattache: boolean;
    }
  | { readonly accepte: false; readonly motif: MotifRefusTechnicien };

export type ResultatModificationTechnicien =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly motif: MotifRefusTechnicien };

/** L'instruction qui pose les deux variables de désignation de `utilisateur`. */
const SQL_DESIGNATION = `SELECT set_config($1, $2, true), set_config($3, $4, true)`;

async function designerUtilisateur(
  tx: Prisma.TransactionClient,
  email: string,
  id: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    SQL_DESIGNATION,
    VARIABLE_SESSION_AUTH_EMAIL,
    email,
    VARIABLE_SESSION_AUTH_UTILISATEUR,
    id,
  );
}

/** Traduit un refus de la base en motif. */
function motifDeLErreur(erreur: unknown): MotifRefusTechnicien | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    return "deja_membre";
  }
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    return "agence_hors_societe";
  }
  return null;
}

/** Un technicien tel qu'un écran le lit — les trois lignes recomposées. */
export type LigneTechnicien = {
  readonly utilisateurId: string;
  readonly nom: string;
  readonly email: string;
  readonly agenceId: string;
  readonly agenceLibelle: string;
  readonly actif: boolean;
};

/**
 * LES TECHNICIENS DE LA SOCIÉTÉ ACTIVE.
 *
 * Deux lectures, jamais une jointure Prisma : `technicien` ne porte AUCUNE
 * clé étrangère vers `utilisateur` (D39 — `utilisateur` est la quatrième
 * catégorie de I1, une relation Prisma vers elle est refusée par le
 * gardien). La seconde lecture n'a besoin d'AUCUNE désignation : sous
 * `avecContexteApplicatif`, la branche « rattachement » de
 * `utilisateur_lecture` s'ouvre déjà à toute identité qui porte une ligne
 * `utilisateur_societe` DANS la société active — exactement ce que la
 * première lecture vient de confirmer pour chacune.
 */
export async function listerLesTechniciens(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneTechnicien[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const techniciens = await tx.technicien.findMany({
        select: {
          utilisateur_id: true,
          agence_id: true,
          actif: true,
          agence: { select: { libelle: true } },
        },
        orderBy: [{ agence_id: "asc" }, { utilisateur_id: "asc" }],
      });
      if (techniciens.length === 0) {
        return [];
      }
      const identites = await tx.utilisateur.findMany({
        where: { id: { in: techniciens.map((t) => t.utilisateur_id) } },
        select: { id: true, nom: true, email: true },
      });
      const identiteDe = new Map(identites.map((u) => [u.id, u]));
      return techniciens.map((t) => {
        const identite = identiteDe.get(t.utilisateur_id);
        return {
          utilisateurId: t.utilisateur_id,
          nom: identite?.nom ?? "",
          email: identite?.email ?? "",
          agenceId: t.agence_id,
          agenceLibelle: t.agence.libelle,
          actif: t.actif,
        };
      });
    },
    client,
  );
}

/** Les agences visables pour le rattachement — actives seulement. */
export async function agencesDisponibles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly { readonly id: string; readonly libelle: string }[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.agence.findMany({
        where: { actif: true },
        select: { id: true, libelle: true },
        orderBy: [{ libelle: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/**
 * CRÉE UN TECHNICIEN — les trois lignes, dans une seule transaction.
 *
 * Voir l'en-tête du module pour le raisonnement complet : la désignation
 * posée à la main, la branche administrative de `utilisateur_ouverture`, et
 * le rattachement plutôt que le doublon sur un courriel déjà pris.
 */
export async function creerTechnicien(
  contexte: ContexteSession,
  saisie: SaisieTechnicien,
  client?: PrismaClient,
): Promise<ResultatCreationTechnicien> {
  const societeId = exigerSocieteActive(contexte);
  try {
    return await avecContexteApplicatif(
      contexte,
      (tx) => creerTechnicienDans(tx, societeId, saisie),
      client,
    );
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

async function creerTechnicienDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  saisie: SaisieTechnicien,
): Promise<ResultatCreationTechnicien> {
  // ── 1. L'IDENTITÉ EXISTE-T-ELLE DÉJÀ, PAR SON COURRIEL ? ─────────────────
  await designerUtilisateur(tx, saisie.email, "");
  const existant = await tx.utilisateur.findUnique({
    where: { email: saisie.email },
    select: { id: true },
  });

  let utilisateurId: string;
  const rattache = existant !== null;
  if (existant !== null) {
    utilisateurId = existant.id;
  } else {
    // ── 1 bis. SINON, ELLE NAÎT — sous la branche administrative de
    //          `utilisateur_ouverture` (société active + admin_societe).
    const nouveauId = uuidv7();
    await designerUtilisateur(tx, saisie.email, nouveauId);
    const cree = await tx.utilisateur.create({
      data: { id: nouveauId, nom: saisie.nom, email: saisie.email },
      select: { id: true },
    });
    utilisateurId = cree.id;
  }

  // ── 2. LA PERSONNE, DANS LA SOCIÉTÉ, AVEC SON RÔLE ───────────────────────
  await tx.utilisateurSociete.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateurId,
      societe_id: societeId,
      role: Role.technicien,
    },
    select: { id: true },
  });

  // ── 3. LE RATTACHEMENT À UNE AGENCE ──────────────────────────────────────
  await tx.technicien.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      utilisateur_id: utilisateurId,
      agence_id: saisie.agence_id,
      actif: saisie.actif,
    },
    select: { id: true },
  });

  return { accepte: true, utilisateurId, rattache };
}

/**
 * MODIFIE UN TECHNICIEN — l'agence de rattachement et la bascule
 * actif/inactif. L'identité (nom, courriel) ne se corrige pas ici : hors
 * périmètre de ce lot.
 *
 * `updateMany` plutôt que `update` : zéro ligne touchée n'est pas une erreur
 * technique, c'est soit un identifiant hors société (RLS refuse en
 * silence), soit un identifiant qui n'est pas celui d'un technicien.
 */
export async function modifierTechnicien(
  contexte: ContexteSession,
  utilisateurId: string,
  saisie: SaisieModificationTechnicien,
  client?: PrismaClient,
): Promise<ResultatModificationTechnicien> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.technicien.updateMany({
          where: { utilisateur_id: utilisateurId },
          data: { agence_id: saisie.agence_id, actif: saisie.actif },
        }),
      client,
    );
    return touchees.count === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}
