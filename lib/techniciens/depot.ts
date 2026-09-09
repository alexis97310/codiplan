import { type ContexteSession } from "@/lib/auth/contexte";
import {
  type Calendrier,
  type JourLocal,
  chargerCalendrierAgence,
  instantAMinutes,
  jourSuivant,
  minutesOuvrees,
} from "@/lib/calendar";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LES TECHNICIENS — habilitations datées, et composition des heures du mois
 * (ticket L2-13, D9, D76).
 *
 * **L'expiration ne masque RIEN** (D81). Une habilitation périmée reste lue et
 * affichée, avec son effet écrit — « expirée depuis 9 jours » — parce qu'elle
 * refuse une AFFECTATION et non une lecture. Une ligne qui disparaîtrait ne se
 * contesterait pas, et le responsable qui doit la renouveler ne la verrait plus.
 *
 * **Le taux d'occupation ne voyage JAMAIS seul** (D76). Ce module rend les
 * quatre composantes ET les deux termes du rapport ; il ne rend pas un
 * pourcentage. « Taux d'occupation » est le nom, sa formule l'accompagne, et le
 * mot « productivité » n'apparaît nulle part : il ferait lire un rendement là où
 * il y a du temps occupé, et quelqu'un déciderait sur ce chiffre.
 */

/** L'effet d'une échéance, au jour où on la regarde. */
export type EffetEcheance =
  | { readonly nature: "sans_echeance" }
  | { readonly nature: "valable"; readonly joursRestants: number }
  | { readonly nature: "expiree"; readonly joursDepuis: number };

/** Une habilitation détenue, avec son échéance et son effet. */
export type HabilitationDatee = {
  readonly code: string;
  readonly libelle: string;
  readonly dateExpiration: Date | null;
  readonly effet: EffetEcheance;
};

/**
 * Les quatre composantes des heures du mois.
 *
 * **`atelier` n'est pas un type de temps en base**, et c'est une décision
 * écrite plutôt que tue : `intervention_temps.type` en porte quatre — trajet,
 * intervention, attente, pause. L'atelier est du temps d'INTERVENTION passé sur
 * une intervention NON FACTURABLE : une remise en état au dépôt est du travail,
 * pas de l'attente. Le reste — attente, pause — tombe dans `autres`.
 *
 * *Ce que cette lecture coûte, nommé : elle confond une intervention non
 * facturable faite chez le client avec du travail d'atelier. Les distinguer
 * demanderait un lieu d'exécution sur l'intervention, que le chapitre 11 ne
 * prévoit pas.*
 */
export type CompositionHeures = {
  readonly interventionMinutes: number;
  readonly trajetMinutes: number;
  readonly atelierMinutes: number;
  readonly autresMinutes: number;
  /**
   * Minutes ouvrées du mois d'après le calendrier du technicien (D72, D76).
   *
   * **Les absences n'en sont PAS déduites**, et c'est écrit ici plutôt que
   * corrigé en silence : la table `absence` du chapitre 11 n'existe pas encore.
   * Le taux d'occupation est donc MINORÉ pour un technicien absent — l'écrire
   * vaut mieux que de laisser croire le contraire (L3-17 le fermera).
   */
  readonly travailleesMinutes: number;
};

/** Un technicien, ses habilitations et son mois. */
export type FicheTechnicien = {
  readonly id: string;
  readonly nom: string;
  readonly agence: string;
  readonly calendrierPropre: boolean;
  readonly habilitations: readonly HabilitationDatee[];
  readonly heures: CompositionHeures;
};

/** Le jour civil d'une date, en UTC — les colonnes d'échéance sont des `DATE`. */
function jourCivil(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const MS_PAR_JOUR = 86_400_000;

/**
 * L'effet d'une échéance, à une date de référence.
 *
 * **`null` ne veut pas dire « expirée »** : une habilitation sans échéance n'est
 * jamais en retard (D9). Et l'égalité est valable : une habilitation qui expire
 * le jour même l'est encore ce jour-là — la règle dit « antérieure à », et une
 * date égale ne l'est pas.
 */
export function effetEcheance(
  dateExpiration: Date | null,
  reference: Date,
): EffetEcheance {
  if (dateExpiration === null) {
    return { nature: "sans_echeance" };
  }
  const ecart = Math.round(
    (jourCivil(dateExpiration) - jourCivil(reference)) / MS_PAR_JOUR,
  );
  return ecart >= 0
    ? { nature: "valable", joursRestants: ecart }
    : { nature: "expiree", joursDepuis: -ecart };
}

/** Les bornes du mois qui contient `jour`, dans le fuseau du calendrier. */
function bornesDuMois(
  jour: JourLocal,
  fuseau: string,
): { debut: Date; fin: Date } {
  const premier = { annee: jour.annee, mois: jour.mois, jour: 1 };
  const suivant =
    jour.mois === 12
      ? { annee: jour.annee + 1, mois: 1, jour: 1 }
      : { annee: jour.annee, mois: jour.mois + 1, jour: 1 };
  return {
    debut: instantAMinutes(premier, 0, fuseau),
    fin: instantAMinutes(suivant, 0, fuseau),
  };
}

/**
 * Les techniciens de la société active, avec leurs habilitations et leur mois.
 *
 * `jour` fixe le MOIS regardé et la date de référence des échéances. Il est
 * local : sous UTC+11, le premier du mois ici n'est pas le premier du mois en
 * UTC pendant onze heures (L0-08).
 */
export async function lireLesTechniciens(
  contexte: ContexteSession,
  jour: JourLocal,
): Promise<readonly FicheTechnicien[]> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const societeId = contexte.societeId ?? "";

    const techniciens = await tx.technicien.findMany({
      where: { actif: true },
      select: {
        id: true,
        agence_id: true,
        calendrier_id: true,
        agence: { select: { libelle: true } },
        membre: {
          select: {
            utilisateur: { select: { nom: true, email: true } },
            habilitations: {
              select: {
                date_expiration: true,
                habilitation: { select: { code: true, libelle: true } },
              },
              orderBy: { habilitation_id: "asc" },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const fiches: FicheTechnicien[] = [];

    for (const technicien of techniciens) {
      const calendrierAgence = await chargerCalendrierAgence(tx, {
        societeId,
        agenceId: technicien.agence_id,
        fenetre: { du: jour, au: jourSuivant(jour, 31) },
      });

      let calendrier: Calendrier | null = calendrierAgence;
      if (calendrierAgence !== null && technicien.calendrier_id !== null) {
        const propre = await tx.calendrier.findFirst({
          where: { id: technicien.calendrier_id },
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
        });
        if (propre !== null) {
          calendrier = {
            ...calendrierAgence,
            code: propre.code,
            plages: propre.plages,
          };
        }
      }

      const fuseau = calendrier?.fuseau ?? "UTC";
      const { debut, fin } = bornesDuMois(jour, fuseau);

      const temps = await tx.interventionTemps.findMany({
        where: {
          technicien_id: technicien.id,
          debut: { gte: debut, lt: fin },
        },
        select: {
          type: true,
          duree_min: true,
          intervention: { select: { statut_facturation: true } },
        },
      });

      let interventionMinutes = 0;
      let trajetMinutes = 0;
      let atelierMinutes = 0;
      let autresMinutes = 0;

      for (const ligne of temps) {
        if (ligne.type === "trajet") {
          trajetMinutes += ligne.duree_min;
        } else if (ligne.type === "intervention") {
          if (ligne.intervention.statut_facturation === "non_facturable") {
            atelierMinutes += ligne.duree_min;
          } else {
            interventionMinutes += ligne.duree_min;
          }
        } else {
          autresMinutes += ligne.duree_min;
        }
      }

      fiches.push({
        id: technicien.id,
        nom:
          technicien.membre.utilisateur.nom ||
          technicien.membre.utilisateur.email,
        agence: technicien.agence.libelle,
        calendrierPropre: technicien.calendrier_id !== null,
        habilitations: technicien.membre.habilitations.map((ligne) => ({
          code: ligne.habilitation.code,
          libelle: ligne.habilitation.libelle,
          dateExpiration: ligne.date_expiration,
          effet: effetEcheance(
            ligne.date_expiration,
            instantAMinutes(jour, 0, fuseau),
          ),
        })),
        heures: {
          interventionMinutes,
          trajetMinutes,
          atelierMinutes,
          autresMinutes,
          travailleesMinutes:
            calendrier === null ? 0 : minutesOuvrees(calendrier, debut, fin),
        },
      });
    }

    return fiches;
  });
}
