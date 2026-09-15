import { type PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import {
  mesurer,
  peutArreter,
  peutDemarrer,
  type Mesure,
  type RefusCompteur,
  type Segment,
} from "./compteur";

/**
 * LE COMPTEUR, SOUS LE CONTEXTE CLOISONNÉ (R5-02, D119).
 *
 * ## Il ne DÉCIDE rien
 *
 * Toute la règle est dans `compteur.ts`, qui ne connaît ni base ni horloge. Ce
 * module lit, demande le verdict, écrit. *Recalculer ici serait une seconde
 * lecture d'un même critère, au pire endroit : entre la décision et
 * l'écriture.*
 *
 * ## Il ne compare AUCUNE société
 *
 * Tout passe par `avecContexteApplicatif`, donc sous les politiques : la forme
 * de `segment_travail` est « interne » (D94). *Une comparaison écrite ici
 * serait une seconde lecture d'un critère que la politique porte déjà, et c'est
 * celle qui vieillit sans rougir.*
 *
 * ## L'INSTANT EST UN PARAMÈTRE, JAMAIS UNE LECTURE
 *
 * Le jour où la file de synchronisation existera, l'instant viendra de
 * l'APPAREIL — un segment saisi en mode avion porte l'heure du terrain, et
 * *l'ordre d'arrivée n'est pas l'ordre des faits* (L2-03). Le prendre en
 * paramètre dès maintenant est ce qui évitera d'avoir à retourner tout ce
 * module ce jour-là ; et c'est aussi ce qui rend les scénarios indépendants de
 * l'horloge.
 *
 * ## CE QU'IL NE TOUCHE PAS, ET C'EST DÉLIBÉRÉ
 *
 * Ni `intervention.statut`, ni `intervention.temps_reel_min`. Les deux sont des
 * questions ouvertes, écrites dans la migration de R5-02 et posées à Alexis :
 * démarrer le compteur doit-il faire passer l'intervention EN COURS (RG-INT-01
 * exigerait alors une machine, et le dépannage à l'aveugle est le cas
 * ordinaire) ? et qui écrit désormais le temps réel, la colonne n'ayant
 * aujourd'hui qu'un seul chemin d'écriture — la clôture au back-office ?
 *
 * *Un module qui répondrait à ces questions par accident les aurait tranchées.*
 */

/** Ce qu'une action rend : la ligne écrite, ou le refus avec sa clé. */
export type ResultatCompteur =
  | { readonly accepte: true; readonly segment: Segment }
  | { readonly accepte: false; readonly cle: RefusCompteur };

const CHAMPS: { id: true; debut: true; fin: true } = {
  id: true,
  debut: true,
  fin: true,
};

/**
 * DÉMARRER — un nouveau segment ouvert pour cette personne.
 *
 * **Les segments lus sont ceux de la PERSONNE, toutes interventions
 * confondues.** C'est la forme même de la règle : une personne ne travaille pas
 * à deux endroits à la fois, et lire les seuls segments de l'intervention visée
 * laisserait démarrer un second compteur ailleurs — que la base refuserait
 * ensuite, par une violation d'index sans motif lisible.
 */
export async function demarrerLeCompteur(
  contexte: ContexteSession,
  interventionId: string,
  instant: Date,
  client?: PrismaClient,
): Promise<ResultatCompteur> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ouverts = await tx.segmentTravail.findMany({
        where: { utilisateur_id: contexte.utilisateurId, fin: null },
        select: CHAMPS,
      });
      const verdict = peutDemarrer(ouverts);
      if (!verdict.accepte) {
        return { accepte: false as const, cle: verdict.cle };
      }
      const segment = await tx.segmentTravail.create({
        data: {
          // L'identifiant naît ICI et non en base (I10) : un segment doit
          // pouvoir naître sur l'appareil, sans réseau, le jour où la file de
          // synchronisation existera. La table n'a volontairement aucun défaut.
          id: uuidv7(),
          societe_id: societeId,
          intervention_id: interventionId,
          utilisateur_id: contexte.utilisateurId,
          debut: instant,
        },
        select: CHAMPS,
      });
      return { accepte: true as const, segment };
    },
    client,
  );
}

/**
 * ARRÊTER — fermer le segment ouvert de cette personne.
 *
 * **Un seul geste pour la pause et pour l'arrêt**, et c'est écrit dans
 * `compteur.ts` : sur les segments, les deux font la même chose. Ce qui les
 * distinguerait est ce que l'arrêt ferait au statut de l'intervention, et ce
 * point n'est pas tranché. *En offrir deux qui font la même chose serait mentir
 * sur l'un des deux.*
 *
 * L'intervention n'est PAS un paramètre : le segment ouvert de cette personne
 * est unique, et c'est lui qu'on ferme. *Demander laquelle ouvrirait la porte à
 * un appelant qui se tromperait de ligne, et il n'y a rien à choisir.*
 */
export async function arreterLeCompteur(
  contexte: ContexteSession,
  instant: Date,
  client?: PrismaClient,
): Promise<ResultatCompteur> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ouverts = await tx.segmentTravail.findMany({
        where: { utilisateur_id: contexte.utilisateurId, fin: null },
        select: CHAMPS,
      });
      const verdict = peutArreter(ouverts, instant);
      if (!verdict.accepte) {
        return { accepte: false as const, cle: verdict.cle };
      }
      // `ouverts[0]` existe : `peutArreter` vient de le constater. Le relire
      // par son identifiant plutôt que par `fin: null` est ce qui rend
      // l'écriture SÛRE — un `updateMany` sur la condition fermerait ce qui
      // serait apparu entre-temps.
      const segment = await tx.segmentTravail.update({
        where: { id: ouverts[0].id },
        data: { fin: instant },
        select: CHAMPS,
      });
      return { accepte: true as const, segment };
    },
    client,
  );
}

/**
 * CE QUE LE COMPTEUR A MESURÉ SUR UNE INTERVENTION — toutes personnes
 * confondues.
 *
 * *Un renfort d'une heure est du temps passé sur cette intervention*, et
 * filtrer sur l'affectation en perdrait la trace. La mesure est celle de
 * l'intervention, pas celle d'une personne.
 */
export async function mesureDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<Mesure> {
  return avecContexteApplicatif(
    contexte,
    async (tx) =>
      mesurer(
        await tx.segmentTravail.findMany({
          where: { intervention_id: interventionId },
          select: CHAMPS,
          orderBy: [{ debut: "asc" }, { id: "asc" }],
        }),
      ),
    client,
  );
}

/**
 * LE COMPTEUR QUI TOURNE POUR CETTE PERSONNE, ou `null`.
 *
 * L'écran du terrain en a besoin avant d'afficher un bouton : *proposer
 * « démarrer » à quelqu'un dont le compteur tourne ailleurs est une promesse
 * que la base refusera.*
 */
export async function compteurEnCours(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<{
  readonly segment: Segment;
  readonly interventionId: string;
} | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.segmentTravail.findFirst({
        where: { utilisateur_id: contexte.utilisateurId, fin: null },
        select: { ...CHAMPS, intervention_id: true },
      });
      if (ligne === null) {
        return null;
      }
      const { intervention_id, ...segment } = ligne;
      return { segment, interventionId: intervention_id };
    },
    client,
  );
}
