import { describe, expect, it } from "vitest";

import { cleJour } from "@/lib/calendar";
import { cleJourAdossePaques, dimanchePaques } from "@/lib/calendar/paques";
import { FETES_MOBILES } from "@/prisma/seed-data";

/**
 * Fêtes mobiles adossées à Pâques (ticket L0-08, point 4).
 *
 * Le calcul est autorisé, mais **il produit des données de la table
 * `jour_ferie`** ; il ne s'exécute jamais à la volée dans le métier. Ce
 * scénario éprouve donc l'arithmétique, et le gardien
 * `sans-date-feriee-en-dur.test.ts` éprouve la frontière — que personne, hors
 * du seed, n'appelle ce module.
 */

describe("dimanche de Pâques", () => {
  it("retrouve des années connues", () => {
    const attendu: Record<number, string> = {
      2000: "2000-04-23",
      2024: "2024-03-31",
      2026: "2026-04-05",
      2027: "2027-03-28",
      2028: "2028-04-16",
    };

    for (const [annee, date] of Object.entries(attendu)) {
      expect(cleJour(dimanchePaques(Number(annee))), annee).toBe(date);
    }
  });

  it("tombe toujours un dimanche, sur un siècle entier", () => {
    for (let annee = 2000; annee < 2100; annee += 1) {
      const paques = dimanchePaques(annee);
      const date = new Date(
        Date.UTC(paques.annee, paques.mois - 1, paques.jour),
      );
      expect(date.getUTCDay(), String(annee)).toBe(0);
    }
  });

  it("refuse une année hors du domaine de validité plutôt que de deviner", () => {
    expect(() => dimanchePaques(1500)).toThrow(/domaine de validité/);
    expect(() => dimanchePaques(2026.5)).toThrow();
  });
});

describe("jours adossés à Pâques", () => {
  it("place les trois fêtes mobiles du jeu de démonstration en 2026", () => {
    // Le module ne connaît que des décalages ; les libellés sont des données du
    // seed. C'est le seed qui rapproche les deux, et ce scénario le reproduit.
    const dates = FETES_MOBILES.map((fete) =>
      cleJourAdossePaques(2026, fete.decalage),
    );
    expect(dates).toEqual(["2026-04-06", "2026-05-14", "2026-05-25"]);
  });

  it("refuse un décalage qui n'est pas un nombre entier de jours", () => {
    expect(() => cleJourAdossePaques(2026, 1.5)).toThrow(/entier/);
  });
});
