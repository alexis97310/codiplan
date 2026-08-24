import type { Prisma } from "@prisma/client";

import { cleJour, lireFuseau, type Fuseau, type JourLocal } from "./fuseau";
import { appliquerEcarts, lireCalendrier, type Calendrier } from "./calendrier";

/**
 * Résolution du calendrier d'une AGENCE depuis la base (ticket L0-08, D5, D13).
 *
 * **Agence, jamais site** : une agence est un établissement CODIMA, un site est
 * un lieu d'intervention chez un client. Les calendriers d'ouverture sont
 * portés par l'agence (I7).
 */

/** La part d'une agence dont dépend son fuseau — surcharge et héritage (D5). */
export type AgenceFuseau = {
  fuseau_horaire: string | null;
  societe: { fuseau_horaire: string };
};

/**
 * Fuseau effectif d'une agence : le sien s'il est posé, celui de sa société
 * sinon (D5 — « hérité de la société, surchargeable »).
 *
 * **C'est le seul endroit où cette règle d'héritage est écrite.** Recopiée
 * ailleurs, elle divergerait le jour où une agence de métropole s'ouvrirait
 * sous une société néo-calédonienne — et le planning de cette agence-là
 * décalerait de dix heures sans que rien ne le signale.
 */
export function fuseauDeLAgence(agence: AgenceFuseau): Fuseau {
  return lireFuseau(agence.fuseau_horaire ?? agence.societe.fuseau_horaire);
}

/** Fenêtre de jours pour laquelle les jours particuliers sont chargés. */
export type FenetreJours = { du: JourLocal; au: JourLocal };

/**
 * Charge le calendrier d'ouverture d'une agence, jours particuliers compris.
 *
 * **L'ordre de lecture est celui de D46, complément 2** : le **fait public** du
 * territoire est lu d'abord (`jour_ferie`), l'**écart local** de l'agence
 * ensuite (`calendrier_ferie`), et `appliquerEcarts` les compose dans ce sens.
 * Jamais l'inverse : une agence ne décrète pas les fériés de son territoire.
 *
 * **Le territoire vient de l'AGENCE, pas du fuseau et pas du calendrier**
 * (D46, complément 1). Deux agences qui partagent un calendrier d'ouverture —
 * Ducos et Dolbeau — peuvent relever de territoires différents, et deux agences
 * qui partagent un fuseau aussi : `Europe/Paris` couvre plusieurs territoires
 * aux fériés différents.
 *
 * **Le filtre société est explicite** (CLAUDE.md §5.6), en plus de la politique
 * RLS que la transaction applique déjà : une requête qui ne porterait le filtre
 * que dans la base serait juste aujourd'hui et fausse le jour où elle
 * s'exécuterait sous un rôle exempté.
 *
 * **Les jours particuliers sont chargés sur une FENÊTRE**, jamais en totalité :
 * la table couvre plusieurs années et plusieurs territoires, et un calcul
 * d'heures ouvrées sur une semaine n'a que faire de 2028.
 *
 * Rend `null` quand l'agence n'existe pas dans la société, ou qu'elle n'a pas
 * de calendrier. Ce n'est pas une erreur, c'est un paramétrage incomplet, et le
 * module le signale à l'appelant plutôt que d'inventer des horaires, ce que I7
 * interdit.
 *
 * **Le territoire, lui, n'est plus un cas** : `agence.territoire` est NOT NULL
 * depuis L0-09a (D48), parce que le chaînage de `calendrier_ferie` s'appuie
 * dessus et qu'une clé étrangère dont une colonne vaut NULL n'est pas
 * contrôlée. Une agence sans territoire n'existe plus en base ; il n'y a donc
 * plus rien à rattraper ici.
 */
export async function chargerCalendrierAgence(
  tx: Prisma.TransactionClient,
  parametres: { societeId: string; agenceId: string; fenetre: FenetreJours },
): Promise<Calendrier | null> {
  const { societeId, agenceId, fenetre } = parametres;

  const du = new Date(`${cleJour(fenetre.du)}T00:00:00.000Z`);
  const au = new Date(`${cleJour(fenetre.au)}T00:00:00.000Z`);

  const agence = await tx.agence.findFirst({
    where: { id: agenceId, societe_id: societeId },
    select: {
      fuseau_horaire: true,
      territoire: true,
      societe: { select: { fuseau_horaire: true } },
      calendrier: {
        select: {
          code: true,
          plages: {
            select: {
              jour_semaine: true,
              debut_minutes: true,
              fin_minutes: true,
            },
          },
        },
      },
      // 2. L'ÉCART LOCAL de l'agence — lu ici, appliqué APRÈS le fait public.
      ecarts: {
        where: { date: { gte: du, lte: au } },
        select: { date: true, travaille: true, motif: true },
      },
    },
  });

  if (agence === null || agence.calendrier === null) {
    return null;
  }

  // 1. LE FAIT PUBLIC du territoire. Il est lu en premier, et il est le même
  //    pour toutes les sociétés qui opèrent là (D46).
  const faitsPublics = await tx.jourFerie.findMany({
    where: { territoire: agence.territoire, date: { gte: du, lte: au } },
    select: { date: true, libelle: true },
    orderBy: { date: "asc" },
  });

  return lireCalendrier({
    code: agence.calendrier.code,
    fuseau: fuseauDeLAgence(agence),
    territoire: agence.territoire,
    plages: agence.calendrier.plages,
    jours_particuliers: appliquerEcarts(
      faitsPublics.map((fait) => ({
        date: cleJourDeDate(fait.date),
        libelle: fait.libelle,
      })),
      agence.ecarts.map((ecart) => ({
        date: cleJourDeDate(ecart.date),
        travaille: ecart.travaille,
        motif: ecart.motif,
      })),
    ),
  });
}

/**
 * Clé `AAAA-MM-JJ` d'une colonne PostgreSQL `date`.
 *
 * Le pilote rend une `Date` positionnée à minuit **UTC** : lire ses composantes
 * avec les accesseurs locaux la ferait basculer d'un jour à l'ouest de
 * Greenwich. Les accesseurs UTC sont donc les seuls justes ici — et le passage
 * par la chaîne ISO est la façon la plus courte de le dire.
 */
function cleJourDeDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
