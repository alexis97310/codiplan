import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

/**
 * UNE OBSERVATION D'ORGANISME ENGENDRE UNE INTERVENTION À PLANIFIER
 * (L9-10 ; D88 §10).
 *
 * ## LA PHRASE QUI GOUVERNE CE FICHIER
 *
 * > *« C'est le seul point où ce lot alimente le planning, et c'est celui qui
 * > rapporte de l'argent. »*
 *
 * **Une observation d'organisme est un travail à faire, daté, sur une machine
 * identifiée : elle a exactement la forme d'une intervention `a_planifier`.**
 *
 * ## ELLE NE S'ENGENDRE PAS TOUTE SEULE, ET C'EST DÉLIBÉRÉ
 *
 * *Un rapprochement faux accroche la notice d'un compresseur à un pont
 * élévateur* — le motif du bac de réception (L8-07) vaut ici davantage : une
 * intervention créée sans qu'on l'ait voulu **part au planning et engage une
 * visite**. Ce module **propose une forme** et exige un geste : rien n'appelle
 * `planifierLObservation` sans qu'un humain l'ait décidé.
 *
 * ## LE TYPE EST `controle_reglementaire`, ET CE N'EST PAS UN CHOIX ESTHÉTIQUE
 *
 * Il existe à l'énumération depuis l'origine (chapitre 11) et il **désigne
 * exactement ce dont il s'agit** : un travail né d'un contrôle réglementaire.
 * *Inventer un type `vgp` aurait fermé une énumération de statuts sans
 * arbitrage* — ce que le §8 range parmi les points d'arrêt.
 *
 * ## LE LIEN EST POSÉ DANS LA MÊME TRANSACTION QUE LA CRÉATION
 *
 * Une intervention créée sans que l'observation la désigne serait **du travail
 * dû qui a l'air fait** : l'observation resterait « non planifiée » et une
 * seconde main en créerait une deuxième. *Ce qui doit être vrai ensemble s'écrit
 * ensemble.*
 */

/** Ce qu'une observation devient, une fois portée au planning. */
export type ObservationPlanifiee = {
  readonly observation_id: string;
  readonly intervention_id: string;
};

/**
 * Porte une observation au planning, et rend le lien.
 *
 * `clientId` et `siteId` sont **reçus** : ce module ne les déduit pas de la
 * machine. *Une machine dit où elle est aujourd'hui ; une intervention dit où
 * l'on va* — et l'historique de L2-05 existe précisément parce que les deux
 * divergent au premier déménagement.
 */
export async function planifierLObservation(
  contexte: ContexteSession,
  demande: {
    readonly observationId: string;
    readonly clientId: string;
    readonly siteId: string;
    readonly machineId: string;
  },
  client?: PrismaClient,
): Promise<ObservationPlanifiee | { readonly refus: string }> {
  const interventionId = uuidv7();
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const observation = await tx.vgpObservation.findUnique({
        where: { id: demande.observationId },
        select: { id: true, libelle: true, intervention_id: true },
      });
      // INVISIBLE ET INEXISTANTE RENDENT LA MÊME CHOSE : les distinguer ferait
      // un oracle (D35, D50).
      if (observation === null) {
        return { refus: "observation_introuvable" };
      }
      // DÉJÀ PLANIFIÉE : on ne crée pas une seconde intervention. *Deux visites
      // pour une observation, c'est un déplacement payé deux fois.*
      if (observation.intervention_id !== null) {
        return { refus: "observation_deja_planifiee" };
      }

      const saisie = schemaCreation.parse({
        id: interventionId,
        client_id: demande.clientId,
        site_id: demande.siteId,
        machine_ids: [demande.machineId],
        type: "controle_reglementaire",
      });
      const pose = await creerIntervention(contexte, saisie, client);
      if (!pose.accepte) {
        return { refus: pose.cle };
      }

      await tx.vgpObservation.update({
        where: { id: observation.id },
        data: { intervention_id: interventionId },
      });
      return {
        observation_id: observation.id,
        intervention_id: interventionId,
      };
    },
    client,
  );
}

/**
 * LES OBSERVATIONS QUI ATTENDENT ENCORE — le travail dû.
 *
 * *Une observation non traitée est l'état qui compte*, et c'est la seule liste
 * que ce lot donne au planning. **Elle n'est pas une alerte par machine** : elle
 * se lit, comme la campagne datée, et le §9 du 11/09 dit pourquoi.
 */
export async function observationsEnAttente(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<
  readonly {
    readonly id: string;
    readonly libelle: string;
    readonly machine_id: string;
    readonly date_verification: Date;
  }[]
> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpObservation.findMany({
        where: { intervention_id: null },
        select: {
          id: true,
          libelle: true,
          verification: {
            select: { machine_id: true, date_verification: true },
          },
        },
        // LES PLUS ANCIENNES D'ABORD : ce sont celles qui attendent depuis le
        // plus longtemps, et c'est l'ordre dans lequel on veut les traiter.
        orderBy: [
          { verification: { date_verification: "asc" } },
          { id: "asc" },
        ],
      }),
    client,
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    libelle: ligne.libelle,
    machine_id: ligne.verification.machine_id,
    date_verification: ligne.verification.date_verification,
  }));
}
