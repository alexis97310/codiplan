import type { PrismaClient } from "@prisma/client";

import type { Envoi } from "@/lib/courriel/message";
import { prisma } from "@/lib/db/client";
import { avecSociete } from "@/lib/db/rls";

import { type ContexteSession, exigerSocieteActive } from "./contexte";
import {
  envoyerLienDAccesPartage,
  RefusEnvoiAcces,
  viseCetteCible,
} from "./lien-d-acces";
import { avecDesignationAuth } from "./lecture-identite";

export { RefusEnvoiAcces, viseCetteCible };

/**
 * DONNER L'ACCÈS À UN TECHNICIEN DEPUIS ÉQUIPE (D162, ticket 9DJ-TP-ACC1).
 *
 * ## Ce que ce module répare
 *
 * Créer un technicien dans Équipe (`lib/techniciens/depot.ts`) écrit son
 * IDENTITÉ — `utilisateur`, `utilisateur_societe`, `technicien` — mais
 * n'ouvre aucun moyen de connexion : aucune ligne `compte`, aucun jeton.
 * Le seul chemin qui en émettait un était le geste d'AMORÇAGE
 * (`lib/auth/amorcage.ts`), réservé à la toute première identité d'une
 * société. Un technicien créé ensuite restait donc sans accès, pour
 * toujours — QT-1 (28/09/2026) ferme ce trou : l'administrateur de la
 * société ENVOIE un lien d'accès, depuis Équipe.
 *
 * ## Pourquoi ce module ne réutilise pas `ouvrirPremierCompte` /
 * `reemettreJetonPremierAcces` tels quels
 *
 * Les deux gestes de `lib/auth/amorcage.ts` existent déjà et émettent un
 * jeton par le même mécanisme (`creerAuth` muni d'un canal). Mais leur trace
 * dans `journal_acces` nomme l'IDENTITÉ elle-même comme auteur — « c'est la
 * seule vérité du geste d'amorçage », qui n'a personne d'autre à nommer.
 * Ici, il y a quelqu'un d'autre : **l'administrateur agit sur le compte d'un
 * tiers**, exactement la situation de `lib/auth/deverrouillage.ts` (L7-04),
 * dont ce module reprend la forme de trace — l'auteur est l'administrateur,
 * la cible est nommée dans `detail`. Rejouer les deux gestes existants aurait
 * donc écrit une trace fausse ; ce module compose directement les mêmes
 * briques qu'eux (`creerAuth`, `avecDesignationAuth`), sans les copier.
 *
 * ## Le compte au repos, modelé sur `prisma/seed.ts`
 *
 * `poserLeMoyenDeConnexionAuRepos` y mesure les trois valeurs d'un compte
 * réellement ouvert par `signUpEmail` — `emetteur = "local:credential"`,
 * `fournisseur_id = "credential"`, `compte_externe_id` = l'identifiant de
 * l'identité — et pose `mot_de_passe: null`. Ce module pose la même ligne,
 * pour la même raison : aucun mot de passe n'existe tant que la personne n'en
 * a pas choisi un (D65), et `requestPasswordReset` exige qu'une ligne de
 * `compte` existe déjà pour émettre un jeton.
 *
 * ## CE QUI N'EST PAS VÉRIFIÉ, ET POURQUOI
 *
 * Le ticket nomme un quatrième refus : « cette personne a un accès dans une
 * autre société ». Il N'EST PAS implémenté. `utilisateur_societe` porte la
 * forme « société » (I1) — une politique RLS ordinaire, filtrée par
 * `app.societe_id` — et aucune lecture de ce module ne peut, sous le contexte
 * de l'administrateur, voir une ligne d'une AUTRE société : la base rend zéro
 * ligne, à l'aveugle comme en nommant. `journal_acces` porte bien
 * `societe_id_cible`, mais ces deux colonnes sont INFORMATIVES PAR
 * ARBITRAGE (D34) et ne doivent JAMAIS filtrer une décision —
 * `tests/unit/auth/journal-acces-informatif.test.ts` le garde. Détecter ce
 * cas exigerait donc soit une nouvelle politique RLS (une migration), soit
 * une lecture sous un rôle qui voit toutes les sociétés (hors de propos pour
 * un geste d'`admin_societe`) : les deux sont hors du territoire de ce lot
 * (« Migration : NON »). Voir la passation de 9DJ-TP-ACC1-DONNER-ACCES.
 *
 * ## DEPUIS 9ET-COMPTES-BUREAU-1 : LES ÉTAPES 2 À 6 SONT PARTAGÉES
 *
 * `lib/auth/lien-d-acces.ts` porte désormais l'identité, le cliquet de D65,
 * le jeton, le courriel et la trace — identiques pour un technicien et pour
 * un compte de bureau (`lib/auth/acces-bureau.ts`). Ce module ne garde que
 * l'ÉTAPE 1, propre au technicien : est-il membre de la société active, et
 * actif ?
 */

/** Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50). */
export type MotifRefusAcces =
  /** Hors périmètre, ou pas un technicien de la société active (D50). */
  | "introuvable"
  /** `Technicien.actif` est faux : on ne donne pas accès à qui est parti. */
  | "membre_inactif"
  /** Le cliquet de D65 : une identité qui a déjà choisi son mot de passe. */
  | "deja_un_mot_de_passe";

export type ResultatEnvoiAcces =
  | {
      readonly accepte: true;
      readonly destinataire: string;
      readonly envoi: Envoi;
    }
  | { readonly accepte: false; readonly motif: MotifRefusAcces };

/** Ce que la trace nomme avant la virgule — voir `lib/auth/lien-d-acces.ts`. */
const LIBELLE_CHEMIN =
  "lien d'accès envoyé par l'administrateur de la société ou la direction — " +
  "chemin administratif (D162)";

/**
 * Envoie (ou réémet) le lien de premier accès d'un technicien de la société
 * active.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs` (`admin_societe` ET, depuis D199, 13/10/2026,
 *   décision n° 85, `direction`). Vérifié dans `envoyerLienDAccesPartage`,
 *   pas seulement à la porte de la route.
 * @param utilisateurId le technicien visé.
 */
export async function envoyerLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiAcces> {
  const societeId = exigerSocieteActive(contexteAdmin);

  // ── LE TECHNICIEN EST-IL MEMBRE DE LA SOCIÉTÉ ACTIVE, ET ACTIF ? ─────────
  //
  // `technicien` est de forme « société » (I1) : un identifiant d'une autre
  // société rend `null`, exactement comme un identifiant inconnu — même
  // refus, par construction, jamais par un `if` qui les distinguerait (D50).
  const technicien = await avecSociete(client, societeId, (tx) =>
    tx.technicien.findFirst({
      where: { utilisateur_id: utilisateurId },
      select: { actif: true },
    }),
  );
  if (technicien === null) {
    return { accepte: false, motif: "introuvable" };
  }
  if (!technicien.actif) {
    return { accepte: false, motif: "membre_inactif" };
  }

  return envoyerLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN,
    client,
    environnement,
  );
}

/** L'état d'accès d'un technicien, tel que l'écran Équipe le montre. */
export type EtatAcces =
  | { readonly etat: "aucun" }
  | { readonly etat: "lien_envoye"; readonly horodatage: Date }
  | { readonly etat: "actif" };

/**
 * L'état d'accès de chaque technicien demandé — pour l'affichage d'Équipe.
 *
 * Une seule lecture de l'historique de l'ADMINISTRATEUR courant (voir
 * l'en-tête : `journal_acces` désigne par l'auteur, jamais par la cible),
 * puis une lecture de `compte` PAR technicien — ce second aller-retour ne se
 * groupe pas, `compte` n'étant lisible que désigné par UN identifiant à la
 * fois (voir `lib/auth/lecture-identite.ts`).
 */
export async function etatsAccesDesTechniciens(
  contexteAdmin: ContexteSession,
  utilisateurIds: readonly string[],
  client: PrismaClient = prisma,
): Promise<ReadonlyMap<string, EtatAcces>> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  const designe = avecDesignationAuth(client);

  const evenements = await designe.journalAcces.findMany({
    where: {
      utilisateur_id: contexteAdmin.utilisateurId,
      evenement: { in: ["ouverture_identite", "reemission_premier_acces"] },
    },
    orderBy: { horodatage: "desc" },
    select: { detail: true, horodatage: true },
  });

  const resultat = new Map<string, EtatAcces>();
  for (const utilisateurId of utilisateurIds) {
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
    const dernier = evenements.find((evenement) =>
      viseCetteCible(evenement.detail, utilisateurId),
    );
    resultat.set(utilisateurId, {
      etat: "lien_envoye",
      horodatage: dernier?.horodatage ?? compte.cree_le,
    });
  }
  return resultat;
}
