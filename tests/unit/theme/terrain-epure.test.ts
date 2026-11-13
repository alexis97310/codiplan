import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { JETONS, variableDuJeton } from "@/lib/theme/apparence";

/**
 * LE TERRAIN « ÉPURÉ » (D252, décision d'Alexis du 13/11/2026,
 * 9L04C-TERRAIN-STYLE-EPURE) — une ZONE, jamais une troisième apparence
 * (voir le commentaire de `app/globals.css`, juste au-dessus du bloc
 * `[data-zone="terrain"]`).
 *
 * Ce gardien prouve les deux moitiés de la promesse : la zone surcharge
 * UNIQUEMENT des jetons déjà connus (aucun nom neuf, donc aucune reprise de
 * `lib/theme/apparence.ts`), et le bureau — hors de cette zone — rend ses
 * anciennes couleurs, inchangées par ce bloc.
 */

const STYLE_BRUT = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const STYLE = STYLE_BRUT.replace(/\/\*[\s\S]*?\*\//g, "");

/** Le bloc de déclarations d'un sélecteur, extrait de la feuille de style. */
function blocDuSelecteur(selecteur: string): string {
  const debut = STYLE.indexOf(selecteur);
  if (debut === -1) {
    throw new Error(`sélecteur introuvable dans app/globals.css : ${selecteur}`);
  }
  const ouvrante = STYLE.indexOf("{", debut);
  const fermante = STYLE.indexOf("\n}", ouvrante);
  return STYLE.slice(ouvrante, fermante);
}

const ZONE_TERRAIN = blocDuSelecteur('[data-zone="terrain"]');
const BUREAU_MAQUETTE = blocDuSelecteur('[data-apparence="maquette"]');

function valeur(bloc: string, nomVariable: string): string | null {
  const trouve = new RegExp(`${nomVariable}\\s*:\\s*([^;]+);`).exec(bloc);
  return trouve === null ? null : trouve[1]!.trim();
}

describe("la zone terrain surcharge des jetons existants, jamais de nouveaux (D252)", () => {
  it("a réellement lu le bloc de la zone — le témoin de non-vacuité", () => {
    expect(ZONE_TERRAIN.length).toBeGreaterThan(0);
  });

  it("toute variable --app-… déclarée dans la zone est un jeton de JETONS", () => {
    const attendus = new Set(JETONS.map(variableDuJeton));
    const declarees = [...ZONE_TERRAIN.matchAll(/(--app-[a-z0-9-]+)\s*:/g)].map(
      (m) => m[1]!,
    );
    expect(declarees.length).toBeGreaterThan(0);
    const orphelines = declarees.filter((v) => !attendus.has(v));
    expect(
      orphelines,
      `jetons déclarés par la zone terrain sans exister dans JETONS : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });

  it("les valeurs mesurées sur la maquette validée du 13/11/2026 sont celles du style", () => {
    const attendues: ReadonlyArray<readonly [string, string]> = [
      ["--app-fond", "#ffffff"],
      ["--app-surface-creuse", "#f1f3f6"],
      ["--app-bord", "#e6e8ec"],
      ["--app-encre", "#111827"],
      ["--app-encre-faible", "#5b6472"],
      ["--app-vert-bord", "#1b7f3b"],
      ["--app-rouge-bord", "#c40511"],
      ["--app-rouge-encre", "#a3040e"],
      ["--app-orange-encre", "#6b4300"],
    ];
    for (const [nom, attendue] of attendues) {
      expect(valeur(ZONE_TERRAIN, nom), nom).toBe(attendue);
    }
  });

  it("le bleu de la marque N'EST PAS redéclaré — un seul bleu, les deux zones", () => {
    expect(valeur(ZONE_TERRAIN, "--app-marque")).toBeNull();
  });
});

describe("le bureau, hors de la zone terrain, rend ses anciennes couleurs (D124 inchangée)", () => {
  it("--app-fond du bureau reste le gris de la maquette, pas le blanc du terrain", () => {
    expect(valeur(BUREAU_MAQUETTE, "--app-fond")).toBe("#f4f6f9");
  });

  it("--app-encre et --app-encre-faible du bureau restent ceux de D124", () => {
    expect(valeur(BUREAU_MAQUETTE, "--app-encre")).toBe("#142033");
    expect(valeur(BUREAU_MAQUETTE, "--app-encre-faible")).toBe("#637083");
  });

  it("--app-bord du bureau reste `#dce2ea`, jamais le filet du terrain", () => {
    expect(valeur(BUREAU_MAQUETTE, "--app-bord")).toBe("#dce2ea");
  });
});

describe("aucun écran ne nomme la zone par un autre mot — un seul attribut", () => {
  it("le style ne porte qu'UN SEUL sélecteur `[data-zone=\"…\"]`", () => {
    const occurrences = [...STYLE.matchAll(/\[data-zone="([a-z0-9-]+)"\]/g)].map(
      (m) => m[1],
    );
    expect(occurrences).toEqual(["terrain"]);
  });
});

/**
 * LE CONTRASTE AA (WCAG 2.1, 1.4.3) DES COMBINAISONS NOMMÉES PAR LE TICKET —
 * texte secondaire sur blanc, bleu sur le fond de champ, les deux textes
 * d'état. Un texte normal exige 4,5:1 ; ces quatre couples sont ceux que la
 * passation du ticket devait vérifier et consigner.
 */
describe("contrastes AA des jetons terrain (D252)", () => {
  function linearise(canal: number): number {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }

  function luminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (
      0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
    );
  }

  function contraste(premierPlan: string, arrierePlan: string): number {
    const l1 = luminance(premierPlan);
    const l2 = luminance(arrierePlan);
    const [clair, sombre] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (clair + 0.05) / (sombre + 0.05);
  }

  const SEUIL_AA_TEXTE_NORMAL = 4.5;

  it.each([
    ["texte secondaire (#5b6472) sur blanc", "#5b6472", "#ffffff"],
    ["bleu (#0053a1) sur le fond de champ (#f1f3f6)", "#0053a1", "#f1f3f6"],
    ["texte d'alerte (#a3040e) sur blanc", "#a3040e", "#ffffff"],
    ["texte d'avertissement (#6b4300) sur blanc", "#6b4300", "#ffffff"],
  ])("%s tient au moins 4,5:1", (_description, fg, bg) => {
    expect(contraste(fg, bg)).toBeGreaterThanOrEqual(SEUIL_AA_TEXTE_NORMAL);
  });
});
