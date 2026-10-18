import { describe, expect, it } from "vitest";

import { schemaSaisieDifferee } from "@/lib/interventions/saisie-differee";

/**
 * 9F4H2A-REJEU-SANS-DOUBLON, point 5 — `instant_appareil` n'accepte qu'un
 * instant ISO 8601 PORTANT UN DÉCALAGE EXPLICITE. Sans lui, `new Date(...)`
 * lirait la chaîne à l'heure LOCALE DU SERVEUR, jamais celle de l'appareil —
 * ce que D214 interdit.
 */
const OPERATION_ID = "01933b5e-0000-7000-8000-000000000001";

describe("schemaSaisieDifferee — instant_appareil exige un décalage", () => {
  it("accepte un instant avec Z", () => {
    const analyse = schemaSaisieDifferee.safeParse({
      instant_appareil: "2026-09-14T08:00:00.000Z",
      operation_id: OPERATION_ID,
    });
    expect(analyse.success).toBe(true);
  });

  it("accepte un instant avec un décalage +hh:mm (fuseau de Nouméa)", () => {
    const analyse = schemaSaisieDifferee.safeParse({
      instant_appareil: "2026-09-14T19:00:00+11:00",
      operation_id: OPERATION_ID,
    });
    expect(analyse.success).toBe(true);
  });

  it("refuse un instant SANS décalage — ambigu, lu à l'heure du serveur", () => {
    const analyse = schemaSaisieDifferee.safeParse({
      instant_appareil: "2026-09-14T08:00:00",
      operation_id: OPERATION_ID,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse une date seule, sans heure ni décalage", () => {
    const analyse = schemaSaisieDifferee.safeParse({
      instant_appareil: "2026-09-14",
      operation_id: OPERATION_ID,
    });
    expect(analyse.success).toBe(false);
  });
});
