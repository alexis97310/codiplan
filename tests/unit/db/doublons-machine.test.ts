import { describe, expect, it } from "vitest";

import {
  PREFIXE_RATTACHEMENT_SEED,
  planDeNettoyage,
  rapportDoublons,
  totalARetirer,
  type LigneRattachement,
} from "../../../scripts/lib/doublons-machine";

/**
 * LE RATTRAPAGE D'UNE INTERVENTION À DEUX MACHINES (P3009) — logique pure.
 *
 * Les identifiants fabriqués suivent le format réel de `identifiantParc`
 * (`prisma/seed-data.ts`) : le suffixe de douze chiffres croît avec
 * `rangRattachement`, donc avec l'ordre de pose du semis.
 */

function ligne(
  suffixe: string,
  intervention_id: string,
  societe_id = "societe-1",
  machine_id = `machine-${suffixe}`,
): LigneRattachement {
  return {
    id: `${PREFIXE_RATTACHEMENT_SEED}${suffixe}`,
    societe_id,
    intervention_id,
    machine_id,
  };
}

describe("planDeNettoyage", () => {
  it("rend « aucun doublon » quand chaque intervention a au plus une machine", () => {
    const plan = planDeNettoyage([
      ligne("000000000001", "intervention-1"),
      ligne("000000000002", "intervention-2"),
    ]);

    expect(plan).toEqual({ verdict: "aucun_doublon" });
    expect(totalARetirer(plan)).toBe(0);
    expect(rapportDoublons(plan)).toContain("Aucun doublon");
  });

  it("rend une liste vide : zéro ligne observée n'est pas un doublon", () => {
    expect(planDeNettoyage([])).toEqual({ verdict: "aucun_doublon" });
  });

  it("garde le plus petit identifiant d'un doublon, retire l'autre", () => {
    const petite = ligne("000000000017", "intervention-17");
    const grande = ligne("000000000023", "intervention-17");

    const plan = planDeNettoyage([grande, petite]);

    expect(plan).toEqual({
      verdict: "plan",
      groupes: [
        {
          intervention_id: "intervention-17",
          gardee: petite,
          retirees: [grande],
        },
      ],
    });
    expect(totalARetirer(plan)).toBe(1);
  });

  it("traite deux interventions en doublon, chacune avec sa propre ligne gardée", () => {
    const g1Petite = ligne("000000000001", "intervention-a");
    const g1Grande = ligne("000000000002", "intervention-a");
    const g2Petite = ligne("000000000003", "intervention-b");
    const g2Grande = ligne("000000000004", "intervention-b");

    const plan = planDeNettoyage([g1Grande, g2Grande, g1Petite, g2Petite]);

    expect(plan).toEqual({
      verdict: "plan",
      groupes: [
        {
          intervention_id: "intervention-a",
          gardee: g1Petite,
          retirees: [g1Grande],
        },
        {
          intervention_id: "intervention-b",
          gardee: g2Petite,
          retirees: [g2Grande],
        },
      ],
    });
    expect(totalARetirer(plan)).toBe(2);
  });

  it("garde une seule ligne et retire les deux autres quand une intervention porte trois lignes", () => {
    const petite = ligne("000000000001", "intervention-1");
    const moyenne = ligne("000000000002", "intervention-1");
    const grande = ligne("000000000003", "intervention-1");

    const plan = planDeNettoyage([grande, petite, moyenne]);

    expect(plan).toEqual({
      verdict: "plan",
      groupes: [
        {
          intervention_id: "intervention-1",
          gardee: petite,
          retirees: [moyenne, grande],
        },
      ],
    });
    expect(totalARetirer(plan)).toBe(2);
  });

  it("refuse si une ligne en doublon ne porte pas un identifiant du semis", () => {
    const duSeed = ligne("000000000001", "intervention-1");
    const horsSemis: LigneRattachement = {
      id: "11111111-1111-1111-1111-111111111111",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere",
    };

    const plan = planDeNettoyage([duSeed, horsSemis]);

    expect(plan).toEqual({ verdict: "hors_semis", ligne: horsSemis });
    expect(totalARetirer(plan)).toBe(0);
    expect(rapportDoublons(plan)).toContain("REFUS");
  });

  it("n'est pas perturbé par une ligne hors semis sur une intervention SANS doublon", () => {
    // Le refus ne porte que sur les lignes effectivement EN DOUBLE — une
    // ligne seule, même hors du préfixe connu, n'est pas de son ressort.
    const seule: LigneRattachement = {
      id: "11111111-1111-1111-1111-111111111111",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere",
    };

    expect(planDeNettoyage([seule])).toEqual({ verdict: "aucun_doublon" });
  });
});

describe("rapportDoublons", () => {
  it("nomme l'intervention, la ligne gardée, les lignes retirées et le total", () => {
    const petite = ligne("000000000017", "intervention-17");
    const grande = ligne("000000000023", "intervention-17");
    const plan = planDeNettoyage([grande, petite]);

    const rapport = rapportDoublons(plan);

    expect(rapport).toContain("intervention-17");
    expect(rapport).toContain(petite.id);
    expect(rapport).toContain(grande.id);
    expect(rapport).toContain("Total à retirer : 1 ligne(s).");
  });
});
