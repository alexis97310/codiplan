import { describe, expect, it } from "vitest";

import { estUuid } from "@/lib/identifiant";

/**
 * `estUuid` (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — déplacée depuis
 * `app/api/contacts/saisie-recue.ts`, qui la réexporte désormais plutôt que
 * de la redéfinir : les fiches [id] du back-office en ont besoin elles aussi,
 * pour refuser un identifiant mal formé avant qu'il n'atteigne la base
 * (D35, D50 : un identifiant mal formé et un identifiant inexistant rendent
 * la même chose).
 */
describe("estUuid", () => {
  it("un uuid v7 bien formé est valide", () => {
    expect(estUuid("01a0e2e0-0000-7000-8000-000000000001")).toBe(true);
  });

  it("les majuscules restent un uuid valide", () => {
    expect(estUuid("01A0E2E0-0000-7000-8000-000000000001")).toBe(true);
  });

  it("une chaîne vide est refusée", () => {
    expect(estUuid("")).toBe(false);
  });

  it("une chaîne quelconque est refusée", () => {
    expect(estUuid("abc")).toBe(false);
  });

  it("un segment d'écran réel, mais pas un uuid, est refusé", () => {
    expect(estUuid("a-facturer")).toBe(false);
  });
});
