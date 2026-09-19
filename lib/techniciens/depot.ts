import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import {
  avecContexteApplicatif,
  garantirRoleApplicatif,
  prisma,
} from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import type { SaisieModificationTechnicien, SaisieTechnicien } from "./saisie";

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
 * ## UN TECHNICIEN, C'EST TROIS LIGNES — ET DEUX TEMPS, PAS UN SEUL
 *
 * `Utilisateur` (l'identité), `UtilisateurSociete` (la personne DANS la
 * société, avec son rôle) et `Technicien` (le rattachement à une agence).
 * La première rédaction de ce module posait les trois dans UNE transaction
 * unique, en armant elle-même les deux variables de désignation
 * (`app.authentification_email`, `…_utilisateur_id`) par un `$executeRawUnsafe`
 * local. **`tests/unit/auth/pose-de-designation.test.ts` l'a refusé** : cette
 * pose ne s'écrit que dans `lib/db/rls.ts` et `lib/auth/lecture-identite.ts`,
 * une liste CLOSE — « y ajouter une entrée est un arbitrage : c'est ouvrir une
 * clé d'accès aux tables d'authentification depuis un chemin de plus » — et le
 * territoire de ce lot ne permet ni de l'étendre (`lib/auth/**` est en lecture
 * seule) ni d'assouplir le gardien lui-même. *C'était le bricolage exact que le
 * ticket demandait d'éviter, découvert par le gardien plutôt que supposé.*
 *
 * Ce module écrit donc l'identité **par le chemin qui compose déjà le
 * contexte** — `avecDesignationAuth`, la même maison qu'emploie
 * `lib/auth/amorcage.ts` pour la même raison —, dans SA transaction ; puis
 * l'habilitation et le rattachement, ENSEMBLE, dans une seconde transaction.
 * C'est très exactement la forme de `ouvrirPremierCompte` (Q1/D65) : *l'identité
 * d'abord, ce qui l'habilite ensuite*, jamais l'inverse — la lecture par
 * désignation qui ouvre la première étape ne verrait pas une ligne pas encore
 * écrite.
 *
 * **Ce que cela coûte, dit plutôt que tu** — même aveu que
 * `lib/auth/amorcage.ts` : si la seconde transaction échoue après que la
 * première a créé une IDENTITÉ NEUVE, cette identité reste seule, sans
 * société ni rattachement. Elle ne lit rien de cloisonné (aucune ligne
 * `utilisateur_societe`) et n'accorde rien. Le geste reste REJOUABLE : un
 * second appel avec le même courriel LIT cette identité par désignation
 * (`rattache: true`) au lieu d'en créer une seconde, et retente l'habilitation.
 * *C'est une gêne d'exploitation, jamais une ouverture.*
 *
 * ## AUCUN CHEMIN D'AUTHENTIFICATION N'EST OUVERT ICI
 *
 * Ce module n'appelle jamais `auth.api.signUpEmail` — ce point d'entrée est
 * fermé à toute écriture hors de `lib/auth/amorcage.ts`, du script
 * d'amorçage et de leurs tests (`tests/unit/auth/amorcage-retrait.test.ts`
 * le fait échouer sinon). **Créer un technicien crée son identité, pas son
 * accès** : `avecDesignationAuth(...).utilisateur.create(...)` est une
 * écriture ORDINAIRE dans une table — elle n'ouvre ni compte de connexion
 * (`compte`), ni session, ni jeton. La personne obtient son accès par le flux
 * d'enrôlement existant, hors périmètre de ce lot.
 *
 * ## LA POLITIQUE `utilisateur_ouverture`, ET POURQUOI ELLE ADMET CETTE ÉCRITURE
 *
 * `utilisateur` est la QUATRIÈME catégorie de I1 — aucun `societe_id`, une
 * personne travaille légitimement pour deux sociétés. Ses politiques portent
 * donc la forme « DÉSIGNATION » (L1-02c) : une ligne n'est lisible ou
 * inscriptible que par qui la NOMME déjà.
 *
 * La migration `20260909100000_amorcage_premier_compte_q1` l'écrit noir sur
 * blanc : la branche générale de `utilisateur_ouverture` — société active ET
 * `app_peut_administrer_identites()` (= rôle `admin_societe` seul, D37) —
 * **« vaudra telle quelle pour le chemin ADMINISTRATIF d'ouverture de compte
 * du lot 7 »**. C'est ce lot. `avecDesignationAuth` reçoit donc le rôle du
 * SESSION APPELANTE — jamais un rôle que ce module s'attribuerait — et c'est
 * la base qui refuse si ce rôle n'est pas `admin_societe` : aucune comparaison
 * n'est écrite ici au-dessus de la politique.
 *
 * ## UN COURRIEL DÉJÀ PRIS RATTACHE, NE DUPLIQUE PAS
 *
 * `Utilisateur.email` est `@unique` — une personne qui travaille déjà pour
 * une autre société de la plateforme ne doit pas recevoir une seconde
 * identité. La désignation par courriel permet de LIRE cette ligne existante,
 * quelle que soit la société qui l'a ouverte : si elle existe, l'écriture de
 * `utilisateur` est simplement SAUTÉE, et les deux lignes suivantes la
 * rattachent à cette société.
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
 * CRÉE UN TECHNICIEN — l'identité par le chemin qui compose le contexte
 * d'authentification, puis l'habilitation et le rattachement ensemble.
 *
 * Voir l'en-tête du module pour le raisonnement complet.
 */
export async function creerTechnicien(
  contexte: ContexteSession,
  saisie: SaisieTechnicien,
  client?: PrismaClient,
): Promise<ResultatCreationTechnicien> {
  const societeId = exigerSocieteActive(contexte);
  if (client === undefined) {
    // MÊME garde que `avecContexteApplicatif` : `avecDesignationAuth` se
    // connecte directement sur le client, sans passer par ce garde-fou.
    await garantirRoleApplicatif();
  }
  const base = client ?? prisma;

  // ── 1. L'IDENTITÉ, PAR `avecDesignationAuth` — jamais posée à la main ───
  //
  // Le rôle transmis est celui de LA SESSION APPELANTE, jamais un rôle que ce
  // module s'attribuerait : c'est la politique `utilisateur_ouverture`, en
  // base, qui refuse si ce rôle n'est pas `admin_societe` (D37).
  const administration: ContexteAdministratif = {
    societeId,
    role: contexte.role,
  };
  const designe = avecDesignationAuth(base, administration);

  const existant = await designe.utilisateur.findUnique({
    where: { email: saisie.email },
    select: { id: true },
  });

  let utilisateurId: string;
  const rattache = existant !== null;
  if (existant !== null) {
    utilisateurId = existant.id;
  } else {
    const nouveauId = uuidv7();
    const cree = await designe.utilisateur.create({
      data: { id: nouveauId, nom: saisie.nom, email: saisie.email },
      select: { id: true },
    });
    utilisateurId = cree.id;
  }

  // ── 2 et 3. L'HABILITATION ET LE RATTACHEMENT, ENSEMBLE ──────────────────
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) => habiliterEtRattacherDans(tx, societeId, utilisateurId, saisie),
      client,
    );
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }

  return { accepte: true, utilisateurId, rattache };
}

async function habiliterEtRattacherDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  utilisateurId: string,
  saisie: SaisieTechnicien,
): Promise<void> {
  await tx.utilisateurSociete.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateurId,
      societe_id: societeId,
      role: Role.technicien,
    },
    select: { id: true },
  });

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
