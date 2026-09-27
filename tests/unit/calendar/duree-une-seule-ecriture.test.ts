import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * UNE SEULE ÉCRITURE D'UNE DURÉE (GR14, audit GR du 26/09/2026, constat G17).
 *
 * ## Ce que la duplication coûtait
 *
 * Trois écrans portaient chacun leur propre conversion minutes → heures ;
 * une seule des trois (`interventions/[id]/page.tsx`) complétait le reste à
 * deux chiffres AVANT de tester l'heure nulle, et écrivait « 05 min » là où
 * les deux autres écrivaient « 5 min ». `enDuree` (`lib/calendar/duree.ts`)
 * est désormais la seule maison ; ce gardien refuse qu'une seconde écriture
 * y renaisse dans l'un de ces trois fichiers.
 */

const FICHIERS = [
  "app/(back-office)/interventions/[id]/page.tsx",
  "app/(back-office)/interventions/[id]/bon/page.tsx",
  "app/(mobile)/terrain/[id]/page.tsx",
] as const;

function source(fichier: string): string {
  return readFileSync(join(process.cwd(), fichier), "utf8");
}

describe("les trois écrans lisent enDuree, et rien d'autre", () => {
  it.each(FICHIERS)("%s importe @/lib/calendar/duree", (fichier) => {
    expect(source(fichier)).toContain('from "@/lib/calendar/duree"');
  });

  it.each(FICHIERS)(
    "%s ne redéfinit ni `minutes()` ni `enHeuresEtMinutes()`",
    (fichier) => {
      const texte = source(fichier);
      expect(texte).not.toMatch(/function\s+minutes\s*\(/);
      expect(texte).not.toMatch(/function\s+enHeuresEtMinutes\s*\(/);
    },
  );

  it("LA MISE EN ÉCHEC : une copie locale réintroduite est refusée", () => {
    // La faute telle qu'elle se commettrait — quelqu'un rend une copie locale
    // à la fiche intervention plutôt que d'importer `enDuree`. On rejoue le
    // verdict du gardien sur ce texte-là, sans toucher au fichier.
    const fichier = FICHIERS[0];
    const original = source(fichier);
    const copie = `${original}\nfunction minutes(total: number): string {\n  const heures = Math.floor(total / 60);\n  const reste = String(total % 60).padStart(2, "0");\n  return heures === 0 ? \`\${reste} min\` : \`\${heures} h \${reste}\`;\n}\n`;
    expect(copie).not.toBe(original);
    expect(copie).toMatch(/function\s+minutes\s*\(/);
  });
});
