import { describe, expect, it } from "vitest";

import { instantAppareilCale } from "@/lib/terrain/heure-calee";

/**
 * `instantAppareilCale` (9F4H5A-HEURE-CALEE-SERVEUR, point 1) — la part
 * pure : étant donné l'écart mesuré une fois au montage (`decalageHorloge`,
 * `lib/terrain/compteur-vivant.ts`), que devient l'heure que le téléphone
 * s'apprête à envoyer ?
 */
describe("instantAppareilCale", () => {
  it("écart nul (horloge juste, ou hors ligne) : l'heure du téléphone part telle quelle", () => {
    const instant = new Date("2026-10-20T04:00:00.000Z");
    expect(
      instantAppareilCale({ instantAppareil: instant, decalageHorlogeMs: 0 }),
    ).toEqual(instant);
  });

  it("écart de 30 s, sous le seuil d'une minute : aucune correction", () => {
    const instant = new Date("2026-10-20T04:00:00.000Z");
    expect(
      instantAppareilCale({
        instantAppareil: instant,
        decalageHorlogeMs: 30_000,
      }),
    ).toEqual(instant);
    expect(
      instantAppareilCale({
        instantAppareil: instant,
        decalageHorlogeMs: -30_000,
      }),
    ).toEqual(instant);
  });

  it("téléphone 10 min EN AVANCE (décalage serveur−appareil négatif) : l'heure envoyée recule de 10 min", () => {
    const instant = new Date("2026-10-20T04:10:00.000Z");
    const decalageHorlogeMs = -10 * 60_000;
    expect(
      instantAppareilCale({ instantAppareil: instant, decalageHorlogeMs }),
    ).toEqual(new Date("2026-10-20T04:00:00.000Z"));
  });

  it("téléphone 10 min EN RETARD (décalage serveur−appareil positif) : l'heure envoyée avance de 10 min", () => {
    const instant = new Date("2026-10-20T04:00:00.000Z");
    const decalageHorlogeMs = 10 * 60_000;
    expect(
      instantAppareilCale({ instantAppareil: instant, decalageHorlogeMs }),
    ).toEqual(new Date("2026-10-20T04:10:00.000Z"));
  });

  it("écart de plus de 7 jours : corrigé en entier, sans plafond — ramène l'heure envoyée dans les bornes serveur (D115-1)", () => {
    const instant = new Date("2026-10-20T04:00:00.000Z");
    const decalageHorlogeMs = -8 * 24 * 60 * 60_000;
    const resultat = instantAppareilCale({
      instantAppareil: instant,
      decalageHorlogeMs,
    });
    expect(resultat).toEqual(new Date("2026-10-12T04:00:00.000Z"));
  });

  it("pile au seuil d'une minute (60 000 ms) : encore aucune correction, c'est strictement au-delà qui corrige", () => {
    const instant = new Date("2026-10-20T04:00:00.000Z");
    expect(
      instantAppareilCale({
        instantAppareil: instant,
        decalageHorlogeMs: 60_000,
      }),
    ).toEqual(instant);
    expect(
      instantAppareilCale({
        instantAppareil: instant,
        decalageHorlogeMs: 60_001,
      }),
    ).toEqual(new Date(instant.getTime() + 60_001));
  });
});
