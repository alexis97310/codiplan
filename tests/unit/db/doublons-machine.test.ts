import { describe, expect, it } from "vitest";

import {
  PREFIXE_INTERVENTION_SEED,
  PREFIXE_RATTACHEMENT_SEED,
  planDeNettoyage,
  rapportDoublons,
  totalARetirer,
  type LigneRattachement,
} from "../../../scripts/lib/doublons-machine";
import { SOCIETES_DU_SEED } from "../../../scripts/lib/donnees-hors-seed";

/**
 * LE RATTRAPAGE D'UNE INTERVENTION À DEUX MACHINES (P3009) — logique pure.
 *
 * Les identifiants fabriqués suivent le format réel de `identifiantParc`
 * (`prisma/seed-data.ts`) : le suffixe de douze chiffres croît avec
 * `rangRattachement`, donc avec l'ordre de pose du semis.
 *
 * `cree_le` n'est utile qu'au cas du 24/10/2026 (ci-dessous) : les autres
 * tests lui donnent la même date fixe, qui ne départage jamais rien dans
 * leur branche.
 */
const CREE_LE_INDIFFERENT = new Date("2026-01-01T00:00:00Z");

function ligne(
  suffixe: string,
  intervention_id: string,
  societe_id = "societe-1",
  machine_id = `machine-${suffixe}`,
  cree_le: Date = CREE_LE_INDIFFERENT,
): LigneRattachement {
  return {
    id: `${PREFIXE_RATTACHEMENT_SEED}${suffixe}`,
    societe_id,
    intervention_id,
    machine_id,
    cree_le,
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

  it("garde la ligne du semis et retire la ligne posée à la main (décision du 03/10/2026)", () => {
    // État mesuré en démonstration (c34c6a8) : une intervention porte la
    // ligne posée par le semis ET une ligne posée à la main par l'application
    // (`lib/interventions/depot.ts`) — on garde celle du semis, on retire
    // l'autre, quel que soit son identifiant.
    const duSemis = ligne("000000000001", "intervention-1");
    const poseeAMain: LigneRattachement = {
      id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere",
      cree_le: CREE_LE_INDIFFERENT,
    };

    const plan = planDeNettoyage([poseeAMain, duSemis]);

    expect(plan).toEqual({
      verdict: "plan",
      groupes: [
        {
          intervention_id: "intervention-1",
          gardee: duSemis,
          retirees: [poseeAMain],
        },
      ],
    });
    expect(totalARetirer(plan)).toBe(1);
    expect(rapportDoublons(plan)).toContain(
      "posée hors du semis — retirée, décision du 03/10/2026",
    );
  });

  it("garde la plus petite ligne du semis et retire les deux autres quand deux lignes du semis et une posée à la main se disputent une même intervention", () => {
    const semisPetite = ligne("000000000001", "intervention-1");
    const semisGrande = ligne("000000000002", "intervention-1");
    const poseeAMain: LigneRattachement = {
      id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere",
      cree_le: CREE_LE_INDIFFERENT,
    };

    const plan = planDeNettoyage([poseeAMain, semisGrande, semisPetite]);

    expect(plan).toEqual({
      verdict: "plan",
      groupes: [
        {
          intervention_id: "intervention-1",
          gardee: semisPetite,
          retirees: [semisGrande, poseeAMain].sort((a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
          ),
        },
      ],
    });
    expect(totalARetirer(plan)).toBe(2);
  });

  it("refuse si AUCUNE ligne du groupe n'est du semis (la décision du 03/10/2026 ne couvre pas ce cas)", () => {
    const horsSemisA: LigneRattachement = {
      id: "11111111-1111-1111-1111-111111111111",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere-a",
      cree_le: CREE_LE_INDIFFERENT,
    };
    const horsSemisB: LigneRattachement = {
      id: "22222222-2222-2222-2222-222222222222",
      societe_id: "societe-1",
      intervention_id: "intervention-1",
      machine_id: "machine-etrangere-b",
      cree_le: CREE_LE_INDIFFERENT,
    };

    const plan = planDeNettoyage([horsSemisB, horsSemisA]);

    expect(plan).toEqual({ verdict: "hors_semis", ligne: horsSemisA });
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
      cree_le: CREE_LE_INDIFFERENT,
    };

    expect(planDeNettoyage([seule])).toEqual({ verdict: "aucun_doublon" });
  });

  describe("le doublon sans aucune ligne du semis, mais sur une intervention du semis (24/10/2026)", () => {
    const SOCIETE_SEMIS = SOCIETES_DU_SEED[0];
    if (SOCIETE_SEMIS === undefined) {
      throw new Error("SOCIETES_DU_SEED est vide : rien à tester");
    }
    const INTERVENTION_SEMIS = `${PREFIXE_INTERVENTION_SEED}000000000001`;

    it("garde la première machine posée (par cree_le) et retire l'autre quand l'intervention et la société sont du jeu de démonstration", () => {
      const plusAncienne: LigneRattachement = {
        id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
        societe_id: SOCIETE_SEMIS,
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-1",
        cree_le: new Date("2026-10-01T08:00:00Z"),
      };
      const plusRecente: LigneRattachement = {
        id: "02b1d36f-816b-81ab-97bd-ae86861da2c2",
        societe_id: SOCIETE_SEMIS,
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-2",
        cree_le: new Date("2026-10-15T09:30:00Z"),
      };

      // Identifiant plus grand posé AVANT : seul `cree_le` doit décider ici,
      // jamais l'id — à la différence du cas du semis (03/10/2026).
      const plan = planDeNettoyage([plusRecente, plusAncienne]);

      expect(plan).toEqual({
        verdict: "plan",
        groupes: [
          {
            intervention_id: INTERVENTION_SEMIS,
            gardee: plusAncienne,
            retirees: [plusRecente],
          },
        ],
      });
      expect(totalARetirer(plan)).toBe(1);
      expect(rapportDoublons(plan)).toContain(
        "hors semis sur une intervention du semis — retirée, décision du 24/10/2026",
      );
    });

    it("départage par le plus petit id quand deux lignes portent la même date de pose", () => {
      const memeInstant = new Date("2026-10-01T08:00:00Z");
      const grandId: LigneRattachement = {
        id: "99999999-9999-4999-8999-999999999999",
        societe_id: SOCIETE_SEMIS,
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-1",
        cree_le: memeInstant,
      };
      const petitId: LigneRattachement = {
        id: "00000000-0000-4000-8000-000000000000",
        societe_id: SOCIETE_SEMIS,
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-2",
        cree_le: memeInstant,
      };

      const plan = planDeNettoyage([grandId, petitId]);

      expect(plan).toEqual({
        verdict: "plan",
        groupes: [
          {
            intervention_id: INTERVENTION_SEMIS,
            gardee: petitId,
            retirees: [grandId],
          },
        ],
      });
    });

    it("refuse quand la société n'est pas celle du jeu de démonstration, même si l'intervention en a le préfixe", () => {
      const a: LigneRattachement = {
        id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
        societe_id: "societe-etrangere",
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-1",
        cree_le: new Date("2026-10-01T08:00:00Z"),
      };
      const b: LigneRattachement = {
        id: "02b1d36f-816b-81ab-97bd-ae86861da2c2",
        societe_id: "societe-etrangere",
        intervention_id: INTERVENTION_SEMIS,
        machine_id: "machine-main-2",
        cree_le: new Date("2026-10-15T09:30:00Z"),
      };

      const plan = planDeNettoyage([b, a]);

      expect(plan).toEqual({ verdict: "hors_semis", ligne: a });
    });

    it("refuse quand l'intervention n'a pas le préfixe du semis, même si la société en est", () => {
      const a: LigneRattachement = {
        id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
        societe_id: SOCIETE_SEMIS,
        intervention_id: "intervention-etrangere",
        machine_id: "machine-main-1",
        cree_le: new Date("2026-10-01T08:00:00Z"),
      };
      const b: LigneRattachement = {
        id: "02b1d36f-816b-81ab-97bd-ae86861da2c2",
        societe_id: SOCIETE_SEMIS,
        intervention_id: "intervention-etrangere",
        machine_id: "machine-main-2",
        cree_le: new Date("2026-10-15T09:30:00Z"),
      };

      const plan = planDeNettoyage([b, a]);

      expect(plan).toEqual({ verdict: "hors_semis", ligne: a });
    });
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
