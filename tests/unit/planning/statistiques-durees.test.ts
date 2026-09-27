import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LA CHARGE PAR TECHNICIEN ÉCRIT SES DURÉES EN « 11 h 30 », JAMAIS EN
 * « 11:30 » (GR14, audit GR du 26/09/2026, constat G17).
 *
 * `enHeure` (`lib/calendar/parametrage.ts`) lit une HEURE DU JOUR, pas une
 * durée : les cinq usages du composant portaient sur des minutes ENGAGÉES,
 * OUVRABLES, de TRAJET — des intervalles, jamais un point du jour. La bonne
 * fonction est `enDuree` (`lib/calendar/duree.ts`).
 *
 * Gardien du TEXTE, comme `occupation-affichee.test.ts` : ce qu'il ne peut
 * pas voir, c'est le rendu réel à l'écran.
 */

const COMPOSANT = join(
  process.cwd(),
  "app/(back-office)/planning/statistiques.tsx",
);

function source(): string {
  return readFileSync(COMPOSANT, "utf8");
}

describe("la charge par technicien écrit ses durées en heures et minutes", () => {
  it("n'importe plus enHeure", () => {
    expect(source()).not.toContain("enHeure");
  });

  it("appelle enDuree au moins cinq fois", () => {
    const occurrences = source().match(/enDuree\(/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(5);
  });

  it("LA MISE EN ÉCHEC : un texte qui réimporterait enHeure est refusé", () => {
    const regresse = source().replace(
      'import { enDuree } from "@/lib/calendar/duree";',
      'import { enHeure } from "@/lib/calendar/parametrage";\nimport { enDuree } from "@/lib/calendar/duree";',
    );
    expect(regresse).not.toBe(source());
    expect(regresse).toContain("enHeure");
  });
});
