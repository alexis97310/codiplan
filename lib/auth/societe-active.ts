import { EvenementAcces, type PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { avecSocieteEtRole } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { type ContexteActif } from "./contexte";
import { exigeSecondFacteur, Role } from "./roles";

/**
 * Bascule de société active (ticket L0-06).
 *
 * Critère d'acceptation du ticket : « un utilisateur habilité sur A ne peut pas
 * basculer sur B ; tout changement de société active est journalisé ».
 *
 * L'habilitation se lit là où elle vit, et nulle part ailleurs :
 * `utilisateur_societe` pour les comptes internes, `utilisateur_client` pour les
 * comptes portail (D10 — les deux tables sont exclusives). Le rôle n'est jamais
 * fourni par l'appelant : il est **relu en base** à chaque bascule. Un rôle
 * transmis depuis le client serait une habilitation auto-déclarée.
 *
 * La lecture se fait sous le contexte de la société VISÉE. C'est délibéré :
 * la politique RLS de `utilisateur_societe` ne laisse voir que les lignes de la
 * société active, si bien que l'absence d'habilitation se manifeste par zéro
 * ligne, quel que soit le chemin. La première barrière — le filtre applicatif —
 * et la seconde — la politique — disent alors la même chose.
 */

/** Issue d'une tentative de bascule. */
export type ResultatBascule =
  | { readonly accepte: true; readonly contexte: ContexteActif }
  | { readonly accepte: false; readonly motif: string };

export type DemandeBascule = {
  /** Compte qui demande la bascule. */
  utilisateurId: string;
  /** Ligne `session` à mettre à jour. */
  sessionId: string;
  /** Société visée. */
  societeId: string;
  /** Société active avant la bascule, `null` à la première activation. */
  societeIdPrecedente: string | null;
  /** Le second facteur a-t-il été validé à l'ouverture de la session ? */
  secondFacteurValide: boolean;
};

/** Rôle tenu par un compte sur une société, ou `null` s'il n'y est pas habilité. */
async function lireRole(
  client: PrismaClient,
  utilisateurId: string,
  societeId: string,
): Promise<Role | null> {
  return avecSocieteEtRole(client, societeId, null, async (tx) => {
    const interne = await tx.utilisateurSociete.findFirst({
      where: { utilisateur_id: utilisateurId, societe_id: societeId },
      select: { role: true },
    });
    if (interne !== null) {
      return interne.role;
    }
    // Compte portail (D10) : le rattachement vit dans `utilisateur_client`, et
    // le rôle y est implicite — un compte portail est un client, jamais autre
    // chose.
    const portail = await tx.utilisateurClient.findFirst({
      where: {
        utilisateur_id: utilisateurId,
        societe_id: societeId,
        actif: true,
      },
      select: { id: true },
    });
    return portail === null ? null : Role.client;
  });
}

/** Écrit une ligne au journal des accès (D32). Table en ajout seul. */
async function journaliser(
  client: PrismaClient,
  demande: DemandeBascule,
  evenement: EvenementAcces,
  role: Role | null,
  detail: string,
): Promise<void> {
  await client.journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: demande.utilisateurId,
      evenement,
      societe_id_cible: demande.societeId,
      societe_id_precedente: demande.societeIdPrecedente,
      role,
      detail,
    },
  });
}

/**
 * Active une société sur une session, si le compte y est habilité.
 *
 * Refuse — et journalise le refus — dans trois cas : aucune habilitation sur la
 * société visée, compte désactivé, ou rôle exigeant un second facteur que la
 * session ne porte pas.
 */
export async function basculerSociete(
  demande: DemandeBascule,
  client: PrismaClient = clientParDefaut,
): Promise<ResultatBascule> {
  const utilisateur = await client.utilisateur.findUnique({
    where: { id: demande.utilisateurId },
    select: { actif: true },
  });

  if (utilisateur === null || !utilisateur.actif) {
    const motif = "Compte inconnu ou désactivé.";
    await journaliser(
      client,
      demande,
      EvenementAcces.bascule_refusee,
      null,
      motif,
    );
    return { accepte: false, motif };
  }

  const role = await lireRole(client, demande.utilisateurId, demande.societeId);

  if (role === null) {
    const motif =
      "Aucune habilitation sur la société visée : la bascule est refusée.";
    await journaliser(
      client,
      demande,
      EvenementAcces.bascule_refusee,
      null,
      motif,
    );
    return { accepte: false, motif };
  }

  if (exigeSecondFacteur(role) && !demande.secondFacteurValide) {
    const motif = `Le rôle « ${role} » exige un second facteur, absent de cette session.`;
    await journaliser(
      client,
      demande,
      EvenementAcces.bascule_refusee,
      role,
      motif,
    );
    return { accepte: false, motif };
  }

  await client.session.update({
    where: { id: demande.sessionId },
    data: { societe_id_active: demande.societeId, role_actif: role },
  });

  await journaliser(
    client,
    demande,
    EvenementAcces.bascule_societe,
    role,
    "Société active modifiée.",
  );

  return {
    accepte: true,
    contexte: {
      utilisateurId: demande.utilisateurId,
      societeId: demande.societeId,
      role,
      secondFacteurValide: demande.secondFacteurValide,
    },
  };
}
