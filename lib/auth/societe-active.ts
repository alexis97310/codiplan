import { EvenementAcces, type PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { avecDesignationAuth } from "./lecture-identite";
import { avecSocieteEtRole } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { type ContexteActif } from "./contexte";
import { avecPlancherDeDuree, motifRefusUniforme } from "./reponse-uniforme";
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
 *
 * **Refus indiscernables (D35).** « Compte inconnu ou désactivé » et « aucune
 * habilitation sur cette société » rendent le MÊME motif, sous le même plancher
 * de durée que la connexion. Distinguer les deux revient à répondre à la
 * question « cette société est-elle cliente de la plateforme, et untel y
 * travaille-t-il ? », posée par quiconque possède un compte quelque part. Le
 * motif réel reste écrit au journal des accès, qui est interne.
 */

/** Issue d'une tentative de bascule. */
export type ResultatBascule =
  | { readonly accepte: true; readonly contexte: ContexteActif }
  | { readonly accepte: false; readonly motif: string };

export type DemandeBascule = {
  /** Compte qui demande la bascule. */
  utilisateurId: string;
  /**
   * JETON de la session à mettre à jour — jamais son identifiant (L1-02d).
   *
   * `session` porte désormais la forme « désignation », et sa clé est le jeton :
   * une valeur opaque que seul son porteur connaît. L'identifiant, lui, est un
   * UUID v7 — ordonné dans le temps, donc pas un secret. Adresser la session
   * par son jeton n'est pas une contrainte subie : c'est la forme juste.
   */
  jetonSession: string;
  /** Société visée. */
  societeId: string;
  /**
   * Société active avant la bascule, `null` à la première activation. Elle est
   * journalisée à titre INFORMATIF (D34) : elle dit d'où venait la tentative,
   * elle ne filtre rien.
   */
  societeIdSource: string | null;
  /** Le second facteur a-t-il été validé à l'ouverture de la session ? */
  secondFacteurValide: boolean;
  /**
   * Adresse de l'appelant, recopiée de la session (L0-10). FACULTATIVE, et
   * c'est délibéré : elle n'autorise rien, elle ne filtre rien, et un appelant
   * qui ne la connaît pas ne doit pas en inventer une. Absente, le contexte
   * rendu porte `null` et le journal d'audit écrira `NULL`.
   */
  adresseIp?: string | null;
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

/**
 * Écrit une ligne au journal des accès (D32). Table en ajout seul.
 *
 * `societe_id_source` et `societe_id_cible` sont posées ici, et lues nulle part
 * pour filtrer (D34) : elles servent à répondre à « qui a tenté d'accéder à mes
 * données ». Un refus de bascule de A vers B laisse ainsi une trace exploitable
 * par les deux sociétés, alors qu'il ne se range ni sous l'une ni sous l'autre.
 */
async function journaliser(
  client: PrismaClient,
  demande: DemandeBascule,
  evenement: EvenementAcces,
  role: Role | null,
  detail: string,
): Promise<void> {
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: demande.utilisateurId,
      evenement,
      societe_id_cible: demande.societeId,
      societe_id_source: demande.societeIdSource,
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
  return avecPlancherDeDuree(() => decider(demande, client));
}

/** Le travail lui-même. Chronométré par `basculerSociete`, jamais appelé nu. */
async function decider(
  demande: DemandeBascule,
  client: PrismaClient,
): Promise<ResultatBascule> {
  // ── LA LECTURE D'IDENTITÉ DÉSIGNE SA LIGNE (L1-02c) ─────────────────────
  //
  // `utilisateur` est cloisonnée en base, et cette lecture-ci PRÉCÈDE encore la
  // société : c'est justement ce que la bascule est en train d'établir. Elle
  // relève donc de la forme « désignation » — l'identifiant vient de la
  // session, l'appelant le tient déjà, et la lecture ne rend rien de plus.
  //
  // Sans l'enveloppe, elle rendrait `null` et toute bascule serait refusée pour
  // « compte inactif » : un refus juste dans sa forme et faux dans son motif,
  // c'est-à-dire le pire.
  const utilisateur = await avecDesignationAuth(client).utilisateur.findUnique({
    where: { id: demande.utilisateurId },
    select: { actif: true },
  });

  if (utilisateur === null || !utilisateur.actif) {
    await journaliser(
      client,
      demande,
      EvenementAcces.bascule_refusee,
      null,
      "Compte inconnu ou désactivé.",
    );
    return { accepte: false, motif: motifRefusUniforme() };
  }

  const role = await lireRole(client, demande.utilisateurId, demande.societeId);

  if (role === null) {
    await journaliser(
      client,
      demande,
      EvenementAcces.bascule_refusee,
      null,
      "Aucune habilitation sur la société visée : la bascule est refusée.",
    );
    return { accepte: false, motif: motifRefusUniforme() };
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

  await avecDesignationAuth(client).session.update({
    where: { token: demande.jetonSession },
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
      adresseIp: demande.adresseIp ?? null,
    },
  };
}
