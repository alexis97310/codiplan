import { describe, expect, it } from "vitest";

import { teinteDeChargeDuJour } from "@/app/(back-office)/planning/carte";
import {
  TAUX_PLEIN,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";

/**
 * 9CI-PG-G12-DEUX-SEMAINES-MOIS, PARTIE 2 (PG-D3-MOIS-CHARGE).
 *
 * LA TEINTE DE LA CASE DU MOIS — une fraction dans [0, 1] (l'opacité du calque
 * de couleur), jamais le taux lui-même : `barreChargeDuJour` (juste au-dessus,
 * dans le même fichier) reste la SEULE écriture de la largeur en pourcent de
 * la barre du jour de la Semaine ; celle-ci en est la SŒUR pour la case du
 * Mois, qui lit `tauxCompact` de la même façon (jamais `tauxOccupation` nu,
 * gardien `tests/unit/interventions/occupation-affichee.test.ts`).
 *
 * Spécification §3.8 : « le seul seuil qui existe (`TAUX_PLEIN`) — aucun
 * palier inventé » (les 0,1 / 0,8 / 55 % de la maquette du planning GMAO ne
 * sont PAS repris, D145).
 */
function occupation(
  minutesEngagees: number,
  minutesOuvrables: number,
  sansDuree = 0,
): OccupationTechnicien {
  return {
    technicienId: "t",
    interventions: 1,
    minutesEngagees,
    minutesOuvrables,
    sansDuree,
    trajet: { minutes: 0, journees: 0, journeesSansTrajet: 0 },
    segments: [],
  };
}

describe("teinteDeChargeDuJour", () => {
  it("sans calendrier connu (minutesOuvrables nulles) : null, rien à comparer", () => {
    expect(teinteDeChargeDuJour(occupation(0, 0))).toBeNull();
  });

  it("0 % : fraction 0", () => {
    expect(teinteDeChargeDuJour(occupation(0, 100))?.fraction).toBe(0);
  });

  it("« infime » (arrondi à zéro mais non nul, D56) : fraction 0 aussi", () => {
    expect(teinteDeChargeDuJour(occupation(1, 100_000))?.fraction).toBe(0);
  });

  it("50 % : fraction 0,5", () => {
    expect(teinteDeChargeDuJour(occupation(50, 100))?.fraction).toBe(0.5);
  });

  it("100 % : fraction 1, jamais dépassé", () => {
    const teinte = teinteDeChargeDuJour(occupation(100, 100));
    expect(teinte?.fraction).toBe(1);
    expect(teinte?.depasse).toBe(false);
  });

  it(`au-delà de ${TAUX_PLEIN} % : depasse vrai, fraction plafonnée à 1`, () => {
    const teinte = teinteDeChargeDuJour(occupation(130, 100));
    expect(teinte?.depasse).toBe(true);
    expect(teinte?.fraction).toBe(1);
    // La valeur EXACTE du taux n'est jamais plafonnée dans l'infobulle.
    expect(teinte?.infobulle).toContain("130");
  });

  it("une durée manquante (sansDuree > 0) : auMoins vrai", () => {
    const teinte = teinteDeChargeDuJour(occupation(50, 100, 1));
    expect(teinte?.auMoins).toBe(true);
  });

  it("aucune durée manquante : auMoins faux", () => {
    const teinte = teinteDeChargeDuJour(occupation(50, 100, 0));
    expect(teinte?.auMoins).toBe(false);
  });

  it("la fraction reste TOUJOURS dans [0, 1]", () => {
    for (const [engagees, ouvrables] of [
      [0, 100],
      [50, 100],
      [100, 100],
      [500, 100],
    ]) {
      const fraction = teinteDeChargeDuJour(
        occupation(engagees, ouvrables),
      )?.fraction;
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });
});
