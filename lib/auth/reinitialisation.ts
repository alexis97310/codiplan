import type { PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { avecDesignationAuth } from "./lecture-identite";
import { identiteExclusiveALaSociete } from "./lien-d-acces";
import { Role } from "./roles";

/**
 * 9IA — RÉINITIALISATION DU SECOND FACTEUR (téléphone perdu), décision
 * d'Alexis du 28/10/2026 (question 3 de l'audit, réponse « A et B »).
 *
 * ## Ce que ce geste rend, et ce qu'il ne rend pas — le VOISIN de L7-04
 *
 * `lib/auth/deverrouillage.ts` (L7-04/D66) rompt une série de verrouillages :
 * le facteur reste INTACT. Ici, le téléphone est PERDU : le facteur devient
 * INERTE et la personne devra RÉ-ENRÔLER (`lib/auth/enrolement.ts`) à sa
 * prochaine connexion — c'est un accès PERDU qui se rend, pas un droit de
 * réessayer. Voir `docs/propositions/9IA-REINITIALISER-SECOND-FACTEUR/mesure.md`
 * pour ce qui a établi que remettre `second_facteur.verifie` et
 * `utilisateur.mfa_actif` à `false` suffit : `enableTwoFactor` (Better Auth)
 * réécrit secret et codes de secours de lui-même au prochain enrôlement.
 *
 * ## QUI, EXACTEMENT — deux portées, aucune troisième
 *
 *   A — `admin_plateforme`, sur n'importe quel compte, sans exclusion de soi ;
 *   B — `admin_societe`, sur un AUTRE membre de SA société, jamais lui-même.
 *
 * Ni `direction` ni aucun autre rôle. La décision le dit ainsi, et ce module
 * ne l'élargit pas : voir `peutReinitialiserSecondFacteur` ci-dessous, qui
 * reprend très exactement la même matrice que la fonction SQL
 * `app_peut_reinitialiser_second_facteur()` (migration
 * `20261102010000_reinitialisation_second_facteur_9ia`) — le refus est dit
 * ICI pour qu'il soit lisible, LÀ-BAS pour qu'il soit vrai.
 *
 * ## POURQUOI DEUX `UPDATE` SANS `WHERE`, SUR DEUX TABLES
 *
 * Même mesure que L7-04 : un `WHERE utilisateur_id = <sujet>` sur
 * `second_facteur` ouvrirait la lecture du secret et des codes de secours à
 * l'administrateur (PostgreSQL applique les politiques de `SELECT` au `WHERE`
 * d'un `UPDATE`). Sur `utilisateur`, un `WHERE` échouerait de toute façon pour
 * A : `admin_plateforme` n'a aucune société active sous laquelle
 * `utilisateur_lecture`/`utilisateur_modification` le laisseraient voir ou
 * écrire la ligne d'un tiers. Les deux lignes sont donc désignées par
 * `app.reinitialisation_sujet_id`, et c'est la politique — elle seule — qui
 * choisit QUI a le droit et SUR QUELLE ligne.
 */

/** Ce que le geste refuse, avec le motif. */
export class RefusReinitialisation extends Error {}

export type DemandeReinitialisation = {
  /**
   * La société sous laquelle l'acteur agit — chaîne vide pour `admin_plateforme`
   * (A), qui n'en a aucune. Alimente `app.societe_id` ; la politique de B s'en
   * sert pour borner le sujet à CETTE société via `utilisateur_societe`.
   */
  readonly societeId: string;
  /** Le rôle que l'acteur tient — seuls `admin_plateforme` et `admin_societe`. */
  readonly role: Role;
  /** Son identité — l'auteur porté au journal des accès. */
  readonly auteurId: string;
  /** Le compte dont le second facteur est réinitialisé. */
  readonly sujetId: string;
};

/**
 * Vrai si `role` peut réinitialiser le second facteur de `sujetId`, agissant
 * en tant que `auteurId`. Fonction PURE, éprouvée par des tests unitaires
 * sans base — et reprise par l'écran pour décider si le bouton se propose.
 *
 * Reprend très exactement `app_peut_reinitialiser_second_facteur()` : A
 * (`admin_plateforme`) sans aucune exclusion de soi, B (`admin_societe`)
 * jamais sur lui-même. Ne dit rien de la société du sujet pour B — c'est la
 * politique RLS qui la borne, à travers `utilisateur_societe`, et qu'aucune
 * fonction pure ne peut rejouer sans lire la base.
 */
export function peutReinitialiserSecondFacteur(
  role: Role,
  auteurId: string,
  sujetId: string,
): boolean {
  if (role === Role.admin_plateforme) {
    return true;
  }
  if (role === Role.admin_societe) {
    return auteurId !== sujetId;
  }
  return false;
}

/**
 * Réinitialise le second facteur d'un compte dont le téléphone est perdu.
 *
 * Remet `second_facteur` (verrouillage et vérification) et `utilisateur.
 * mfa_actif` à l'état qui force le ré-enrôlement — sans jamais lire ni écrire
 * le secret ou les codes de secours.
 *
 * **EXCLUSIVITÉ (D226, 9IA1-REPRISE-9IA)** — pour B (`admin_societe`), un
 * sujet aussi rattaché à une AUTRE société refuse, AVANT toute écriture :
 * un administrateur de société n'agit pas sur une identité qu'il ne contrôle
 * pas entièrement. A (`admin_plateforme`) n'est pas concerné — décision
 * antérieure à D226, et cette reprise ne l'élargit pas à A.
 */
export async function reinitialiserSecondFacteur(
  demande: DemandeReinitialisation,
  client: PrismaClient = clientParDefaut,
): Promise<void> {
  // LE REFUS EST DIT DANS LE CODE **ET** TENU EN BASE — même discipline que
  // L7-04 : lisible ici, vrai là-bas, et un scénario éprouve la politique
  // directement.
  if (
    !peutReinitialiserSecondFacteur(
      demande.role,
      demande.auteurId,
      demande.sujetId,
    )
  ) {
    throw new RefusReinitialisation(
      demande.role === Role.admin_societe &&
        demande.auteurId === demande.sujetId
        ? "Un compte ne réinitialise pas son propre second facteur : " +
            "l'administrateur de plateforme s'en charge."
        : `Le rôle « ${demande.role} » ne peut pas réinitialiser un second ` +
            "facteur.",
    );
  }

  if (
    demande.role === Role.admin_societe &&
    !(await identiteExclusiveALaSociete(
      // `identiteExclusiveALaSociete` ne lit que `societeId` (via
      // `exigerSocieteActive`) : les autres champs du contexte sont neutres
      // ici et n'ont pas leur place dans `DemandeReinitialisation`.
      {
        utilisateurId: demande.auteurId,
        societeId: demande.societeId,
        role: demande.role,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: null,
      },
      demande.sujetId,
      client,
    ))
  ) {
    throw new RefusReinitialisation(
      `Le compte ${demande.sujetId} est aussi rattaché à une autre ` +
        "société : un administrateur de société ne contrôle pas " +
        "entièrement cette identité, et ne peut pas réinitialiser son " +
        "second facteur (D226).",
    );
  }

  await avecContexteRls(
    client,
    {
      societeId: demande.societeId,
      role: demande.role,
      auteurId: demande.auteurId,
      reinitialisationSujetId: demande.sujetId,
    },
    async (tx) => {
      // AUCUN `where` sur les deux écritures — voir l'en-tête. Chaque ligne
      // est désignée par `app.reinitialisation_sujet_id`, et bornée par sa
      // politique.
      const facteur = await tx.secondFacteur.updateMany({
        data: {
          verifie: false,
          echecs_verification: 0,
          verrouille_jusqu_a: null,
          verrouillages_consecutifs: 0,
        },
      });
      if (facteur.count > 1) {
        // La politique a laissé passer plus d'une ligne : on n'écrit pas
        // « probablement bon », on annule. La transaction reflue.
        throw new RefusReinitialisation(
          `La réinitialisation a atteint ${facteur.count} lignes de second ` +
            "facteur au lieu d'une seule : la politique ne borne plus ce " +
            "qu'elle devrait, et l'écriture est annulée.",
        );
      }

      const identite = await tx.utilisateur.updateMany({
        data: { mfa_actif: false },
      });
      if (identite.count > 1) {
        throw new RefusReinitialisation(
          `La réinitialisation a atteint ${identite.count} identités au lieu ` +
            "d'une seule : la politique ne borne plus ce qu'elle devrait, " +
            "et l'écriture est annulée.",
        );
      }
    },
  );

  // LA TRACE EST ÉCRITE — un accès administratif à un compte tiers, qu'il ait
  // ou non trouvé un second facteur à réinitialiser.
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: demande.auteurId,
      evenement: "reinitialisation_second_facteur",
      societe_id_cible: demande.societeId === "" ? null : demande.societeId,
      role: demande.role,
      detail:
        `réinitialisation du second facteur du compte ${demande.sujetId} — ` +
        "il devra ré-enrôler un second facteur à sa prochaine connexion",
    },
  });
}
