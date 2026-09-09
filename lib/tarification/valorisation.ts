import {
  type Montant,
  additionner,
  arrondirAuPlusProche,
  montant,
  zero,
} from "@/lib/money";

/**
 * LA VALORISATION D'UNE INTERVENTION — RG-TAR-05, D11, D57, D74 (L2-14).
 *
 * **Elle vit ici et nulle part ailleurs.** `lib/calendar` répond à « quand »,
 * `lib/money` formate et calcule ; aucun des deux ne décide ce qu'on facture
 * (D45). Un composant qui calculerait un total serait une seconde source du même
 * montant, et deux sources d'un même fait divergent en silence.
 *
 * ## L'ARRONDI, et l'endroit exact où il s'applique
 *
 * **Au QUART D'HEURE SUPÉRIEUR, une seule fois sur l'intervention entière**
 * (RG-TAR-05 amendée par D57). Deux moitiés, et chacune a été tranchée
 * séparément :
 *
 * - *à l'intérieur* d'une intervention, le temps est cumulé PAR TECHNICIEN
 *   avant d'être arrondi ; les lignes ne s'arrondissent jamais une à une (D11).
 *   Trois tâches de dix minutes font une demi-heure, pas trois quarts d'heure.
 * - *entre* interventions, l'arrondi ne se mutualise pas : cinq passages de cinq
 *   minutes chez le même client dans la même journée font **1 h 15**, et non
 *   30 minutes (D57). Un facteur deux et demi, sur une tournée de dépannages
 *   courts qui n'a rien d'exceptionnel.
 *
 * ## LE TRAJET N'EST JAMAIS DU TEMPS FACTURÉ (D74)
 *
 * Il est du temps RÉEL — il compte dans les heures du technicien — et il ne
 * porte aucune minute facturée. Ce module rend donc les deux séparément, et
 * l'écran affiche le trajet plutôt que de le taire : *un temps qu'on ne montre
 * pas est un temps qu'on croit gratuit.*
 *
 * ## CE QUI N'EST PAS ICI, ET QUI EST ÉCRIT PLUTÔT QUE TU
 *
 * La **majoration heures non ouvrées** (D12, D13). Elle dépend du calendrier de
 * l'agence du technicien et du découpage du temps passé en minutes ouvrées et
 * non ouvrées ; `minutesHorsOuvertureTechnicien` sait le faire, mais le taux de
 * majoration est une donnée par société que rien ne relie encore à une ligne de
 * temps. L'appliquer au jugé donnerait un montant faux — et une facture fausse
 * ne se rattrape pas par un correctif de version.
 */

/** Le quart d'heure, en minutes. La granularité de RG-TAR-05. */
export const PAS_ARRONDI_MINUTES = 15;

/** Une ligne de temps, telle que la base la rend. */
export type LigneTemps = {
  readonly technicienId: string;
  readonly type: "trajet" | "intervention" | "attente" | "pause";
  readonly dureeMinutes: number;
  readonly facturable: boolean;
};

/** Un forfait appliqué à l'intervention. */
export type ForfaitApplique = {
  readonly code: string;
  readonly libelle: string;
  readonly montant: Montant;
};

/** Le détail par technicien : c'est là que l'arrondi se voit. */
export type MainDOeuvreTechnicien = {
  readonly technicienId: string;
  /** Minutes réellement pointées et facturables. */
  readonly minutesReelles: number;
  /** Les mêmes, arrondies au quart d'heure supérieur. */
  readonly minutesFacturees: number;
  readonly montant: Montant;
};

/** Ce qu'une intervention vaut, ligne à ligne. */
export type Valorisation = {
  /** Tout le temps pointé, trajet compris — le temps VÉCU. */
  readonly minutesReellesTotales: number;
  /** Le trajet, isolé : réel, jamais facturé (D74). */
  readonly minutesTrajet: number;
  /** Le temps pointé non facturable hors trajet — attente, pause, geste commercial. */
  readonly minutesNonFacturables: number;
  readonly mainDOeuvre: readonly MainDOeuvreTechnicien[];
  readonly totalMainDOeuvre: Montant;
  readonly forfaits: readonly ForfaitApplique[];
  readonly totalForfaits: Montant;
  /** Total HORS TAXES. La TVA n'est décidée nulle part dans ce dépôt. */
  readonly totalHt: Montant;
};

/**
 * Arrondit des minutes AU QUART D'HEURE SUPÉRIEUR.
 *
 * *Supérieur*, jamais « au plus proche » : `arrondirAuPlusProche` de
 * `lib/money` est l'arrondi COMMERCIAL des montants, et l'employer ici ferait
 * tomber 7 minutes à zéro. Ce sont deux règles différentes portant le même mot,
 * et les confondre coûterait un quart d'heure par intervention courte.
 */
export function auQuartDHeureSuperieur(minutes: number): number {
  if (minutes <= 0) {
    return 0;
  }
  return Math.ceil(minutes / PAS_ARRONDI_MINUTES) * PAS_ARRONDI_MINUTES;
}

/**
 * Valorise une intervention.
 *
 * @param lignes le temps pointé, ligne à ligne.
 * @param tauxHoraireMineur le taux HISTORISÉ sur l'intervention (RG-TAR-04),
 *        en unités mineures de la devise. Il est figé à la qualification : une
 *        facture qui change quand le tarif change est une facture fausse.
 * @param forfaits les forfaits appliqués, déjà retenus par RG-TAR-06.
 * @param devise le code de devise de l'intervention (I2 — aucune conversion).
 */
export function valoriser(
  lignes: readonly LigneTemps[],
  tauxHoraireMineur: bigint | null,
  forfaits: readonly ForfaitApplique[],
  devise: string,
): Valorisation {
  let minutesReellesTotales = 0;
  let minutesTrajet = 0;
  let minutesNonFacturables = 0;

  // Le cumul PAR TECHNICIEN, avant tout arrondi (D11).
  const parTechnicien = new Map<string, number>();

  for (const ligne of lignes) {
    minutesReellesTotales += ligne.dureeMinutes;

    if (ligne.type === "trajet") {
      minutesTrajet += ligne.dureeMinutes;
      continue;
    }
    if (!ligne.facturable) {
      minutesNonFacturables += ligne.dureeMinutes;
      continue;
    }
    parTechnicien.set(
      ligne.technicienId,
      (parTechnicien.get(ligne.technicienId) ?? 0) + ligne.dureeMinutes,
    );
  }

  const heureEnMinutes = BigInt(60);
  const taux = tauxHoraireMineur ?? BigInt(0);

  const mainDOeuvre = [...parTechnicien.entries()]
    .sort(([gauche], [droite]) => gauche.localeCompare(droite))
    .map(([technicienId, minutesReelles]) => {
      const minutesFacturees = auQuartDHeureSuperieur(minutesReelles);
      return {
        technicienId,
        minutesReelles,
        minutesFacturees,
        // Arithmétique ENTIÈRE : le montant est un produit de bigints divisé
        // par soixante, arrondi commercialement à l'unité mineure. Aucun
        // flottant n'y entre — `0.1 + 0.2` ne vaut pas `0.3`, et un montant
        // n'a pas le droit de s'en apercevoir.
        montant: montant(
          arrondirAuPlusProche(BigInt(minutesFacturees) * taux, heureEnMinutes),
          devise,
        ),
      };
    });

  const totalMainDOeuvre = mainDOeuvre.reduce(
    (somme, ligne) => additionner(somme, ligne.montant),
    zero(devise),
  );
  const totalForfaits = forfaits.reduce(
    (somme, forfait) => additionner(somme, forfait.montant),
    zero(devise),
  );

  return {
    minutesReellesTotales,
    minutesTrajet,
    minutesNonFacturables,
    mainDOeuvre,
    totalMainDOeuvre,
    forfaits,
    totalForfaits,
    totalHt: additionner(totalMainDOeuvre, totalForfaits),
  };
}
