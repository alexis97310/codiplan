import type { Calendrier } from "@/lib/calendar/calendrier";
import {
  departCompteurAccuse,
  minutesOuvreesAgence,
} from "@/lib/calendar/usages";

/**
 * L'ACCUSÉ DE RÉCEPTION D'UNE DEMANDE — le standard des 30 minutes, mesuré en
 * HEURES OUVRÉES DE L'AGENCE (lot 2, L2-06 ; D13).
 *
 * > *« Accusé de réception sous 30 minutes : en heures ouvrées de l'agence. Une
 * > demande déposée sur le portail un dimanche à 22 h déclenche son compteur à
 * > l'ouverture du lundi. L'audit avait raison de poser la question — la
 * > réponse inverse aurait généré des alertes toutes les nuits. »* (D13)
 *
 * ## Ce module ne lit JAMAIS l'heure
 *
 * L'instant courant est un **paramètre**, comme dans `lib/vgp/information.ts`
 * et pour la même raison : lu ici, il rendrait un test vert parce que l'horloge
 * a bougé, et non parce que la règle tient. C'est l'appelant — qui connaît le
 * fuseau de l'agence — qui le fournit (L0-08).
 *
 * ## Trois états, jamais un booléen
 *
 * *Un booléen ne peut pas porter trois états* (doctrine §3), et l'état qu'il
 * écraserait est justement celui qui compte : **une demande sans réponse n'est
 * pas une demande hors délai.** Les deux se corrigent différemment — l'une
 * demande qu'on réponde, l'autre qu'on comprenne pourquoi on a répondu tard —
 * et les confondre ferait d'un « pas encore » un reproche.
 */

/**
 * LE STANDARD, en minutes ouvrées.
 *
 * Il vient du chapitre 7/M3 — *« Le standard interne de réactivité — toute
 * demande client reçoit une réponse sous 30 minutes — s'applique à l'accusé de
 * réception, quel que soit le niveau »* — et du tableau des alertes du
 * chapitre 16.1. **Il n'est donc pas inventé** : §8 du CLAUDE.md interdit
 * d'inventer un délai, il n'interdit pas d'écrire celui qui est spécifié.
 *
 * *Condition de réouverture, écrite pour être vérifiable :* le jour où une
 * seconde société aura un standard différent, cette constante devient une
 * colonne — sur `societe` ou sur `agence` —, et **c'est un point d'arrêt** :
 * toucher `societe` relève du §8 du CLAUDE.md. Elle n'est pas anticipée ici,
 * une colonne posée d'avance étant une décision de personne.
 */
export const MINUTES_ACCUSE_RECEPTION = 30;

/**
 * L'instant où le compteur COMMENCE, pour une demande déposée à `depose`.
 *
 * C'est la première ouverture du calendrier de l'agence à partir du dépôt — et
 * c'est le dépôt lui-même quand l'agence est ouverte. La valeur est
 * **matérialisée** sur la demande et jamais recalculée : le calendrier se
 * modifie, et un départ recalculé des mois plus tard bougerait sans qu'aucune
 * écriture ne le dise (le motif de D85, hors cloisonnement).
 */
export function departDuCompteur(
  agenceDeLaDemande: Calendrier,
  depose: Date,
): Date {
  return departCompteurAccuse(agenceDeLaDemande, depose);
}

/** Ce que l'accusé de réception d'une demande vaut, à un instant donné. */
export type EtatAccuse =
  | {
      readonly etat: "repondu";
      /** Minutes OUVRÉES écoulées entre le départ du compteur et la réponse. */
      readonly minutesOuvrees: number;
      readonly dansLeStandard: boolean;
    }
  | {
      readonly etat: "sans_reponse";
      /** Minutes OUVRÉES déjà écoulées, à l'instant fourni. */
      readonly minutesOuvrees: number;
      /** Le standard est-il DÉJÀ dépassé, réponse ou non ? */
      readonly depasse: boolean;
    };

/**
 * L'état de l'accusé de réception.
 *
 * **Les deux branches portent le même nombre**, et c'est délibéré : le décompte
 * ne voyage jamais sans dire de quel état il parle — *un nombre dont la
 * signification dépend d'une autre colonne ne voyage pas seul* (D56). « 45
 * minutes » n'est pas la même nouvelle selon qu'on a répondu ou non.
 *
 * **`depasse` n'est pas `dansLeStandard` inversé.** Une demande sans réponse
 * dont le compteur n'a pas encore atteint 30 minutes ouvrées n'est ni tenue ni
 * manquée : elle est en cours, et c'est la troisième réponse que le booléen
 * seul ne sait pas rendre.
 */
export function etatAccuse(
  agenceDeLaDemande: Calendrier,
  parametres: {
    readonly compteurDepart: Date;
    readonly accuseLe: Date | null;
    readonly maintenant: Date;
  },
): EtatAccuse {
  const { compteurDepart, accuseLe, maintenant } = parametres;

  if (accuseLe !== null) {
    const ecoulees = minutesOuvreesAgence(
      agenceDeLaDemande,
      compteurDepart,
      accuseLe,
    );
    return {
      etat: "repondu",
      minutesOuvrees: ecoulees,
      dansLeStandard: ecoulees <= MINUTES_ACCUSE_RECEPTION,
    };
  }

  const ecoulees = minutesOuvreesAgence(
    agenceDeLaDemande,
    compteurDepart,
    maintenant,
  );
  return {
    etat: "sans_reponse",
    minutesOuvrees: ecoulees,
    depasse: ecoulees > MINUTES_ACCUSE_RECEPTION,
  };
}
