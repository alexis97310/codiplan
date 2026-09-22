import { estEnAttenteDeRattachement, type MotifAttente } from "./vgp";

/**
 * LES COMPTES DE RATTACHEMENT D'UN LOT DE VGP — ce que le rapport montre en
 * plus des six décomptes (VGP-IMPORT ; arbitrage 3 du 22/09/2026, I6).
 *
 * ## Pourquoi ils se lisent SUR LES LIGNES, sans aucun parc
 *
 * Un PV sans machine est retenu au contrôle sous l'un des quatre motifs de
 * `MOTIFS_ATTENTE` — c'est la seule représentation que la base admette sans
 * migration, et son coût est écrit là-bas. Le motif est POSÉ sur la ligne
 * (`rejet_motif`) : le rapport n'a donc rien à résoudre contre le parc, il
 * lit ce que le contrôle a décidé. *C'est la différence avec l'historique*,
 * dont le rang de rattachement n'est pas une action et se reconstitue.
 *
 * ## Le témoin
 *
 * `rattachees + enAttente.length + autresRejets` explique chaque ligne de
 * DONNÉES (créations et rejets) ; gabarits et vides ne rattachent rien.
 */
export type LigneEnAttente = {
  readonly rang: number;
  /** Ce que la cellule portait — la non-valeur elle-même quand c'en est une. */
  readonly serie: string;
  readonly motif: MotifAttente;
};

export type ComptesDeRattachementVgp = {
  /** Les PV qui entreront, chacun sous sa machine. */
  readonly rattachees: number;
  /** Les PV EN ATTENTE, ligne à ligne, avec ce qu'ils portaient et pourquoi. */
  readonly enAttente: readonly LigneEnAttente[];
  /** Les vrais rejets — une date illisible, une origine inconnue, une saisie refusée. */
  readonly autresRejets: number;
};

export function decompterLesRattachementsVgp(
  lignes: readonly {
    readonly rang: number;
    readonly action: string;
    readonly rejetMotif?: string | null;
    readonly valeurs: Readonly<Record<string, string | undefined>>;
  }[],
  colonneSerie: string,
): ComptesDeRattachementVgp {
  let rattachees = 0;
  let autresRejets = 0;
  const enAttente: LigneEnAttente[] = [];
  for (const ligne of lignes) {
    if (ligne.action === "creation") {
      rattachees += 1;
      continue;
    }
    if (ligne.action !== "rejet") continue;
    if (estEnAttenteDeRattachement(ligne.rejetMotif)) {
      enAttente.push({
        rang: ligne.rang,
        serie: ligne.valeurs[colonneSerie]?.trim() ?? "",
        motif: ligne.rejetMotif,
      });
    } else {
      autresRejets += 1;
    }
  }
  return { rattachees, enAttente, autresRejets };
}
