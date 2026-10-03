import { describe, expect, it } from "vitest";

import { fragmentDuClientDuTechnicien } from "@/lib/interventions/perimetre-technicien";

/**
 * LE CLIENT DU TECHNICIEN (QT-2, D152 ; relecture de 9DG, R1, 04/10/2026) —
 * LA PART PURE.
 *
 * Avant R1, ce fragment portait une branche « toute intervention non
 * annulée, sans borne de date » — plus large que la fenêtre de sept jours
 * qui gouverne le PARC (`fragmentDuParcDuTechnicien`) : un technicien pouvait
 * choisir, pour créer une machine, un client dont il ne verrait ensuite pas
 * la machine créée. Ce fichier éprouve que le fragment est désormais la
 * MÊME fenêtre, et rien de plus — même bornes que
 * `tests/unit/interventions/parc-du-technicien.test.ts`.
 */

const TECHNICIEN_ID = "aaaaaaaa-0000-7000-8000-000000000001";
const DEBUT_DU_JOUR = new Date("2026-10-05T00:00:00.000Z");

describe("fragmentDuClientDuTechnicien — aligné sur la seule fenêtre du parc (R1)", () => {
  it("ne porte aucune branche « sans borne de date » — une seule condition, la fenêtre", () => {
    const fragment = fragmentDuClientDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    expect(fragment).not.toHaveProperty("OR");
    expect(fragment.interventions?.some).toBeDefined();
  });

  it("la fenêtre s'ouvre à J (aujourd'hui), incluse", () => {
    const fragment = fragmentDuClientDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const some = fragment.interventions?.some as {
      date_planifiee: { gte: Date; lt: Date };
    };
    expect(some.date_planifiee.gte).toEqual(DEBUT_DU_JOUR);
  });

  it("la fenêtre se ferme à J+7, EXCLU — même borne que le parc", () => {
    const fragment = fragmentDuClientDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const some = fragment.interventions?.some as {
      date_planifiee: { gte: Date; lt: Date };
    };
    const jPlus7 = new Date(DEBUT_DU_JOUR.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(some.date_planifiee.lt).toEqual(jPlus7);
  });

  it("exclut les interventions annulées ET clôturées — même liste que le parc", () => {
    const fragment = fragmentDuClientDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const some = fragment.interventions?.some as {
      statut: { notIn: string[] };
    };
    expect(some.statut.notIn).toEqual(["annulee", "cloturee"]);
  });

  it("porte bien l'identité du technicien, et de lui seul", () => {
    const fragment = fragmentDuClientDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const some = fragment.interventions?.some as {
      technicien_id: string;
    };
    expect(some.technicien_id).toBe(TECHNICIEN_ID);
  });
});
