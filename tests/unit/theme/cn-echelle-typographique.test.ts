import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

/**
 * `cn` = `twMerge(clsx(...))` sans configuration prenait `text-12`…`text-28`
 * (échelle maison, `app/globals.css`, `--text-12`…`--text-28`) pour une
 * classe de COULEUR (`text-{couleur}`, qui accepte toute valeur) au lieu
 * d'une classe de TAILLE DE POLICE : une classe de couleur placée avant ou
 * après `text-12` dans un même `cn(...)` était alors retirée à tort — cause
 * des titres de groupes invisibles dans `components/navigation/barre.tsx`
 * (9EWA-RENDU-VISUEL-1, point 1).
 */
describe("cn — échelle typographique maison", () => {
  it("garde une classe de couleur ET une taille de l'échelle maison, quel que soit l'ordre", () => {
    expect(cn("text-app-chrome-encre-faible", "text-12")).toBe(
      "text-app-chrome-encre-faible text-12",
    );
    expect(cn("text-12", "text-app-chrome-encre-faible")).toBe(
      "text-12 text-app-chrome-encre-faible",
    );
  });

  it("fait gagner la dernière taille de l'échelle maison quand deux s'affrontent", () => {
    expect(cn("text-12", "text-14")).toBe("text-14");
  });

  it("laisse les tailles par défaut de Tailwind se comporter normalement", () => {
    expect(cn("text-red-500", "text-sm")).toBe("text-red-500 text-sm");
  });
});
