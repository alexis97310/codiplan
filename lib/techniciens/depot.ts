import { Prisma, type PrismaClient, type StatutRessource } from "@prisma/client";

import {
  agencesProposables,
  type AgenceProposable,
} from "@/lib/agences/proposables";
import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import {
  avecContexteApplicatif,
  garantirRoleApplicatif,
  prisma,
} from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

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
 * (`compte`), ni session, ni jeton. Depuis 9DJ-TP-ACC1-DONNER-ACCES (D162,
 * 04/10/2026), la personne obtient son accès par un geste ADMINISTRATIF
 * distinct, posé depuis l'écran Équipe — `lib/auth/acces-technicien.ts`,
 * hors de ce module — jamais à la création : les deux restent deux temps.
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
  /**
   * L'agence existe et appartient à la société, mais elle est inactive
   * (AGENCE-ACTIVE, AA-3) — même précédent que `MotifRefusSite` de
   * `lib/sites/depot.ts`. Le MAINTIEN d'un rattachement déjà posé, même
   * devenu inactif, n'atteint jamais ce refus (voir `modifierTechnicien`).
   */
  | "agence_inactive"
  /**
   * « non renseigné » ne peut pas être RE-choisi une fois un statut de
   * ressource posé (QG-9, D163) — le menu de modification retire déjà
   * l'option pour cette fiche (voir l'écran) ; ce refus tient la porte côté
   * serveur pour une requête postée directement. Le MAINTIEN d'un statut déjà
   * posé, ou son changement vers l'AUTRE valeur, n'atteint jamais ce refus.
   */
  | "statut_deja_pose"
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
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — `null` tant que non renseigné. */
  readonly statutRessource: StatutRessource | null;
};

/**
 * TRI LISTES-1 (TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026) — extraite pour être
 * éprouvée SANS base (`tests/unit/techniciens/tri.test.ts`), même raison que
 * `LigneAgence` de `/parametres/agences` (D-13).
 */
export function trierLesTechniciens(
  lignes: readonly LigneTechnicien[],
): readonly LigneTechnicien[] {
  return trierAlphanumeriquement(
    lignes,
    (ligne) => ligne.nom,
    (ligne) => ligne.utilisateurId,
  );
}

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
 *
 * **Triée par NOM (LISTES-1, TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026)** — choix du
 * pilote : « tous les classements … par ordre alphanumérique croissant »
 * s'applique au NOM de la personne, pas au couple agence-puis-nom que
 * l'`orderBy` de la base posait avant ce ticket. `trierAlphanumeriquement`,
 * JAMAIS `ORDER BY` (voir `lib/tri/collation.ts`) — l'`orderBy` ci-dessous ne
 * fixe donc plus que l'ordre de la LECTURE, sans conséquence sur l'ordre
 * rendu.
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
          statut_ressource: true,
          agence: { select: { libelle: true } },
        },
      });
      if (techniciens.length === 0) {
        return [];
      }
      const identites = await tx.utilisateur.findMany({
        where: { id: { in: techniciens.map((t) => t.utilisateur_id) } },
        select: { id: true, nom: true, email: true },
      });
      const identiteDe = new Map(identites.map((u) => [u.id, u]));
      const lignes = techniciens.map((t) => {
        const identite = identiteDe.get(t.utilisateur_id);
        return {
          utilisateurId: t.utilisateur_id,
          nom: identite?.nom ?? "",
          email: identite?.email ?? "",
          agenceId: t.agence_id,
          agenceLibelle: t.agence.libelle,
          actif: t.actif,
          statutRessource: t.statut_ressource,
        };
      });
      return trierLesTechniciens(lignes);
    },
    client,
  );
}

/** Les agences visables pour le rattachement — actives seulement. */
export async function agencesDisponibles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<
  readonly {
    readonly id: string;
    readonly libelle: string;
    readonly code: string;
  }[]
> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const agences = await agencesProposables(tx);
      return agences.map(({ id, libelle, code }) => ({ id, libelle, code }));
    },
    client,
  );
}

/**
 * LES AGENCES PROPOSABLES POUR LE RATTACHEMENT ACTUEL D'UN TECHNICIEN
 * (AGENCE-ACTIVE, AA-3) — la sienne reste sélectionnable même redevenue
 * inactive, marquée `inactive: true`. Même précédent, et même piège fermé,
 * que `/sites/[id]` (voir l'en-tête de `lib/agences/proposables.ts`) :
 * `agencesDisponibles` ne suffit pas ici, une ligne DE CE TECHNICIEN
 * disparaîtrait de son propre menu de modification si son agence a été
 * désactivée après coup.
 */
export async function agencesProposablesPourTechnicien(
  contexte: ContexteSession,
  agenceActuelleId: string,
  client?: PrismaClient,
): Promise<readonly AgenceProposable[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) => agencesProposables(tx, { garder: agenceActuelleId }),
    client,
  );
}

/** Le compte de chaque technicien vers son nombre d'interventions à venir. */
export type ComptesInterventionsAVenir = ReadonlyMap<string, number>;

/**
 * LES INTERVENTIONS À VENIR DE CHAQUE TECHNICIEN (ÉQUIPE-1, SAV-24).
 *
 * « À venir » = affectée à ce technicien, planifiée aujourd'hui (jour civil de
 * l'agence, L0-08) ou plus tard, et dont le statut n'est ni `terminee`, ni
 * `cloturee`, ni `annulee` — même exclusion que `criteresSansDureeAVenir` de
 * `lib/interventions/depot.ts`, réécrite ici plutôt qu'importée : ce dépôt
 * n'a pas vocation à dépendre du dépôt des interventions, et le territoire de
 * ce lot ne l'ouvre pas.
 *
 * UNE SEULE requête groupée pour toute la liste — jamais une par technicien
 * (`groupBy`, puis une carte pré-remplie à zéro : l'ABSENCE d'une ligne dans
 * le résultat groupé est une mesure à zéro, pas une absence de mesure, même
 * raisonnement que `lib/absences/depot.ts`).
 */
export async function compterInterventionsAVenirParTechnicien(
  contexte: ContexteSession,
  utilisateurIds: readonly string[],
  client?: PrismaClient,
): Promise<ComptesInterventionsAVenir> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const debutDuJour = await debutDuJourSociete(tx, contexte);
      const groupes = await tx.intervention.groupBy({
        by: ["technicien_id"],
        where: {
          technicien_id: { in: [...utilisateurIds] },
          statut: { notIn: ["terminee", "cloturee", "annulee"] },
          date_planifiee: { gte: debutDuJour },
        },
        _count: { _all: true },
      });
      const comptes = new Map<string, number>(
        utilisateurIds.map((id) => [id, 0]),
      );
      for (const groupe of groupes) {
        if (groupe.technicien_id !== null) {
          comptes.set(groupe.technicien_id, groupe._count._all);
        }
      }
      return comptes;
    },
    client,
  );
}

/**
 * LA CIVILE D'AUJOURD'HUI DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08) — lue depuis
 * la même transaction que le filtre qu'elle borne, jamais depuis l'horloge de
 * l'appareil. Même forme que `debutDuJourSociete` de
 * `lib/interventions/depot.ts`.
 */
async function debutDuJourSociete(
  tx: Prisma.TransactionClient,
  contexte: ContexteSession,
): Promise<Date> {
  const societe = await tx.societe.findFirst({
    where: { id: exigerSocieteActive(contexte) },
    select: { fuseau_horaire: true },
  });
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  return instantDuJour(jourDe(maintenant(fuseau).local));
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

  // ── 2 et 3. L'AGENCE VÉRIFIÉE, PUIS L'HABILITATION ET LE RATTACHEMENT,
  // ENSEMBLE (AGENCE-ACTIVE, AA-3) ─────────────────────────────────────────
  //
  // Le contrôle vit DANS la même transaction que l'écriture, jamais avant :
  // une lecture séparée laisserait une fenêtre où l'agence change entre les
  // deux — même raisonnement que `creerSite` (`lib/sites/depot.ts`). Le refus
  // laisse alors l'identité déjà posée à l'étape 1 seule, sans société ni
  // rattachement — la même gêne d'exploitation, jamais une ouverture, déjà
  // décrite en tête de module pour tout refus sur cette seconde transaction.
  try {
    const resultat = await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const agence = await tx.agence.findFirst({
          where: { id: saisie.agence_id },
          select: { actif: true },
        });
        if (agence !== null && !agence.actif) {
          return {
            accepte: false as const,
            motif: "agence_inactive" as const,
          };
        }
        await habiliterEtRattacherDans(tx, societeId, utilisateurId, saisie);
        return { accepte: true as const };
      },
      client,
    );
    if (!resultat.accepte) {
      return resultat;
    }
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
      statut_ressource: saisie.statut_ressource,
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
 *
 * **Un passage VERS une agence inactive est refusé** (AGENCE-ACTIVE, AA-3)
 * — mais seulement s'il change réellement le rattachement : le MAINTIEN de
 * l'agence déjà posée, même inactive, reste accepté (même précédent que
 * `modifierSite`, `lib/sites/depot.ts`). La fiche actuelle est donc relue
 * ici avant l'écriture : sans elle, on ne saurait pas distinguer
 * « rattacher à » de « garder ».
 *
 * **« non renseigné » ne peut pas être RE-choisi une fois un statut de
 * ressource posé** (QG-9, D163) : même lecture de la fiche actuelle,
 * étendue au statut — sans elle, on ne saurait pas distinguer « poser » de
 * « retirer ».
 */
export async function modifierTechnicien(
  contexte: ContexteSession,
  utilisateurId: string,
  saisie: SaisieModificationTechnicien,
  client?: PrismaClient,
): Promise<ResultatModificationTechnicien> {
  try {
    const resultat = await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const technicien = await tx.technicien.findFirst({
          where: { utilisateur_id: utilisateurId },
          select: { agence_id: true, statut_ressource: true },
        });
        if (technicien !== null && technicien.agence_id !== saisie.agence_id) {
          const agence = await tx.agence.findFirst({
            where: { id: saisie.agence_id },
            select: { actif: true },
          });
          if (agence !== null && !agence.actif) {
            return {
              accepte: false as const,
              motif: "agence_inactive" as const,
            };
          }
        }
        if (
          technicien !== null &&
          technicien.statut_ressource !== null &&
          saisie.statut_ressource === null
        ) {
          return {
            accepte: false as const,
            motif: "statut_deja_pose" as const,
          };
        }
        const touchees = await tx.technicien.updateMany({
          where: { utilisateur_id: utilisateurId },
          data: {
            agence_id: saisie.agence_id,
            actif: saisie.actif,
            statut_ressource: saisie.statut_ressource,
          },
        });
        return touchees.count === 0
          ? { accepte: false as const, motif: "introuvable" as const }
          : { accepte: true as const };
      },
      client,
    );
    return resultat;
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}
