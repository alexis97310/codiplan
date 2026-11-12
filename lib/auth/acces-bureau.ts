import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { maintenant } from "@/lib/calendar/fuseau";
import {
  avecContexteApplicatif,
  garantirRoleApplicatif,
  prisma,
} from "@/lib/db/client";
import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { DUREE_LIEN_PREMIER_ACCES_SECONDES } from "./config";
import { type ContexteSession, exigerSocieteActive } from "./contexte";
import { peutPleinement } from "./habilitations";
import { exigeSecondFacteur, Role, ROLES, schemaRole } from "./roles";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "./lecture-identite";
import {
  copierLienDAccesPartage,
  detailEstCopie,
  envoyerLienDAccesPartage,
  identiteExclusiveALaSociete,
  type MotifRefusAccesPartage,
  roleDansLaSocieteActive,
  type ResultatEnvoiLien,
  viseCetteCible,
} from "./lien-d-acces";

/** Lectures `compte` simultanées, par appel à `parTranchesDeCinq` — voir sa JSDoc. */
const TAILLE_TRANCHE_LECTURE_COMPTE = 5;

/**
 * Résout `items` par `fn`, par tranches successives d'au plus
 * `TAILLE_TRANCHE_LECTURE_COMPTE` promesses simultanées — ordre conservé.
 * Partagée avec `etatsAccesDesTechniciens`
 * (`lib/auth/acces-technicien.ts`) : un `Promise.all` SANS plafond posant les
 * N lectures `compte.findFirst` de l'écran Équipe de front — chacune sa
 * propre transaction, `lib/auth/lecture-identite.ts` — dépasse, pour une
 * grande équipe, le pool Prisma par défaut (`lib/db/client.ts`) et le
 * `maxWait` de 2 s de `$transaction` : l'écran entier échouerait (« Unable to
 * start a transaction ») plutôt que d'être seulement lent (réserve du solde
 * 595, 9IC-CORRECTIFS-COURTS). La politique RLS `compte_lecture` reste
 * INCHANGÉE — plafonner la concurrence est la seule option hors territoire
 * d'une migration.
 */
export async function parTranchesDeCinq<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultats: R[] = [];
  for (let i = 0; i < items.length; i += TAILLE_TRANCHE_LECTURE_COMPTE) {
    const tranche = items.slice(i, i + TAILLE_TRANCHE_LECTURE_COMPTE);
    resultats.push(...(await Promise.all(tranche.map(fn))));
  }
  return resultats;
}

/**
 * LES COMPTES DE BUREAU (D196, 9ET-COMPTES-BUREAU-1 — décisions 78 et 80
 * d'Alexis, 12/10/2026).
 *
 * ## Ce que ce module ouvre
 *
 * Seuls les techniciens recevaient un accès depuis l'écran Équipe (D162) :
 * les comptes ADV, responsable matériel, responsable SAV, direction et
 * administrateur de société ne s'ouvraient que par le geste d'AMORÇAGE
 * (`scripts/amorcage-premier-compte.mts`, D65), réservé à la toute première
 * identité d'une société. Ce module ouvre le chemin ADMINISTRATIF pour les
 * suivants : lister les comptes de bureau de la société active, en créer un
 * (ou rattacher une identité déjà connue de la plateforme — même règle que
 * `lib/techniciens/depot.ts`), lui envoyer ou réémettre son lien d'accès.
 *
 * ## CE QUI N'EST PAS UN TECHNICIEN
 *
 * Un compte de bureau n'a AUCUNE ligne `technicien` : c'est une habilitation
 * `utilisateur_societe` seule, avec un rôle de bureau. Il n'a pas non plus
 * d'`actif` propre — cette table ne porte pas cette colonne — désactiver un
 * compte de bureau est hors du territoire de ce lot (voir D196).
 *
 * ## LE PIÈGE RLS DE `utilisateur_societe`, ET POURQUOI LE FILTRE EST EXPLICITE
 *
 * `utilisateur_societe` porte DEUX politiques de SELECT permissives : la
 * forme « société » ordinaire (I1), ET la forme « appartenance » (D61,
 * `utilisateur_societe_mes_habilitations`) qui rend à un compte SES PROPRES
 * lignes, toutes sociétés confondues — ancrée sur `app.utilisateur_id`, que
 * `avecContexteApplicatif` pose pour l'auteur de l'audit. PostgreSQL combine
 * les politiques permissives par OR : sous ce contexte, une lecture NON
 * filtrée rendrait donc aussi les propres habilitations de l'administrateur
 * dans SES AUTRES sociétés. `listerComptesDeBureau` filtre donc
 * EXPLICITEMENT `societe_id`, jamais seulement par le rôle.
 *
 * ## CE QUI EST PARTAGÉ AVEC LE TECHNICIEN
 *
 * L'envoi du lien lui-même — l'identité, le cliquet de D65, le jeton, le
 * courriel, la trace — vit dans `lib/auth/lien-d-acces.ts`, commun avec
 * `lib/auth/acces-technicien.ts`. Seule l'ÉTAPE 1 (« cette personne est-elle
 * membre, et sous quelle forme ? ») diffère.
 */

/** Les cinq rôles de bureau (décision 78 d'Alexis) — liste CLOSE. */
export const ROLES_DE_BUREAU: readonly Role[] = Object.freeze([
  Role.adv,
  Role.responsable_materiel,
  Role.responsable_sav,
  Role.direction,
  Role.admin_societe,
]);

/** Vrai si le rôle est l'un des cinq rôles de bureau. */
export function estRoleDeBureau(role: Role): boolean {
  return ROLES_DE_BUREAU.includes(role);
}

/**
 * LES CIBLES PROTÉGÉES DE LA COPIE D'UN NOUVEAU LIEN (décision B d'Alexis,
 * 30/10/2026, 9I7D) — un administrateur ne peut plus copier lui-même un
 * NOUVEAU lien d'accès (mot de passe oublié) vers un compte de direction ou
 * un autre administrateur de société : l'URL copiée est un secret au
 * porteur, et rien n'empêcherait alors l'administrateur de l'ouvrir et de
 * poser LUI-MÊME le mot de passe de cette personne. Liste CLOSE, comme
 * `ROLES_DE_BUREAU` — voir `copierNouveauLienDAccesBureau` ci-dessous. Le
 * PREMIER lien (compte sans mot de passe) et l'envoi par courriel ne sont
 * pas concernés.
 */
const ROLES_PROTEGES_COPIE_NOUVEAU_LIEN: readonly Role[] = Object.freeze([
  Role.direction,
  Role.admin_societe,
]);

/** Vrai si CE rôle ne peut pas recevoir un NOUVEAU lien copié (décision B). */
export function estCibleProtegeeCopieNouveauLien(role: Role): boolean {
  return ROLES_PROTEGES_COPIE_NOUVEAU_LIEN.includes(role);
}

/**
 * Ce qu'un refus NOMMÉ dit pour LA SEULE copie d'un NOUVEAU lien de bureau —
 * les motifs partagés (`MotifRefusAccesPartage`) plus `cible_protegee`
 * (décision B) et `autre_societe` (D226, 9I8D1) — ni l'un ni l'autre ne sont
 * rendus par le premier lien ni par l'envoi par courriel.
 */
export type MotifRefusCopieNouveauLienBureau =
  MotifRefusAccesPartage | "cible_protegee" | "autre_societe";

export type ResultatCopieNouveauLienBureau =
  | { readonly accepte: true; readonly url: string }
  | {
      readonly accepte: false;
      readonly motif: MotifRefusCopieNouveauLienBureau;
    };

const texteNonVide = z.string().trim().min(1);

/**
 * SAISIE DE CRÉATION D'UN COMPTE DE BUREAU.
 *
 * `role` accepte ici les DIX rôles de `schemaRole` — la forme est validée au
 * plus large, et c'est `creerCompteDeBureau` qui refuse, NOMMÉMENT, un rôle
 * hors de la liste des cinq (`role_hors_liste`) : un rôle technicien ou
 * client n'est pas une saisie malformée, c'est une tentative que l'écran
 * suivant ne proposera jamais.
 */
export const schemaCreationCompteDeBureau = z.object({
  nom: texteNonVide,
  courriel: z.email(),
  role: schemaRole,
});

export type SaisieCompteDeBureau = z.infer<typeof schemaCreationCompteDeBureau>;

/**
 * Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50).
 *
 * `courriel_connu_ailleurs` (décision d'Alexis du 10/11/2026,
 * 9L01-COPIE-LIEN-EXCLUSIVITE) — voir `creerCompteDeBureau` : UN SEUL motif,
 * neutre, pour toute adresse déjà connue d'une AUTRE société, quel que soit
 * son rôle là-bas ou si son compte y est déjà activé.
 */
export type MotifRefusCompteDeBureau =
  "role_hors_liste" | "deja_membre" | "courriel_connu_ailleurs";

export type ResultatCreationCompteDeBureau =
  | {
      readonly accepte: true;
      readonly utilisateurId: string;
      /** Vrai si la personne existait déjà (un autre courriel pris). */
      readonly rattache: boolean;
    }
  | { readonly accepte: false; readonly motif: MotifRefusCompteDeBureau };

/** Un compte de bureau tel qu'un écran le lira (lot 2). */
export type LigneCompteDeBureau = {
  readonly utilisateurId: string;
  readonly nom: string;
  readonly email: string;
  readonly role: Role;
  readonly mfaActif: boolean;
  readonly secondFacteurExige: boolean;
};

/**
 * LES COMPTES DE BUREAU DE LA SOCIÉTÉ ACTIVE.
 *
 * Deux lectures, comme `listerLesTechniciens` : `utilisateur_societe` ne
 * porte aucune clé étrangère Prisma vers `utilisateur` (D39). Le filtre sur
 * `societe_id` est EXPLICITE (voir l'en-tête du module) — jamais laissé à la
 * seule politique RLS.
 */
export async function listerComptesDeBureau(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneCompteDeBureau[]> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const habilitations = await tx.utilisateurSociete.findMany({
        where: { societe_id: societeId, role: { in: [...ROLES_DE_BUREAU] } },
        select: { utilisateur_id: true, role: true },
      });
      if (habilitations.length === 0) {
        return [];
      }
      const identites = await tx.utilisateur.findMany({
        where: { id: { in: habilitations.map((h) => h.utilisateur_id) } },
        select: { id: true, nom: true, email: true, mfa_actif: true },
      });
      const identiteDe = new Map(identites.map((u) => [u.id, u]));
      return habilitations.map((habilitation) => {
        const identite = identiteDe.get(habilitation.utilisateur_id);
        return {
          utilisateurId: habilitation.utilisateur_id,
          nom: identite?.nom ?? "",
          email: identite?.email ?? "",
          role: habilitation.role,
          mfaActif: identite?.mfa_actif ?? false,
          secondFacteurExige: exigeSecondFacteur(habilitation.role),
        };
      });
    },
    client,
  );
}

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";

/**
 * CRÉE UN COMPTE DE BUREAU — l'identité par le chemin qui compose le contexte
 * d'authentification (même maison que `creerTechnicien`,
 * `lib/techniciens/depot.ts`), puis l'habilitation de bureau.
 *
 * Le rôle hors liste est refusé AVANT toute écriture : c'est une saisie
 * invalide pour CE chemin, jamais une course avec la base.
 *
 * **UN COURRIEL DÉJÀ PRIS, RATTACHÉ SANS CONTRÔLE — FERMÉ PAR D226 (décision
 * d'Alexis du 10/11/2026, 9L01-COPIE-LIEN-EXCLUSIVITE)** — avant ce lot,
 * `designe.utilisateur.findUnique` rattachait l'identité trouvée par courriel
 * à la société active QUELLE QUE SOIT SA SITUATION AILLEURS : une adresse déjà
 * membre d'une AUTRE société recevait ici une SECONDE habilitation, offrant à
 * cette société un degré de contrôle sur une identité qu'elle ne possédait pas
 * entièrement. `identiteExclusiveALaSociete` (D226, `lib/auth/lien-d-acces.ts`)
 * tranche maintenant la question AVANT toute écriture, et son seul refus
 * nommé, `courriel_connu_ailleurs`, est délibérément UNIQUE et NEUTRE
 * (D50 renforcé) : il ne distingue ni le rôle de cette identité ailleurs, ni
 * si son compte y est déjà activé — un appelant qui ne connaît pas encore
 * cette adresse n'apprend donc rien de plus que « elle ne peut pas être
 * rattachée ici ». Un courriel connu de la MÊME société (déjà membre) garde
 * son refus propre, `deja_membre`, inchangé.
 */
export async function creerCompteDeBureau(
  contexte: ContexteSession,
  saisie: SaisieCompteDeBureau,
  client?: PrismaClient,
): Promise<ResultatCreationCompteDeBureau> {
  if (!estRoleDeBureau(saisie.role)) {
    return { accepte: false, motif: "role_hors_liste" };
  }

  const societeId = exigerSocieteActive(contexte);
  if (client === undefined) {
    await garantirRoleApplicatif();
  }
  const base = client ?? prisma;

  // ── L'IDENTITÉ, PAR `avecDesignationAuth` — jamais posée à la main ───────
  const administration: ContexteAdministratif = {
    societeId,
    role: contexte.role,
  };
  const designe = avecDesignationAuth(base, administration);

  const existant = await designe.utilisateur.findUnique({
    where: { email: saisie.courriel },
    select: { id: true },
  });

  let utilisateurId: string;
  const rattache = existant !== null;
  if (existant !== null) {
    if (!(await identiteExclusiveALaSociete(contexte, existant.id, base))) {
      return { accepte: false, motif: "courriel_connu_ailleurs" };
    }
    utilisateurId = existant.id;
  } else {
    const cree = await designe.utilisateur.create({
      data: { id: uuidv7(), nom: saisie.nom, email: saisie.courriel },
      select: { id: true },
    });
    utilisateurId = cree.id;
  }

  // ── L'HABILITATION DE BUREAU ──────────────────────────────────────────────
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.utilisateurSociete.create({
          data: {
            id: uuidv7(),
            utilisateur_id: utilisateurId,
            societe_id: societeId,
            role: saisie.role,
          },
          select: { id: true },
        }),
      client,
    );
  } catch (erreur: unknown) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === VIOLATION_UNICITE
    ) {
      return { accepte: false, motif: "deja_membre" };
    }
    throw erreur;
  }

  return { accepte: true, utilisateurId, rattache };
}

/** Ce que la trace nomme avant la virgule — voir `lib/auth/lien-d-acces.ts`. */
const LIBELLE_CHEMIN =
  "lien d'accès envoyé par l'administrateur de la société ou la direction — " +
  "compte de bureau (D196)";

/**
 * « NOUVEAU LIEN » (mot de passe oublié, D86, décision n° 86 d'Alexis du
 * 13/10/2026) — nommé distinctement du premier envoi dans la trace.
 */
const LIBELLE_CHEMIN_NOUVEAU_LIEN =
  "nouveau lien (mot de passe oublié) envoyé par l'administrateur de la " +
  "société ou la direction — compte de bureau (D86)";

/**
 * CETTE PERSONNE EST-ELLE UN COMPTE DE BUREAU DE LA SOCIÉTÉ ACTIVE ? —
 * partagé par `envoyerLienDAccesBureau` et `envoyerNouveauLienDAccesBureau`
 * (D86).
 *
 * `avecSociete` (jamais `avecContexteApplicatif`) : il ne pose PAS
 * `app.utilisateur_id`, et la forme « appartenance » (D61) ne peut donc
 * apporter aucune ligne supplémentaire — voir l'en-tête du module.
 */
async function compteDeBureauMembre(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<boolean> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const habilitation = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findFirst({
      where: { utilisateur_id: utilisateurId, societe_id: societeId },
      select: { role: true },
    }),
  );
  return habilitation !== null && estRoleDeBureau(habilitation.role);
}

/**
 * LE RÔLE du compte de bureau membre, ou `null` s'il n'est pas membre —
 * variante de `compteDeBureauMembre` pour le SEUL appelant qui a besoin de
 * CONNAÎTRE le rôle de la cible avant d'agir (`copierNouveauLienDAccesBureau`,
 * décision B) plutôt que sa seule appartenance. Posée sur
 * `roleDansLaSocieteActive` (partagée avec le technicien, D226) : seule la
 * restriction « rôle de bureau » est propre à ce module.
 */
async function roleDuCompteDeBureauMembre(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<Role | null> {
  const role = await roleDansLaSocieteActive(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (role === null || !estRoleDeBureau(role)) {
    return null;
  }
  return role;
}

/**
 * Envoie (ou réémet) le lien de premier accès d'un compte de bureau de la
 * société active.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs` (`admin_societe` ET, depuis D199, 13/10/2026,
 *   décision n° 85, `direction`). Vérifié dans `envoyerLienDAccesPartage`,
 *   pas seulement à la porte de la route.
 * @param utilisateurId le compte visé.
 */
export async function envoyerLienDAccesBureau(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiLien> {
  if (!(await compteDeBureauMembre(contexteAdmin, utilisateurId, client))) {
    return { accepte: false, motif: "introuvable" };
  }

  return envoyerLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN,
    client,
    environnement,
  );
}

/**
 * ENVOIE UN NOUVEAU LIEN D'ACCÈS À UN COMPTE DE BUREAU DONT L'ACCÈS EST DÉJÀ
 * ACTIF (D86) — le cliquet de D65 est sauté pour CE geste seul
 * (`OptionsEnvoiLien.nouveauLien`, `lib/auth/lien-d-acces.ts`). Le premier
 * envoi (`envoyerLienDAccesBureau`) garde son refus intact.
 *
 * @param contexteAdmin voir `envoyerLienDAccesBureau`.
 * @param utilisateurId le compte visé.
 */
export async function envoyerNouveauLienDAccesBureau(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiLien> {
  if (!(await compteDeBureauMembre(contexteAdmin, utilisateurId, client))) {
    return { accepte: false, motif: "introuvable" };
  }

  return envoyerLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN_NOUVEAU_LIEN,
    client,
    environnement,
    { nouveauLien: true },
  );
}

/**
 * Ce qu'un refus NOMMÉ dit pour LA SEULE copie d'un PREMIER lien de bureau —
 * les motifs partagés (`MotifRefusAccesPartage`) plus `autre_societe` (D226,
 * 9L01-COPIE-LIEN-EXCLUSIVITE), jamais rendu par l'envoi par courriel.
 */
export type MotifRefusCopieLienBureau =
  MotifRefusAccesPartage | "autre_societe";

export type ResultatCopieLienBureau =
  | { readonly accepte: true; readonly url: string }
  | { readonly accepte: false; readonly motif: MotifRefusCopieLienBureau };

/**
 * COPIE (SANS L'ENVOYER) le lien de premier accès d'un compte de bureau de la
 * société active — voir `copierLienDAccesPartage`
 * (`lib/auth/lien-d-acces.ts`) pour le pourquoi (9I6B-LIEN-ACCES-A-COPIER,
 * D170). Même garde d'appartenance que `envoyerLienDAccesBureau`.
 *
 * **D226, ajoutée par 9L01-COPIE-LIEN-EXCLUSIVITE** — une identité aussi
 * rattachée à une AUTRE société refuse ICI, AVANT tout jeton émis, exactement
 * comme `copierNouveauLienDAccesBureau` plus bas : copier rend l'URL — un
 * secret au porteur — à l'administrateur lui-même, qui pourrait l'ouvrir et
 * poser le mot de passe d'une identité qu'il ne contrôle pas entièrement.
 * Aucune « cible protégée » (décision B, D223) ici : ce contrôle ne porte que
 * sur la copie d'un NOUVEAU lien — le PREMIER lien d'une cible `direction` ou
 * `admin_societe` reste permis, comme avant ce lot.
 */
export async function copierLienDAccesBureau(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
): Promise<ResultatCopieLienBureau> {
  if (!(await compteDeBureauMembre(contexteAdmin, utilisateurId, client))) {
    return { accepte: false, motif: "introuvable" };
  }
  if (
    !(await identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client))
  ) {
    return { accepte: false, motif: "autre_societe" };
  }

  return copierLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN,
    client,
  );
}

/**
 * COPIE UN NOUVEAU LIEN D'ACCÈS (mot de passe oublié, D86) D'UN COMPTE DE
 * BUREAU DONT L'ACCÈS EST DÉJÀ ACTIF — le cliquet de D65 est sauté pour CE
 * geste seul, exactement comme `envoyerNouveauLienDAccesBureau` (9I6B).
 *
 * **DÉCISION B d'Alexis (30/10/2026, 9I7D)** — une cible `direction` ou
 * `admin_societe` refuse ICI, AVANT tout jeton émis : copier un nouveau lien
 * rendrait son URL — un secret au porteur — à un administrateur qui pourrait
 * l'ouvrir lui-même et poser le mot de passe de cette personne. Le PREMIER
 * lien (`copierLienDAccesBureau`) et l'envoi par courriel
 * (`envoyerNouveauLienDAccesBureau`) restent permis pour ces deux rôles.
 *
 * **DÉCISION D226 d'Alexis (01/11/2026, 9I8D1)** — APRÈS le rôle protégé,
 * une cible rattachée à une AUTRE société (bureau, technicien ou portail)
 * refuse aussi : copier un nouveau lien rendrait le même secret au porteur
 * utilisable par une identité que l'administrateur de CETTE société ne
 * contrôle pas entièrement. Ordre des contrôles : capacité (porte de la
 * route) → rôle protégé (D223) → exclusivité (D226) — un appelant sans droit
 * n'apprend rien sur la cible.
 */
export async function copierNouveauLienDAccesBureau(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
): Promise<ResultatCopieNouveauLienBureau> {
  const role = await roleDuCompteDeBureauMembre(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (role === null) {
    return { accepte: false, motif: "introuvable" };
  }
  if (estCibleProtegeeCopieNouveauLien(role)) {
    return { accepte: false, motif: "cible_protegee" };
  }
  if (
    !(await identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client))
  ) {
    return { accepte: false, motif: "autre_societe" };
  }

  return copierLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN_NOUVEAU_LIEN,
    client,
    { nouveauLien: true },
  );
}

/** L'état d'accès d'un compte de bureau, tel que l'écran Équipe le montre. */
export type EtatAccesBureau =
  | { readonly etat: "aucun" }
  | {
      readonly etat: "lien_envoye";
      readonly horodatage: Date;
      /** Vrai si ce dernier lien a été COPIÉ, jamais envoyé par courriel (B6). */
      readonly copie: boolean;
    }
  | {
      readonly etat: "lien_expire";
      readonly horodatage: Date;
      readonly copie: boolean;
    }
  | { readonly etat: "actif" };

/**
 * L'état d'accès de chaque compte de bureau demandé.
 *
 * Même forme que `etatsAccesDesTechniciens` (`lib/auth/acces-technicien.ts`),
 * complétée par « lien expiré » : un lien envoyé il y a plus de
 * `DUREE_LIEN_PREMIER_ACCES_SECONDES` et jamais suivi d'un mot de passe. Un
 * second envoi reste toujours possible depuis cet état — ce n'est pas un
 * refus, c'est une information d'affichage.
 *
 * **SEULS LES IDENTIFIANTS HABILITÉS DANS LA SOCIÉTÉ ACTIVE SONT RENDUS**
 * (solde 172, relecture de 9ET-COMPTES-BUREAU-1) — le filtre EXPLICITE de
 * l'en-tête du module s'applique ici aussi : un appelant qui transmettrait un
 * identifiant d'une AUTRE société, ou qui n'est plus un compte de bureau,
 * n'obtient aucune ligne pour lui plutôt qu'un état lu par désignation sans
 * égard à la société.
 *
 * **L'HISTORIQUE DE TOUS CEUX QUI ADMINISTRENT LES IDENTITÉS DE LA SOCIÉTÉ,
 * PAS SEULEMENT CELUI QUI REGARDE** (solde 175) — `journal_acces` ne se lit
 * que PAR DÉSIGNATION, une politique RLS self-authored (`journal_acces_lecture`,
 * `utilisateur_id = app.authentification_utilisateur_id`) : une seule
 * transaction, désignée sur `contexteAdmin.utilisateurId`, ne rendrait QUE ce
 * que CETTE personne a elle-même envoyé, alors qu'une autre personne habilitée
 * de la même société peut avoir envoyé le dernier lien. Une transaction PAR
 * rôle au ● sur `administrer_utilisateurs` (`admin_societe` ET, depuis D199,
 * `direction` — jamais une liste écrite à la main, voir
 * `lib/auth/habilitations.ts`), puis le plus récent événement visant chaque
 * cible, tous confondus.
 *
 * **`designe.compte.findFirst` PORTE UN `orderBy` DE DÉFENSE, PAS DE
 * CORRECTIF** — voir la preuve au même endroit dans `etatsAccesDesTechniciens`
 * (`lib/auth/acces-technicien.ts`) : mesuré sur les trois chemins de création
 * de ce dépôt, `(emetteur, compte_externe_id)` borne déjà à UNE ligne par
 * utilisateur (9I4-EQUIPE-N-PLUS-UN, point 2). `orderBy: [{ cree_le: "asc" },
 * { id: "asc" }]` (9IC-CORRECTIFS-COURTS) ne corrige donc rien d'observé —
 * il borne le résultat si un jour un second émetteur ouvrait une deuxième
 * ligne `compte` pour un même utilisateur, plutôt que de laisser Postgres
 * choisir silencieusement laquelle `findFirst` rend.
 */
export async function etatsAccesDesComptes(
  contexteAdmin: ContexteSession,
  utilisateurIds: readonly string[],
  client: PrismaClient = prisma,
): Promise<ReadonlyMap<string, EtatAccesBureau>> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  const societeId = exigerSocieteActive(contexteAdmin);
  const designe = avecDesignationAuth(client);

  const habilitations = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findMany({
      where: {
        societe_id: societeId,
        utilisateur_id: { in: [...utilisateurIds] },
        role: { in: [...ROLES_DE_BUREAU] },
      },
      select: { utilisateur_id: true },
    }),
  );
  const idsValides = new Set(habilitations.map((h) => h.utilisateur_id));
  if (idsValides.size === 0) {
    return new Map();
  }

  const administrateurs = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findMany({
      where: {
        societe_id: societeId,
        role: {
          in: ROLES.filter((r) =>
            peutPleinement(r, "administrer_utilisateurs"),
          ),
        },
      },
      select: { utilisateur_id: true },
    }),
  );
  const evenements = (
    await Promise.all(
      administrateurs.map((administrateur) =>
        designe.journalAcces.findMany({
          where: {
            utilisateur_id: administrateur.utilisateur_id,
            evenement: {
              in: ["ouverture_identite", "reemission_premier_acces"],
            },
          },
          select: { detail: true, horodatage: true },
        }),
      ),
    )
  ).flat();

  // `maintenant` exige un fuseau (gardien L0-08, point 2) même si cette
  // comparaison est une DURÉE, pas une lecture calendaire — le fuseau choisi
  // ne change donc rien à l'instant rendu, qui seul importe ici.
  const { instant } = maintenant("UTC");
  const limiteExpiration = new Date(
    instant.getTime() - DUREE_LIEN_PREMIER_ACCES_SECONDES * 1000,
  );

  // ── LE COMPTE DE CHAQUE PERSONNE, PAR TRANCHES DE 5 (9I4 puis 9IC) ────────
  //
  // `compte` porte la politique « DÉSIGNATION » (self-authored,
  // `utilisateur_id = app.authentification_utilisateur_id`,
  // `lib/auth/lecture-identite.ts`, `CLES_DESIGNATION.compte`) : chaque
  // lecture ne peut nommer QU'UNE ligne, et une seule — `aplatirConjonction`
  // n'y lit même pas un `OR`, par construction (« une clé trouvée sous un OR
  // ne bornerait rien »). **Mesuré** (9I4-EQUIPE-N-PLUS-UN, point 3) :
  // `compte.findMany({ where: { utilisateur_id: { in: [...] } } })` sous ce
  // même client rend ZÉRO ligne — `texteDe` ne lit pas `{ in }`, la
  // désignation part vide, et `app.authentification_utilisateur_id` n'est
  // jamais posée pour cette requête. Une lecture BATCH, en UNE requête SQL,
  // qui respecterait cette politique exigerait qu'elle accepte un ENSEMBLE
  // d'identités plutôt qu'une seule — une politique RLS, hors territoire de ce
  // lot (voir `docs/propositions/9I4-EQUIPE-N-PLUS-UN/passation.md`).
  //
  // Ce qui reste, et qui ne touche ni RLS ni migration : les N lectures
  // restent nécessaires, mais PAR TRANCHES DE `TAILLE_TRANCHE_LECTURE_COMPTE`
  // plutôt que l'une après l'autre OU toutes de front sans plafond — voir
  // `parTranchesDeCinq` ci-dessus.
  const comptes = await parTranchesDeCinq(
    utilisateurIds.filter((utilisateurId) => idsValides.has(utilisateurId)),
    async (utilisateurId) => ({
      utilisateurId,
      compte: await designe.compte.findFirst({
        where: { utilisateur_id: utilisateurId },
        select: { mot_de_passe: true, cree_le: true },
        orderBy: [{ cree_le: "asc" }, { id: "asc" }],
      }),
    }),
  );

  const resultat = new Map<string, EtatAccesBureau>();
  for (const { utilisateurId, compte } of comptes) {
    if (compte === null) {
      resultat.set(utilisateurId, { etat: "aucun" });
      continue;
    }
    if (compte.mot_de_passe !== null) {
      resultat.set(utilisateurId, { etat: "actif" });
      continue;
    }
    const correspondants = evenements.filter((evenement) =>
      viseCetteCible(evenement.detail, utilisateurId),
    );
    const dernier =
      correspondants.length === 0
        ? undefined
        : correspondants.reduce((plusRecent, evenement) =>
            evenement.horodatage > plusRecent.horodatage
              ? evenement
              : plusRecent,
          );
    const horodatage = dernier?.horodatage ?? compte.cree_le;
    resultat.set(utilisateurId, {
      etat: horodatage < limiteExpiration ? "lien_expire" : "lien_envoye",
      horodatage,
      copie: detailEstCopie(dernier?.detail ?? null),
    });
  }
  return resultat;
}
