import { cleJour, comparerJours, type JourLocal } from "./fuseau";

/**
 * L'horizon des jours fériés (ticket L0-08 ; D46, complément 3).
 *
 * **Le défaut que ce module prévient, et que personne n'avait soulevé.** Les
 * jours fériés sont datés. Une table alimentée aujourd'hui cessera
 * silencieusement de connaître les fériés dans deux ans : le planning
 * proposera des créneaux un 1ᵉʳ mai sans rien signaler, les engagements de
 * service compteront des heures ouvrées qui n'existent pas, et les indicateurs
 * « à jours ouvrés constants » compareront deux années qui ne le sont plus.
 *
 * **Aucun test ordinaire ne le verra.** La table ne sera pas vide — elle sera
 * PÉRIMÉE. Un décompte non nul ressemble beaucoup trop à des données justes
 * pour qu'on s'en contente. C'est le principe des gardiens du lot 0 appliqué au
 * temps : une donnée qui se périme en silence vaut une liste close que personne
 * ne surveille (CLAUDE.md §9).
 *
 * Ce module ne touche pas la base : il porte la comparaison. Il est partagé par
 * `scripts/horizon-feries.mts`, qui l'exécute contre une base à chaque
 * `verify:full`, et par les scénarios unitaires, qui l'exécutent contre le jeu
 * de démonstration.
 */

/**
 * Avance minimale exigée. Douze mois : c'est la durée d'un cycle d'échéances
 * préventives (RG-CON-01, où les échéances sont générées sur toute la durée du
 * contrat) et celle d'une comparaison N/N-1. En deçà, un planning peut être posé
 * au-delà de ce que la table connaît.
 */
export const MOIS_D_AVANCE_EXIGES = 12;

/** L'état de l'horizon pour UN territoire. */
export type EtatHorizon = {
  /** Code ISO 3166-1 alpha-2. */
  territoire: string;
  /**
   * Jour local de référence : le plus avancé parmi les agences du territoire.
   * Les agences d'un même territoire peuvent relever de fuseaux différents, et
   * c'est celle qui est déjà le plus loin dans l'année qui fixe l'exigence.
   */
  aujourdhui: JourLocal;
  /** Dernier férié connu du territoire, ou `null` s'il n'en a aucun. */
  dernier: JourLocal | null;
  /** Nombre d'agences rattachées — sert au message, jamais à la règle. */
  agences: number;
};

/**
 * Le jour situé `mois` mois plus tard, quantième conservé quand il existe.
 *
 * Le 31 janvier plus un mois donne le 28 ou le 29 février : `Date` déborderait
 * sur mars, ce qui rendrait l'exigence plus stricte un mois sur douze sans que
 * personne comprenne pourquoi. Le quantième est donc ramené au dernier jour du
 * mois d'arrivée.
 */
export function jourDansNMois(jour: JourLocal, mois: number): JourLocal {
  const total = (jour.annee * 12 + (jour.mois - 1) + mois) | 0;
  const annee = Math.floor(total / 12);
  const moisArrivee = (total % 12) + 1;

  const dernierDuMois = new Date(0);
  dernierDuMois.setUTCFullYear(annee, moisArrivee, 0);

  return {
    annee,
    mois: moisArrivee,
    jour: Math.min(jour.jour, dernierDuMois.getUTCDate()),
  };
}

/** Le jour à partir duquel l'horizon d'un territoire est jugé suffisant. */
export function jourExige(etat: EtatHorizon): JourLocal {
  return jourDansNMois(etat.aujourdhui, MOIS_D_AVANCE_EXIGES);
}

/** L'horizon de ce territoire couvre-t-il les douze mois exigés ? */
export function horizonSuffisant(etat: EtatHorizon): boolean {
  return (
    etat.dernier !== null && comparerJours(etat.dernier, jourExige(etat)) >= 0
  );
}

/**
 * Écarts d'horizon — une ligne par territoire à court d'avance.
 *
 * **Le message nomme le territoire et la dernière date connue**, comme le
 * complément 3 de D46 l'exige : un contrôle qui dirait seulement « horizon
 * insuffisant » obligerait à rouvrir la base pour savoir quoi corriger.
 */
export function ecartsHorizon(etats: readonly EtatHorizon[]): string[] {
  const ecarts: string[] = [];

  if (etats.length === 0) {
    ecarts.push(
      "Aucun territoire n'est rattaché à une agence : le contrôle d'horizon " +
        "n'a rien prouvé. Une base vide produit le même silence qu'une base " +
        "à jour — et ce n'est pas la même chose.",
    );
  }

  for (const etat of etats) {
    if (horizonSuffisant(etat)) {
      continue;
    }

    const exige = cleJour(jourExige(etat));
    const agences = `${etat.agences} agence(s)`;

    ecarts.push(
      etat.dernier === null
        ? `Territoire « ${etat.territoire} » (${agences}) : AUCUN jour férié ` +
            `en base. Il en faut au moins jusqu'au ${exige}. ` +
            "Étendre l'horizon : `pnpm feries:etendre`."
        : `Territoire « ${etat.territoire} » (${agences}) : dernier jour férié ` +
            `connu le ${cleJour(etat.dernier)}, alors qu'il en faut jusqu'au ` +
            `${exige} (${MOIS_D_AVANCE_EXIGES} mois d'avance). La table n'est ` +
            "pas vide, elle est PÉRIMÉE — le planning proposerait des créneaux " +
            "un jour férié sans rien signaler. " +
            "Étendre l'horizon : `pnpm feries:etendre`.",
    );
  }

  return ecarts;
}

/**
 * Écarts de paramétrage : les agences qui ne déclarent aucun territoire.
 *
 * C'est le pendant de la colonne `agence.territoire` nullable (D46,
 * complément 1) : il n'existe aucun territoire par défaut, une agence peut donc
 * rester sans, et rien dans la base ne l'en empêche. Ce contrôle est ce qui fait
 * que cela ne dure pas — il la nomme à chaque `verify:full`.
 */
export function ecartsTerritoireManquant(
  agencesSansTerritoire: readonly { code: string; societe: string }[],
): string[] {
  return agencesSansTerritoire.map(
    (agence) =>
      `Agence « ${agence.code} » (société ${agence.societe}) ne déclare aucun ` +
      "territoire : elle n'a donc aucun jour férié, et son calendrier ne peut " +
      "pas être chargé. Le territoire est un code ISO 3166-1 alpha-2, " +
      "indépendant du fuseau (D46).",
  );
}
