import { EvenementAcces, type PrismaClient } from "@prisma/client";

import {
  avecContexteApplicatif,
  prisma as clientParDefaut,
} from "@/lib/db/client";
import { avecSociete, VARIABLE_SESSION_UTILISATEUR } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { type ContexteSession, exigerSocieteActive } from "./contexte";
import { peut, peutPleinement } from "./habilitations";
import { avecDesignationAuth } from "./lecture-identite";
import { ROLES, type Role } from "./roles";
import { habilitationsDuCompte } from "./societe-active";

/**
 * RETIRE L'ACCÈS D'UN COMPTE INTERNE (9L03C — REPRISE de 9L03A ; décision
 * d'Alexis du 10/11/2026 puis du 13/11/2026, « Désactiver »).
 *
 * ## LA LIGNE `utilisateur_societe` N'EST JAMAIS SUPPRIMÉE
 *
 * 9L03A a mesuré, avant tout code, que la SUPPRIMER se heurte à cinq
 * contraintes `ON DELETE RESTRICT` déjà en production
 * (`technicien_habilitation`, `absence`, `segment_travail` auteur,
 * `intervention_pause` ouvert_par et fermée_par) dès que la personne porte
 * une activité enregistrée — la cible la plus courante de ce geste. Le geste
 * pose donc `actif = false`, même patron que `revoquerAccesPortailClient`
 * (ci-dessous, `lien-d-acces.ts`) pour `utilisateur_client.actif`. La fiche
 * `technicien` et la notion « technicien inactif » du planning n'en sont pas
 * changées : ce sont deux notions distinctes.
 *
 * ## LE DERNIER ADMINISTRATEUR NE SE RETIRE JAMAIS LUI-MÊME HORS DE SON RÔLE
 *
 * Un compte qui tient `administrer_utilisateurs` au complet (`admin_societe`
 * ou `direction`, D199) ne peut pas se voir retirer l'accès s'il est le
 * SEUL de la société à le tenir — y compris quand l'appelant se vise
 * lui-même : sans administrateur restant, plus personne ne pourrait rouvrir
 * un accès retiré par erreur.
 *
 * ## LA FERMETURE DES SESSIONS, SELON CE QUI RESTE AILLEURS
 *
 * `session` ne porte qu'UNE société active à la fois
 * (`societe_id_active`) ; retirer l'accès À CETTE société ne doit fermer
 * QUE les sessions actives sur ELLE si la personne garde un accès ailleurs
 * sur la plateforme (une autre société interne, ou un rattachement portail)
 * — et TOUTES ses sessions si ce n'est plus le cas, pour qu'aucune session
 * ouverte ne survive à la perte de tout accès. `habilitationsDuCompte`
 * (`societe-active.ts`) est relue APRÈS la désactivation, dans une
 * transaction DISTINCTE : c'est la même forme « identité » que
 * `resteUnRattachementClient`/`resteUnRoleInterne` de
 * `revoquerAccesPortailClient`, et elle doit voir l'écriture déjà commitée.
 *
 * `session_fermeture` (DELETE) n'admet que le JETON ou SA PROPRE ligne,
 * ancrée sur `app.utilisateur_id` : fermer la session D'UN TIERS exige donc
 * de poser cette variable sur la CIBLE, exactement comme
 * `revoquerAccesPortailClient` le fait déjà (`VARIABLE_SESSION_UTILISATEUR`).
 *
 * ## LA TRACE
 *
 * Un seul événement, `EvenementAcces.retrait_acces_interne`, couvre la
 * désactivation ET la fermeture des sessions qu'elle entraîne — la ligne se
 * désigne par son AUTEUR, l'administrateur (même forme que les autres
 * événements de ce module), `detail` porte la cible.
 */
export type MotifRefusRetraitAcces = "introuvable" | "dernier_administrateur";

export type ResultatRetraitAcces =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly motif: MotifRefusRetraitAcces };

/** Ce que le geste refuse pour une raison qui n'est PAS un motif nommé. */
export class RefusRetraitAcces extends Error {}

function exigerCapaciteRetraitAcces(
  contexteAdmin: ContexteSession,
): NonNullable<ContexteSession["role"]> {
  const role = contexteAdmin.role;
  if (role === null || !peut(role, "administrer_utilisateurs")) {
    throw new RefusRetraitAcces(
      `Le rôle « ${role ?? "aucun"} » ne peut pas retirer l'accès d'un ` +
        "compte interne : réservé à l'administrateur de la société ou à " +
        "la direction (D37/D199).",
    );
  }
  return role;
}

/** Les rôles qui tiennent `administrer_utilisateurs` AU COMPLET — liste dérivée, jamais écrite à la main. */
const ROLES_ADMINISTRATEURS: readonly Role[] = ROLES.filter((role) =>
  peutPleinement(role, "administrer_utilisateurs"),
);

export async function retirerAccesInterne(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = clientParDefaut,
): Promise<ResultatRetraitAcces> {
  const societeId = exigerSocieteActive(contexteAdmin);
  exigerCapaciteRetraitAcces(contexteAdmin);

  const cible = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findFirst({
      where: {
        utilisateur_id: utilisateurId,
        societe_id: societeId,
        actif: true,
      },
      select: { id: true, role: true },
    }),
  );
  if (cible === null) {
    return { accepte: false, motif: "introuvable" };
  }

  if (peutPleinement(cible.role, "administrer_utilisateurs")) {
    const administrateurs = await avecSociete(client, societeId, (tx) =>
      tx.utilisateurSociete.count({
        where: {
          societe_id: societeId,
          actif: true,
          role: { in: [...ROLES_ADMINISTRATEURS] },
        },
      }),
    );
    if (administrateurs <= 1) {
      return { accepte: false, motif: "dernier_administrateur" };
    }
  }

  await avecContexteApplicatif(
    contexteAdmin,
    (tx) =>
      tx.utilisateurSociete.updateMany({
        where: { id: cible.id },
        data: { actif: false },
      }),
    client,
  );

  // ── RELUE APRÈS COMMIT, FORME « IDENTITÉ » (voir l'en-tête) ──────────────
  const habilitationsRestantes = await habilitationsDuCompte(
    utilisateurId,
    client,
  );
  const fermerToutesLesSessions = habilitationsRestantes.length === 0;

  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VARIABLE_SESSION_UTILISATEUR,
      utilisateurId,
    );
    if (fermerToutesLesSessions) {
      await tx.session.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
    } else {
      await tx.session.deleteMany({
        where: { utilisateur_id: utilisateurId, societe_id_active: societeId },
      });
    }
  });

  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: contexteAdmin.utilisateurId,
      evenement: EvenementAcces.retrait_acces_interne,
      societe_id_cible: societeId,
      role: cible.role,
      detail:
        `Accès retiré ; sessions ` +
        `${fermerToutesLesSessions ? "fermées entièrement (aucune autre habilitation)" : "fermées pour cette société (habilitation restante ailleurs)"} ; ` +
        `cible:${utilisateurId}`,
    },
  });

  return { accepte: true };
}

/**
 * RÉTABLIT L'ACCÈS D'UN COMPTE INTERNE DONT LA LIGNE `utilisateur_societe`
 * EST INACTIVE (9L04K-REACTIVER-ACCES-INTERNE, décision d'Alexis du
 * 10/11/2026 puis du 13/11/2026 — « Ré-accorder l'accès = réactiver la ligne
 * par le chemin existant »).
 *
 * ## LE BOUTON DIRECT DE LA LIGNE « ACCÈS RETIRÉ », PAS LE FORMULAIRE DE
 * CRÉATION
 *
 * Ce geste est le symétrique de `retirerAccesInterne` ci-dessus : il pose
 * `actif = true` sur la MÊME ligne, sans rien changer d'autre — ni le rôle
 * (déjà porté par la ligne), ni la fiche `technicien` (jamais touchée par le
 * retrait, voir son en-tête, D196). C'est le chemin du bouton « Rétablir
 * l'accès » de l'écran Équipe. Le chemin de CRÉATION (`creerCompteDeBureau`,
 * `lib/auth/acces-bureau.ts`, et `creerTechnicien`/`habiliterEtRattacherDans`,
 * `lib/techniciens/depot.ts`) réactive aussi une ligne inactive quand le
 * formulaire est resoumis pour la même adresse — mais lui applique le RÔLE
 * demandé par ce formulaire, ce que ce geste-ci ne fait jamais.
 *
 * ## AUCUNE TRACE AU JOURNAL D'ACCÈS — MESURÉ, PAS CORRIGÉ
 *
 * Voir la passation de ce lot : la seule valeur d'`EvenementAcces`
 * disponible pour UN GESTE DE CE SENS (`retrait_acces_interne`) nomme
 * explicitement le geste INVERSE — l'enum l'engage « un seul geste, un seul
 * événement » — et en ajouter une neuve est une migration, hors territoire de
 * ce lot. L'écriture elle-même reste tracée : `utilisateur_societe` est dans
 * le périmètre audité par déclencheur (I8, `journal_audit`), auteur et
 * avant/après compris — ce geste n'est donc pas invisible, seul
 * `journal_acces` ne le nomme pas.
 *
 * ## LA SESSION NE SE ROUVRE PAS TOUTE SEULE
 *
 * `retirerAccesInterne` ferme des sessions ; ce geste n'en rouvre aucune —
 * la personne se reconnecte normalement, par son lien d'accès habituel
 * (inchangé, jamais réémis ici).
 */
export type MotifRefusRetablissementAcces = "introuvable" | "deja_membre";

export type ResultatRetablissementAcces =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly motif: MotifRefusRetablissementAcces };

/** Ce que le geste refuse pour une raison qui n'est PAS un motif nommé. */
export class RefusRetablissementAcces extends Error {}

function exigerCapaciteRetablissementAcces(
  contexteAdmin: ContexteSession,
): void {
  const role = contexteAdmin.role;
  if (role === null || !peut(role, "administrer_utilisateurs")) {
    throw new RefusRetablissementAcces(
      `Le rôle « ${role ?? "aucun"} » ne peut pas rétablir l'accès d'un ` +
        "compte interne : réservé à l'administrateur de la société ou à " +
        "la direction (D37/D199).",
    );
  }
}

export async function retablirAccesInterne(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = clientParDefaut,
): Promise<ResultatRetablissementAcces> {
  const societeId = exigerSocieteActive(contexteAdmin);
  exigerCapaciteRetablissementAcces(contexteAdmin);

  const cible = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findFirst({
      where: { utilisateur_id: utilisateurId, societe_id: societeId },
      select: { id: true, actif: true },
    }),
  );
  if (cible === null) {
    return { accepte: false, motif: "introuvable" };
  }
  if (cible.actif) {
    return { accepte: false, motif: "deja_membre" };
  }

  await avecContexteApplicatif(
    contexteAdmin,
    (tx) =>
      tx.utilisateurSociete.updateMany({
        where: { id: cible.id },
        data: { actif: true },
      }),
    client,
  );

  return { accepte: true };
}
