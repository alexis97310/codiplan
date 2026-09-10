import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { minutesOuvrees } from "@/lib/calendar/ouverture";
import { versLocal } from "@/lib/calendar/fuseau";
import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import {
  occupationTechnicien,
  type InterventionMesuree,
  type OccupationTechnicien,
} from "./statistiques";

/**
 * LE DÉNOMINATEUR DU TAUX D'OCCUPATION, lu au calendrier plutôt qu'inventé.
 *
 * ## Pourquoi la maille est (technicien, agence) et non le technicien seul
 *
 * Les minutes ouvrables viennent du **calendrier de l'agence** : I7 l'exige —
 * *aucun calendrier global codé en dur*, Ducos ouvre le samedi et Koné non. Un
 * technicien qui intervient pour deux agences n'a donc pas UN dénominateur,
 * il en a deux.
 *
 * **Trois façons de s'en sortir, et deux sont mauvaises.** Prendre l'agence où
 * il a le plus d'interventions CHOISIT en silence, et le choix bascule d'une
 * semaine à l'autre. Additionner les deux calendriers compterait deux fois les
 * heures d'une même journée. **La troisième est d'assumer la maille réelle :
 * une ligne par couple (technicien, agence)** — c'est ce que fait ce module, et
 * un technicien qui n'intervient que pour une agence n'y voit aucune
 * différence.
 *
 * *Ce que cela ne tranche pas, et qui reste dû :* la table `technicien` du
 * chapitre 11 n'existe pas (CLAUDE.md §6, marque `(prévu)`), et le calendrier
 * de travail PROPRE au technicien — `technicien_calendrier`, l'exception de
 * L2 — n'est pas encore consulté ici. Le jour où il le sera, c'est lui qui
 * fera foi et l'agence deviendra le repli.
 *
 * ## Le refus plutôt que le chiffre
 *
 * Une agence sans calendrier rend `minutesOuvrables = 0`, ce que
 * `tauxOccupation` traduit par `null` — *« pas de calendrier » n'est pas
 * « 0 % »*. L'écran affiche alors l'absence, jamais un pourcentage.
 */

/** Une ligne de statistique, telle que l'écran la consomme. */
export type LigneOccupation = {
  readonly technicienId: string | null;
  readonly agenceId: string;
  readonly agenceLibelle: string;
  readonly occupation: OccupationTechnicien;
};

type Mesurable = InterventionMesuree & { readonly agence_id: string };

/**
 * Regroupe les interventions par (technicien, agence) et donne à chaque groupe
 * son dénominateur, lu au calendrier de l'agence sur la période affichée.
 *
 * `du` et `au` sont des instants ; le calendrier les rapporte au fuseau de son
 * agence, comme partout ailleurs (L0-08).
 */
export async function occupationsDuPlanning(
  contexte: ContexteSession,
  interventions: readonly Mesurable[],
  du: Date,
  au: Date,
): Promise<readonly LigneOccupation[]> {
  const societeId = contexte.societeId;
  if (societeId === null) {
    return [];
  }

  const groupes = new Map<
    string,
    { cle: LigneOccupation; lignes: Mesurable[] }
  >();
  for (const intervention of interventions) {
    const cle = `${intervention.technicien_id ?? ""}|${intervention.agence_id}`;
    const existant = groupes.get(cle);
    if (existant === undefined) {
      groupes.set(cle, {
        cle: {
          technicienId: intervention.technicien_id,
          agenceId: intervention.agence_id,
          agenceLibelle: "",
          occupation: occupationTechnicien(intervention.technicien_id, [], 0),
        },
        lignes: [intervention],
      });
    } else {
      existant.lignes.push(intervention);
    }
  }

  return avecContexteApplicatif(contexte, async (tx) => {
    const agences = await tx.agence.findMany({
      where: {
        id: { in: [...new Set(interventions.map((i) => i.agence_id))] },
      },
      select: { id: true, libelle: true },
    });
    const libelles = new Map(agences.map((a) => [a.id, a.libelle]));

    const resultat: LigneOccupation[] = [];
    // Le calendrier d'une agence est lu UNE fois, même si deux techniciens y
    // travaillent : le dénominateur ne dépend que de l'agence et de la période.
    const ouvrablesParAgence = new Map<string, number>();

    for (const { cle, lignes } of groupes.values()) {
      let ouvrables = ouvrablesParAgence.get(cle.agenceId);
      if (ouvrables === undefined) {
        const calendrier = await chargerCalendrierAgence(tx, {
          societeId,
          agenceId: cle.agenceId,
          fenetre: { du: versLocal(du, "UTC"), au: versLocal(au, "UTC") },
        });
        // Une agence sans calendrier n'a pas d'heures ouvrables CONNUES. Zéro
        // est ici le signal de l'absence, et `tauxOccupation` le rend en
        // `null` plutôt qu'en « 0 % ».
        ouvrables =
          calendrier === null ? 0 : minutesOuvrees(calendrier, du, au);
        ouvrablesParAgence.set(cle.agenceId, ouvrables);
      }

      resultat.push({
        ...cle,
        agenceLibelle: libelles.get(cle.agenceId) ?? cle.agenceId,
        occupation: occupationTechnicien(cle.technicienId, lignes, ouvrables),
      });
    }

    // Le technicien non affecté vient en dernier : c'est une file d'attente,
    // pas une personne, et la mettre en tête ferait lire la liste à l'envers.
    return resultat.sort((a, b) => {
      if ((a.technicienId === null) !== (b.technicienId === null)) {
        return a.technicienId === null ? 1 : -1;
      }
      return (a.technicienId ?? "").localeCompare(b.technicienId ?? "");
    });
  });
}
