import { EvenementAcces, type PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { avecDesignationAuth } from "./lecture-identite";
import { avecIdentite, avecSocieteEtRole } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { type ContexteActif } from "./contexte";
import { avecPlancherDeDuree, motifRefusUniforme } from "./reponse-uniforme";
import { exigeSecondFacteur, Role, ROLE_PORTAIL } from "./roles";

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
      // Aucun client désigné : basculer de société n'est pas désigner un client
      // (D70). Un compte portail qui agirait pour un client le désignera au
      // moment de la requête, jamais au moment de la bascule.
      clientId: null,
    },
  };
}

/** Une habilitation d'un compte : la société, et le rôle qu'il y tient. */
export type Habilitation = {
  readonly societeId: string;
  readonly role: Role;
};

/**
 * LES SOCIÉTÉS SUR LESQUELLES UN COMPTE EST HABILITÉ (ticket L1-02f, D61).
 *
 * **Cette lecture n'existait pas, et son absence était un mur.** La connexion
 * n'établit que l'identité ; `basculerSociete` exige qu'on lui NOMME la société
 * visée ; et `utilisateur_societe` portait la forme « société », si bien que la
 * question rendait zéro ligne tant qu'une société n'était pas déjà active. Un
 * cercle parfait, contre lequel le premier écran est venu buter.
 *
 * Elle s'appuie sur la huitième forme de politique — « appartenance » —, ancrée
 * sur `app.utilisateur_id` et en `SELECT` seul : le compte lit SES lignes,
 * jamais celles d'autrui, et il ne peut pas en écrire.
 *
 * **Ce qu'elle ne rend pas, et c'est délibéré** : le NOM des sociétés. `societe`
 * reste de forme « identité » (D42) — seule la société active se nomme. Une
 * liste d'identifiants suffit à activer, et n'apprend rien de plus.
 */
/**
 * Une société où le compte est habilité, AVEC son nom (D67, ticket L2-11).
 */
export type SocieteDuCompte = {
  readonly societeId: string;
  readonly role: Role;
  /**
   * Raison sociale, lue en base sous la forme « adhésion ». `null` si la
   * politique n'a rien rendu — la valeur n'est jamais inventée.
   */
  readonly raisonSociale: string | null;
};

/**
 * Les sociétés d'un compte, AVEC LEUR NOM (D67).
 *
 * **Ce que `habilitationsDuCompte` ne pouvait pas rendre.** `societe` était de
 * forme « identité » (D42) : sans société active, la lecture rendait zéro ligne
 * — *pas même en nommant l'identifiant qu'on possède déjà* (mesuré le
 * 08/09/2026, avec témoin : 0, 0, et 2 lignes réellement en base). Un sélecteur
 * ne pouvait donc proposer que des UUID.
 *
 * D67 ajoute à `societe` une politique de `SELECT` **et de `SELECT` seul**,
 * ancrée sur `app.utilisateur_id` à travers la table d'habilitation. Cette
 * fonction est ce qui la lit.
 *
 * **Le coût est nommé** : une personne apprend le NOM des sociétés dont D61 lui
 * donne déjà la liste. Ni leurs données, ni leurs habilitations, ni
 * l'existence d'aucune autre société.
 *
 * **Deux lectures plutôt qu'une jointure, et c'est délibéré.** Chacune est
 * bornée par SA forme — les habilitations par « appartenance », les noms par
 * « adhésion » — et l'on voit alors ce que chacune rend. Une jointure ferait
 * porter à une seule requête deux garanties distinctes, et masquerait laquelle
 * a filtré.
 */
export async function societesDuCompte(
  utilisateurId: string,
  client: PrismaClient = clientParDefaut,
): Promise<SocieteDuCompte[]> {
  const habilitations = await habilitationsDuCompte(utilisateurId, client);
  if (habilitations.length === 0) {
    return [];
  }
  const noms = await avecIdentite(client, utilisateurId, (tx) =>
    tx.societe.findMany({
      where: { id: { in: habilitations.map((h) => h.societeId) } },
      select: { id: true, raison_sociale: true },
    }),
  );
  const parId = new Map(noms.map((n) => [n.id, n.raison_sociale]));
  return habilitations.map((habilitation) => ({
    ...habilitation,
    raisonSociale: parId.get(habilitation.societeId) ?? null,
  }));
}

export async function habilitationsDuCompte(
  utilisateurId: string,
  client: PrismaClient = clientParDefaut,
): Promise<Habilitation[]> {
  // ── DEUX TABLES, PARCE QUE D10 LES A VOULUES EXCLUSIVES (D92) ───────────
  //
  // Un compte INTERNE est habilité par `utilisateur_societe` ; un compte
  // PORTAIL par `utilisateur_client`, et il n'a **aucune** ligne dans la
  // première — « les deux tables sont exclusives » (D10). Ne lire que la
  // première rendait donc `[]` pour tout compte portail : *aucun n'atteignait
  // aucun écran*, et rien ne le disait (mesuré le 11/09/2026 : identité seule
  // → 0 ligne d'`utilisateur_client`, et 0 ligne d'`utilisateur_societe`).
  //
  // Les deux lectures se font sous la forme « identité » — sans société —, et
  // chacune est bornée par SA politique : « appartenance » (D61) pour la
  // première, « rattachement » (D92) pour la seconde. C'est le même partage que
  // `societesDuCompte` fait entre habilitations et noms, et pour la même
  // raison : on voit alors ce que chacune rend.
  const [internes, portail] = await Promise.all([
    avecIdentite(client, utilisateurId, (tx) =>
      tx.utilisateurSociete.findMany({
        where: { utilisateur_id: utilisateurId },
        select: { societe_id: true, role: true },
        orderBy: { societe_id: "asc" },
      }),
    ),
    avecIdentite(client, utilisateurId, (tx) =>
      tx.utilisateurClient.findMany({
        where: { utilisateur_id: utilisateurId, actif: true },
        select: { societe_id: true },
        orderBy: { societe_id: "asc" },
      }),
    ),
  ]);

  const habilitations: Habilitation[] = internes.map((ligne) => ({
    societeId: ligne.societe_id,
    role: ligne.role,
  }));

  // LE RÔLE D'UN COMPTE PORTAIL EST IMPLICITE, et c'est `lireRole` qui le dit
  // déjà : « un compte portail est un client, jamais autre chose ». Il est
  // recopié ici et non déduit d'une colonne, parce qu'aucune colonne ne le
  // porte — et un rattachement à DEUX clients d'une même société ne fait
  // qu'UNE habilitation : c'est la société qu'on choisit, pas le client (D70).
  const dejaVues = new Set(habilitations.map((h) => h.societeId));
  for (const ligne of portail) {
    if (dejaVues.has(ligne.societe_id)) {
      continue;
    }
    dejaVues.add(ligne.societe_id);
    habilitations.push({ societeId: ligne.societe_id, role: ROLE_PORTAIL });
  }

  return habilitations.sort((a, b) => a.societeId.localeCompare(b.societeId));
}
