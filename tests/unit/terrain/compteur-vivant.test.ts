import { describe, expect, it } from "vitest";

import {
  decalageHorloge,
  secondesEcoulees,
} from "@/lib/terrain/compteur-vivant";

/**
 * LE CALCUL DU COMPTEUR QUI DÉFILE (9F4H5-TERRAIN-VIVANT, point 1) — LA PART
 * PURE, éprouvée sans navigateur (D-13).
 */
describe("decalageHorloge", () => {
  it("est nul quand aucune heure serveur n'est connue (hors réseau)", () => {
    expect(decalageHorloge(null, new Date("2026-10-20T01:00:00.000Z"))).toBe(0);
  });

  it("mesure l'écart, en millisecondes, entre le serveur et l'appareil", () => {
    const serveur = new Date("2026-10-20T01:00:10.000Z");
    const appareil = new Date("2026-10-20T01:00:00.000Z");
    expect(decalageHorloge(serveur, appareil)).toBe(10_000);
  });

  it("l'écart est négatif quand l'appareil est EN AVANCE sur le serveur", () => {
    const serveur = new Date("2026-10-20T01:00:00.000Z");
    const appareil = new Date("2026-10-20T01:00:10.000Z");
    expect(decalageHorloge(serveur, appareil)).toBe(-10_000);
  });
});

describe("secondesEcoulees", () => {
  const depart = new Date("2026-10-20T01:00:00.000Z");

  it("additionne les minutes déjà fermées et l'écoulé du segment en cours", () => {
    const total = secondesEcoulees({
      depart,
      minutesFermees: 10,
      decalageHorlogeMs: 0,
      maintenant: new Date("2026-10-20T01:00:30.000Z"),
    });
    expect(total).toBe(10 * 60 + 30);
  });

  it("corrige l'horloge de l'appareil EN RETARD sur le serveur", () => {
    // Le serveur était à 01:00:40 quand l'appareil disait 01:00:30 : il
    // retarde de 10 s, et le décalage les rajoute.
    const total = secondesEcoulees({
      depart,
      minutesFermees: 0,
      decalageHorlogeMs: 10_000,
      maintenant: new Date("2026-10-20T01:00:30.000Z"),
    });
    expect(total).toBe(40);
  });

  it("corrige l'horloge de l'appareil EN AVANCE sur le serveur", () => {
    const total = secondesEcoulees({
      depart,
      minutesFermees: 0,
      decalageHorlogeMs: -10_000,
      maintenant: new Date("2026-10-20T01:00:30.000Z"),
    });
    expect(total).toBe(20);
  });

  it("n'est jamais négative, même si l'appareil recule sous le départ", () => {
    const total = secondesEcoulees({
      depart,
      minutesFermees: 0,
      decalageHorlogeMs: 0,
      maintenant: new Date("2026-10-20T00:59:00.000Z"),
    });
    expect(total).toBe(0);
  });
});
