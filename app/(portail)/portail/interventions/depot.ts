import {
  type PrismaClient,
  type StatutIntervention,
  type TypeIntervention,
} from "@prisma/client";

import { avecContexteApplicatif } from "@/lib/db/client";
import { type ContexteSession } from "@/lib/auth/contexte";
import { lireBonDuParc, type BonIntervention } from "@/lib/interventions/bon";

/**
 * LA LECTURE DE `intervention` CÔTÉ PORTAIL (9J07-PORTAIL-INTERVENTION-ETAT,
 * CLI-2.5, CLI-2.7) — L'ÉTAT COURANT SEUL, JAMAIS LA DURÉE PAR ÉTAT.
 *
 * MÊME discipline que `SELECTION_COMMENTAIRES_CLIENT`
 * (`lib/portail/interventions.ts`, 9J05) : `intervention` porte des colonnes
 * réservées au back-office — `note_interne`, `commentaire_technicien`,
 * `suite_a_donner`, `temps_valide_min`, `montant_ht`, `valorisation_figee`,
 * `technicien_id`, `agence_id`… — et ce module compose SON PROPRE select,
 * fermé, qui n'en reprend AUCUNE. Les deux commentaires visibles côté client
 * restent la SEULE affaire de `commentairesVisiblesClient` : cette page les
 * appelle, elle ne les relit jamais ici (ticket, « hors territoire »).
 *
 * MÊME politique « parc » (D84) que `parcDuClient`/`ficheMachineDuParc`
 * (`lib/portail/depot.ts`) : aucune comparaison de société, de client ni de
 * périmètre de sites écrite ici — la politique RLS décide, sous le contexte
 * posé par l'appelant. `null`, sur la fiche, couvre AUSSI BIEN une
 * intervention inexistante qu'une intervention hors périmètre (D35, D50).
 *
 * CLI-2.4 (le temps passé dans chaque état) est explicitement REPOUSSÉ par
 * l'étude du 29/10/2026 : ce module ne lit ni ne dérive aucune durée, et
 * `intervention_statut_historique` n'est appelé par rien ici.
 */

/**
 * LA LISTE CLOSE des colonnes que ce module s'autorise à sélectionner.
 * `tests/unit/portail/intervention-colonnes-fermees.test.ts` lit ces clés
 * RÉELLES, jamais une copie tenue à la main.
 */
export const SELECTION_INTERVENTION_PORTAIL = {
  id: true,
  numero: true,
  annee: true,
  statut: true,
  type: true,
  date_planifiee: true,
  site_id: true,
  cree_le: true,
} as const;

/** Une intervention telle que le portail la montre — l'état courant seul. */
export type InterventionDuPortail = {
  readonly id: string;
  readonly numero: number | null;
  readonly annee: number | null;
  readonly statut: StatutIntervention;
  readonly type: TypeIntervention;
  readonly datePlanifiee: Date | null;
  readonly siteId: string;
  readonly creeLe: Date;
};

function versInterventionDuPortail(ligne: {
  id: string;
  numero: number | null;
  annee: number | null;
  statut: StatutIntervention;
  type: TypeIntervention;
  date_planifiee: Date | null;
  site_id: string;
  cree_le: Date;
}): InterventionDuPortail {
  return {
    id: ligne.id,
    numero: ligne.numero,
    annee: ligne.annee,
    statut: ligne.statut,
    type: ligne.type,
    datePlanifiee: ligne.date_planifiee,
    siteId: ligne.site_id,
    creeLe: ligne.cree_le,
  };
}

/**
 * Les interventions visibles du compte portail, sous SON contexte — la plus
 * récemment créée d'abord (même second tri que `demandesOuvertes`/
 * `demandesTraitees` relues par `/portail/demandes` : un client qui relit SES
 * interventions n'a pas la même question qu'une file de travail interne).
 */
export async function interventionsDuParc(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<InterventionDuPortail[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.intervention.findMany({
        select: SELECTION_INTERVENTION_PORTAIL,
        orderBy: { cree_le: "desc" },
      });
      return lignes.map(versInterventionDuPortail);
    },
    client,
  );
}

/**
 * Une intervention du parc, par son identifiant — même nuance que
 * `ficheMachineDuParc` (`lib/portail/depot.ts`) : une lecture par id, jamais
 * une boucle sur `interventionsDuParc`, et `null` ne distingue pas
 * « inexistante » de « hors périmètre ».
 */
export async function ficheInterventionDuParc(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<InterventionDuPortail | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: SELECTION_INTERVENTION_PORTAIL,
      });
      return ligne === null ? null : versInterventionDuPortail(ligne);
    },
    client,
  );
}

/**
 * LE RÉSULTAT DE LA LECTURE DU BON PAR LE PORTAIL (9J08A-REPRISE-9J08,
 * CLI-2.6) — TROIS ÉTATS, parce que « introuvable » (D35, D50 : hors
 * périmètre ou inexistante, qui ne se nomme JAMAIS) et « pas encore
 * clôturée » (qui DOIT se nommer, §5 point 5 du ticket) ne peuvent pas se
 * confondre dans un seul `null` comme le fait le reste de ce module.
 */
export type BonDuParc =
  | { readonly etat: "introuvable" }
  | { readonly etat: "non_cloturee" }
  | { readonly etat: "disponible"; readonly bon: BonIntervention };

/**
 * LE BON D'UNE INTERVENTION DU PARC (9J08A-REPRISE-9J08, CLI-2.6) — MÊME
 * COMPOSITION que le back-office (`lireBonDuParc`, `lib/interventions/
 * bon.ts`), sous la seule politique RLS « parc » (D84) : jamais
 * `restrictionParPersonne`, étrangère au compte client (voir l'en-tête de
 * `lireBonDuParc`).
 *
 * **La condition de clôture, elle, est NOUVELLE et PROPRE AU PORTAIL** : le
 * back-office continue de voir le bon dès `terminee` (`peutGenererLeBon`,
 * `lib/interventions/cycle-de-vie.ts`), inchangé par ce ticket. Un compte
 * portail, lui, n'en voit un qu'une fois l'intervention CLÔTURÉE — un
 * rapport `terminee` peut encore être renvoyé au technicien (M5), et un bon
 * déjà remis au client deviendrait obsolète si le renvoi en changeait le
 * contenu (cohérent avec I5 : le travail terrain prime, mais le client ne
 * doit lire qu'un état définitif).
 */
export async function bonInterventionDuParc(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<BonDuParc> {
  const bon = await lireBonDuParc(contexte, interventionId, client);
  if (bon === null) {
    return { etat: "introuvable" };
  }
  if (bon.clotureeLe === null) {
    return { etat: "non_cloturee" };
  }
  return { etat: "disponible", bon };
}
