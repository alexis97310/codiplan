import { describe, expect, it } from "vitest";

import { fragmentDuParcDuTechnicien } from "@/lib/interventions/perimetre-technicien";

/**
 * LE PARC DU TECHNICIEN (QT-2, D152) — LA PART PURE.
 *
 * `fragmentDuParcDuTechnicien` construit un fragment `where` Prisma, jamais
 * interrogé ici : la fenêtre de sept jours et l'exclusion des statuts sont
 * des VALEURS dans l'objet rendu, et ce test les lit comme des données,
 * exactement comme `criteresSansDureeAVenir` (`lib/interventions/depot.ts`)
 * n'est pas éprouvée ici mais sous la vraie table (R3-12) — la différence
 * étant que CETTE fonction est exportée et appelée par plusieurs lecteurs
 * (`lib/machines/depot.ts`, `lib/vgp/registre.ts`), donc atteinte, donc
 * testable pour elle-même sans refaire ce que l'isolation éprouve déjà.
 */

const TECHNICIEN_ID = "aaaaaaaa-0000-7000-8000-000000000001";
const DEBUT_DU_JOUR = new Date("2026-10-05T00:00:00.000Z");

describe("fragmentDuParcDuTechnicien — les bornes de la fenêtre", () => {
  it("la fenêtre s'ouvre à J (aujourd'hui), incluse", () => {
    const fragment = fragmentDuParcDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const clientBranche = fragment.OR?.[1] as {
      client: {
        interventions: {
          some: { date_planifiee: { gte: Date; lt: Date } };
        };
      };
    };
    expect(clientBranche.client.interventions.some.date_planifiee.gte).toEqual(
      DEBUT_DU_JOUR,
    );
  });

  it("la fenêtre se ferme à J+7, EXCLU — J+6 est donc la dernière journée couverte", () => {
    const fragment = fragmentDuParcDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const clientBranche = fragment.OR?.[1] as {
      client: {
        interventions: {
          some: { date_planifiee: { gte: Date; lt: Date } };
        };
      };
    };
    const fin = clientBranche.client.interventions.some.date_planifiee.lt;
    const jPlus6 = new Date(DEBUT_DU_JOUR.getTime() + 6 * 24 * 60 * 60 * 1000);
    const jPlus7 = new Date(DEBUT_DU_JOUR.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(fin).toEqual(jPlus7);
    expect(jPlus6.getTime() < fin.getTime()).toBe(true);
    expect(jPlus7.getTime() < fin.getTime()).toBe(false);
  });

  it("la branche « clients visités » exclut les interventions annulées ET clôturées", () => {
    const fragment = fragmentDuParcDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const clientBranche = fragment.OR?.[1] as {
      client: { interventions: { some: { statut: { notIn: string[] } } } };
    };
    expect(clientBranche.client.interventions.some.statut.notIn).toEqual([
      "annulee",
      "cloturee",
    ]);
  });

  it("la branche « ses propres interventions » exclut seulement les annulées, sans borne de date", () => {
    const fragment = fragmentDuParcDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const propresBranche = fragment.OR?.[0] as {
      intervention_machines: {
        some: { intervention: { statut: { not: string } } };
      };
    };
    expect(
      propresBranche.intervention_machines.some.intervention.statut,
    ).toEqual({ not: "annulee" });
  });

  it("les deux branches portent bien l'identité du technicien, et de lui seul", () => {
    const fragment = fragmentDuParcDuTechnicien(TECHNICIEN_ID, DEBUT_DU_JOUR);
    const propresBranche = fragment.OR?.[0] as {
      intervention_machines: {
        some: { intervention: { technicien_id: string } };
      };
    };
    const clientBranche = fragment.OR?.[1] as {
      client: { interventions: { some: { technicien_id: string } } };
    };
    expect(
      propresBranche.intervention_machines.some.intervention.technicien_id,
    ).toBe(TECHNICIEN_ID);
    expect(clientBranche.client.interventions.some.technicien_id).toBe(
      TECHNICIEN_ID,
    );
  });
});
