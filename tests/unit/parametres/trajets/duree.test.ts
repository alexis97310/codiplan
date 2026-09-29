import { describe, expect, it } from "vitest";

import { duree } from "@/app/(back-office)/parametres/trajets/presentation";

/**
 * « 30 min (30 minutes) » (PA-24, audit du 28/09/2026) — sous l'heure, la
 * durée en minutes et son décompte disaient deux fois la même chose. La
 * parenthèse n'a de sens que pour convertir une durée en heures ; sous
 * l'heure, `enDuree` EST déjà la durée en minutes.
 */
describe("duree", () => {
  it("sous l'heure : aucune parenthèse, une seule fois « min »", () => {
    expect(duree(30)).toBe("30 min");
  });

  it("59 minutes : toujours aucune parenthèse", () => {
    expect(duree(59)).toBe("59 min");
  });

  it("à partir de l'heure : les deux formes, comme avant", () => {
    expect(duree(90)).toBe("1 h 30 (90 minutes)");
  });

  it("240 minutes (Côte Est) : inchangé", () => {
    expect(duree(240)).toBe("4 h 00 (240 minutes)");
  });
});
