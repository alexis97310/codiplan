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
import { exigeSecondFacteur, Role, schemaRole } from "./roles";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "./lecture-identite";
import {
  envoyerLienDAccesPartage,
  type ResultatEnvoiLien,
  viseCetteCible,
} from "./lien-d-acces";

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

/** Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50). */
export type MotifRefusCompteDeBureau = "role_hors_liste" | "deja_membre";

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
  "lien d'accès envoyé par l'administrateur de la société — compte de " +
  "bureau (D196)";

/**
 * Envoie (ou réémet) le lien de premier accès d'un compte de bureau de la
 * société active.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs` (D37). Vérifié dans
 *   `envoyerLienDAccesPartage`, pas seulement à la porte de la route.
 * @param utilisateurId le compte visé.
 */
export async function envoyerLienDAccesBureau(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiLien> {
  const societeId = exigerSocieteActive(contexteAdmin);

  // ── CETTE PERSONNE EST-ELLE UN COMPTE DE BUREAU DE LA SOCIÉTÉ ACTIVE ? ───
  //
  // `avecSociete` (jamais `avecContexteApplicatif`) : il ne pose PAS
  // `app.utilisateur_id`, et la forme « appartenance » (D61) ne peut donc
  // apporter aucune ligne supplémentaire — voir l'en-tête du module.
  const habilitation = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findFirst({
      where: { utilisateur_id: utilisateurId, societe_id: societeId },
      select: { role: true },
    }),
  );
  if (habilitation === null || !estRoleDeBureau(habilitation.role)) {
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

/** L'état d'accès d'un compte de bureau, tel que l'écran Équipe le montre. */
export type EtatAccesBureau =
  | { readonly etat: "aucun" }
  | { readonly etat: "lien_envoye"; readonly horodatage: Date }
  | { readonly etat: "lien_expire"; readonly horodatage: Date }
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
 * **L'HISTORIQUE DE TOUS LES ADMINISTRATEURS DE LA SOCIÉTÉ, PAS SEULEMENT
 * CELUI QUI REGARDE** (solde 175) — `journal_acces` ne se lit que PAR
 * DÉSIGNATION, une politique RLS self-authored (`journal_acces_lecture`,
 * `utilisateur_id = app.authentification_utilisateur_id`) : une seule
 * transaction, désignée sur `contexteAdmin.utilisateurId`, ne rendrait QUE ce
 * que CET administrateur a lui-même envoyé, alors qu'un autre administrateur
 * de la même société peut avoir envoyé le dernier lien. Une transaction PAR
 * administrateur de la société (`Role.admin_societe`, seul rôle à détenir
 * `administrer_utilisateurs`, D37), puis le plus récent événement visant
 * chaque cible, tous administrateurs confondus.
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
      where: { societe_id: societeId, role: Role.admin_societe },
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

  const resultat = new Map<string, EtatAccesBureau>();
  for (const utilisateurId of utilisateurIds) {
    if (!idsValides.has(utilisateurId)) {
      continue;
    }
    const compte = await designe.compte.findFirst({
      where: { utilisateur_id: utilisateurId },
      select: { mot_de_passe: true, cree_le: true },
    });
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
    });
  }
  return resultat;
}
