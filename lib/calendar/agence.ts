import type { Prisma } from "@prisma/client";

import { cleJour, lireFuseau, type Fuseau, type JourLocal } from "./fuseau";
import { lireCalendrier, type Calendrier } from "./calendrier";

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

/** Fenêtre de jours pour laquelle les fériés sont chargés. */
export type FenetreJours = { du: JourLocal; au: JourLocal };

/**
 * Charge le calendrier d'ouverture d'une agence, fériés compris.
 *
 * **Le filtre société est explicite** (CLAUDE.md §5.6), en plus de la politique
 * RLS que la transaction applique déjà : une requête qui ne porterait le filtre
 * que dans la base serait juste aujourd'hui et fausse le jour où elle
 * s'exécuterait sous un rôle exempté.
 *
 * **Les fériés sont chargés sur une FENÊTRE**, jamais en totalité : la table
 * couvre plusieurs années et plusieurs territoires, et un calcul d'heures
 * ouvrées sur une semaine n'a que faire de 2028. La fenêtre est celle que
 * l'appelant s'apprête à parcourir.
 *
 * Rend `null` si l'agence n'existe pas dans la société, ou si elle n'a pas
 * encore de calendrier — ce dernier cas est un paramétrage incomplet, pas une
 * erreur : le module le signale à l'appelant plutôt que d'inventer des horaires
 * par défaut, ce que I7 interdit expressément.
 */
export async function chargerCalendrierAgence(
  tx: Prisma.TransactionClient,
  parametres: { societeId: string; agenceId: string; fenetre: FenetreJours },
): Promise<Calendrier | null> {
  const { societeId, agenceId, fenetre } = parametres;

  const agence = await tx.agence.findFirst({
    where: { id: agenceId, societe_id: societeId },
    select: {
      fuseau_horaire: true,
      societe: { select: { fuseau_horaire: true } },
      calendrier: {
        select: {
          code: true,
          territoire: true,
          plages: {
            select: {
              jour_semaine: true,
              debut_minutes: true,
              fin_minutes: true,
            },
          },
          feries: {
            select: {
              travaille: true,
              jour_ferie: { select: { date: true, libelle: true } },
            },
          },
        },
      },
    },
  });

  if (agence === null || agence.calendrier === null) {
    return null;
  }

  const du = cleJour(fenetre.du);
  const au = cleJour(fenetre.au);

  // `jour_ferie` est un référentiel territorial (D46) : tous les fériés du
  // territoire s'appliquent, et `calendrier_ferie` ne dit que l'exception —
  // ceux que l'agence TRAVAILLE. Les deux lectures se rejoignent ici.
  const surcharges = new Map<string, boolean>();
  for (const surcharge of agence.calendrier.feries) {
    surcharges.set(
      cleJourDeDate(surcharge.jour_ferie.date),
      surcharge.travaille,
    );
  }

  const feriesTerritoriaux = await tx.jourFerie.findMany({
    where: {
      territoire: agence.calendrier.territoire,
      date: {
        gte: new Date(`${du}T00:00:00.000Z`),
        lte: new Date(`${au}T00:00:00.000Z`),
      },
    },
    select: { date: true, libelle: true },
    orderBy: { date: "asc" },
  });

  return lireCalendrier({
    code: agence.calendrier.code,
    fuseau: fuseauDeLAgence(agence),
    territoire: agence.calendrier.territoire,
    plages: agence.calendrier.plages,
    feries: feriesTerritoriaux.map((ferie) => {
      const date = cleJourDeDate(ferie.date);
      return {
        date,
        libelle: ferie.libelle,
        // Absence de surcharge = férié chômé (D13).
        travaille: surcharges.get(date) ?? false,
      };
    }),
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
