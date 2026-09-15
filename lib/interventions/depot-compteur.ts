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
import { peutDemarrerLeCompteur } from "./cycle-de-vie";
import type { StatutIntervention } from "./saisie";

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
 * ## CE QU'IL TOUCHE SUR L'INTERVENTION, ET POURQUOI (D120)
 *
 * Les deux questions que R5-02 avait laissées ouvertes sont tranchées, et ce
 * module porte les deux réponses :
 *
 * **Démarrer le compteur fait passer l'intervention EN COURS, d'un seul
 * geste** — *« il pourra démarrer son intervention, et qu'à ce moment le
 * compteur commence »*. **Sans machine rattachée** : une intervention peut
 * porter sur autre chose qu'un équipement, et le bloc qui l'exigeait a quitté
 * la base au même moment.
 *
 * **Arrêter le compteur écrit `temps_mesure_min`** — la somme des segments
 * fermés. C'est la seule source du temps, et la base refuse toute autre valeur.
 *
 * **Les deux écritures sont dans la MÊME transaction que le segment.** Un
 * segment posé sans que le statut suive laisserait le planning affirmer qu'une
 * intervention en cours ne l'est pas ; un segment fermé sans que la somme suive
 * laisserait un temps mesuré faux, c'est-à-dire le pire des deux.
 *
 * **ET L'ORDRE, LUI, N'EST PAS INDIFFÉRENT** : le segment est fermé AVANT que
 * la somme soit écrite, parce que le déclencheur qui garde `temps_mesure_min`
 * la recalcule depuis `segment_travail`. L'écrire d'abord ferait refuser la
 * valeur par la base — et pour une bonne raison : elle serait fausse d'un
 * segment.
 */

/**
 * Ce qu'une action rend : la ligne écrite, ou le refus avec sa clé.
 *
 * **La clé est un `string` et non la seule union du compteur**, et c'est une
 * conséquence de D120 : depuis que démarrer le compteur touche le STATUT, un
 * refus peut venir du cycle de vie — *intervention annulée, clôturée,
 * suspendue* — dont les clés vivent dans `cycle-de-vie.ts`. Les recopier ici
 * ferait deux listes à tenir d'accord ; les fondre dans une seule union
 * imposerait au cycle de vie de connaître le compteur. **Ce que la frontière
 * garantit est plus étroit et suffit : c'est une CLÉ de dictionnaire, jamais
 * une phrase** — et `estCleTraduction` le vérifie à l'écran, où le texte est
 * choisi.
 */
export type CleDeRefus = RefusCompteur | (string & {});

export type ResultatCompteur =
  | { readonly accepte: true; readonly segment: Segment }
  | { readonly accepte: false; readonly cle: CleDeRefus };

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
      // LE STATUT DE L'INTERVENTION VISÉE, LU AVANT TOUT (D120). Une figée ou
      // une suspendue ne se démarre pas, et le refus est NOMMÉ ici plutôt que
      // rendu par la base en violation de contrainte.
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { statut: true },
      });
      if (intervention === null) {
        return { accepte: false as const, cle: "compteur.refus.introuvable" };
      }
      const surLIntervention = peutDemarrerLeCompteur(
        intervention.statut as StatutIntervention,
      );
      if (surLIntervention.refuse) {
        return { accepte: false as const, cle: surLIntervention.cle };
      }

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

      // ── ET L'INTERVENTION PASSE EN COURS, D'UN SEUL GESTE (D120) ─────────
      //
      // *« Il pourra démarrer son intervention, et qu'à ce moment le compteur
      // commence. »* Une écriture conditionnelle plutôt qu'inconditionnelle :
      // une intervention DÉJÀ en cours ne se réécrit pas, ce qui éviterait au
      // journal d'audit une ligne qui ne dit rien.
      if (intervention.statut !== "en_cours") {
        await tx.intervention.update({
          where: { id: interventionId },
          data: { statut: "en_cours" },
        });
      }

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
        select: { ...CHAMPS, intervention_id: true },
      });
      const verdict = peutArreter(ouverts, instant);
      if (!verdict.accepte) {
        return { accepte: false as const, cle: verdict.cle };
      }
      const interventionDuSegment = ouverts[0].intervention_id;
      // `ouverts[0]` existe : `peutArreter` vient de le constater. Le relire
      // par son identifiant plutôt que par `fin: null` est ce qui rend
      // l'écriture SÛRE — un `updateMany` sur la condition fermerait ce qui
      // serait apparu entre-temps.
      const segment = await tx.segmentTravail.update({
        where: { id: ouverts[0].id },
        data: { fin: instant },
        select: CHAMPS,
      });

      // ── ET LE TEMPS MESURÉ SUIT, DANS LA MÊME TRANSACTION (D120) ─────────
      //
      // **APRÈS la fermeture du segment, jamais avant** : le déclencheur qui
      // garde cette colonne recalcule la somme depuis `segment_travail`, et
      // l'écrire d'abord ferait refuser une valeur fausse d'un segment — ce
      // qu'il doit faire.
      //
      // La somme est relue depuis la BASE plutôt que composée de mémoire : un
      // renfort a pu fermer le sien entre-temps, et *le temps d'une
      // intervention est celui de tous ceux qui y ont travaillé.*
      const tous = await tx.segmentTravail.findMany({
        where: { intervention_id: interventionDuSegment },
        select: CHAMPS,
      });
      await tx.intervention.update({
        where: { id: interventionDuSegment },
        data: { temps_mesure_min: mesurer(tous).minutes },
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
