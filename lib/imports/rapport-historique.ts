import { type ParcsDImport, preparerUneReprise } from "./modeles";
import { type MotifNonRattachee } from "./reprise";

/**
 * LES COMPTES PAR RANG D'UN LOT D'HISTORIQUE — ce que le rapport montre en plus
 * des six décomptes (REPRISE-HISTORIQUE ; D127, I6).
 *
 * ## Pourquoi ils ne sont pas en base, et pourquoi ce n'est pas une divergence
 *
 * `import_lot` porte six décomptes, tous DÉRIVÉS de l'action des lignes
 * (`proposerDepuisLesLignes`) ; le rattachement d'une machine n'est pas une
 * action — une ligne non rattachée ENTRE, c'est tout le point (72 % mesurés)
 * —, et `import_lot_ligne` ne porte aucune colonne pour le rang. Le compter
 * demande de résoudre chaque ligne contre le parc, **par la fonction même que
 * l'application appellera** : `preparerUneReprise`, jamais une seconde
 * lecture (§9, 01/09). *C'est ce que l'annulation fait déjà pour reconstituer
 * ce qu'un lot a écrit.*
 *
 * Ce que cela a de moins qu'une colonne, écrit plutôt que tu : le parc peut
 * avoir bougé entre le contrôle et la lecture du rapport, et les comptes
 * suivent le parc du moment — exactement comme l'application, qui résout au
 * moment d'écrire. *Un rapport qui figerait un rang que l'application ne
 * suivrait plus mentirait dans l'autre sens.*
 *
 * ## Le témoin
 *
 * `sansSerie + rang1 + rang2 + nonRattachees.length` vaut le nombre de
 * lignes qui ENTRERONT (action `creation` dont la préparation passe) : une
 * ligne qui entrerait sans être comptée ici serait une machine rattachée ou
 * non sans que personne le sache.
 */
export type LigneNonRattachee = {
  readonly rang: number;
  readonly serie: string;
  readonly motif: MotifNonRattachee;
};

export type ComptesParRang = {
  /** Sans n° de série : ni rang ni motif — une intervention sur aucun matériel. */
  readonly sansSerie: number;
  readonly rang1: number;
  readonly rang2: number;
  /** Le rang 3, ligne à ligne, avec ce qu'elle portait et pourquoi. */
  readonly nonRattachees: readonly LigneNonRattachee[];
};

export function decompterLesRattachements(
  lignes: readonly {
    readonly rang: number;
    readonly action: string;
    readonly valeurs: Readonly<Record<string, string | undefined>>;
  }[],
  parcs: ParcsDImport,
): ComptesParRang {
  let sansSerie = 0;
  let rang1 = 0;
  let rang2 = 0;
  const nonRattachees: LigneNonRattachee[] = [];
  for (const ligne of lignes) {
    // Seules les lignes qui ENTRERONT comptent : un rejet n'a pas de machine
    // à rattacher, il n'a pas de fiche.
    if (ligne.action !== "creation") continue;
    const prepare = preparerUneReprise(parcs, ligne.valeurs);
    if (!prepare.prete) continue;
    const r = prepare.rattachement;
    if (r.rang === 3) {
      nonRattachees.push({ rang: ligne.rang, serie: r.serie, motif: r.motif });
    } else if (r.rang === "sans_serie") {
      sansSerie += 1;
    } else if (r.rang === 1) {
      rang1 += 1;
    } else {
      rang2 += 1;
    }
  }
  return { sansSerie, rang1, rang2, nonRattachees };
}
