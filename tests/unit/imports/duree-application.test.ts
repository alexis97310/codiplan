import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

import { dureeApplicationLisible } from "../../../app/(back-office)/imports/presentation";

/**
 * CE QUE L'ÉCRAN D'UN LOT MONTRE DE SA DURÉE (MESURE-1, 23/09/2026).
 *
 * `dureeApplicationLisible` ne recalcule rien — elle rend lisible ce que la
 * base porte déjà (`import_lot.duree_application_ms`, mesuré par
 * `lib/imports/application.ts`). Deux épreuves de rendu :
 *   - un lot appliqué montre sa durée ;
 *   - un lot qui n'en porte pas (jamais candidat à afficher un zéro) NOMME
 *     l'absence.
 * Une troisième lit le SOURCE de l'écran, pour vérifier qu'il est réellement
 * branché sur cette fonction et sur les clés du dictionnaire — même méthode
 * que `tests/unit/imports/titre-nouvel-import.test.ts`.
 */

describe("dureeApplicationLisible", () => {
  it("un lot appliqué montre sa durée mesurée", () => {
    expect(dureeApplicationLisible(342)).toBe("342 ms");
  });

  it("une grande durée reste lisible, sans mise en forme par la locale", () => {
    // AUCUN `.toLocaleString()` ni `Intl.NumberFormat` (gardien I3,
    // `tests/unit/money/sans-decimales-en-dur.test.ts`, qui vise tout
    // formatage par la locale, pas seulement les montants) : le chiffre brut
    // suffit à une durée.
    expect(dureeApplicationLisible(12345)).toBe("12345 ms");
  });

  it("un lot qui n'a rien mesuré NOMME l'absence, jamais un zéro", () => {
    const rendu = dureeApplicationLisible(null);
    expect(rendu).toBe(t("imports.duree_application_absente"));
    expect(rendu).not.toContain("0 ms");
  });
});

const PAGE = join(process.cwd(), "app/(back-office)/imports/[id]/page.tsx");

function sourceDeLecran(): string {
  return readFileSync(PAGE, "utf8");
}

describe("l'écran d'un lot est réellement branché sur la durée mesurée", () => {
  it("importe et appelle `dureeApplicationLisible` sur `lot.dureeApplicationMs`", () => {
    const source = sourceDeLecran();
    expect(source).toContain("dureeApplicationLisible");
    expect(source).toContain("dureeApplicationLisible(lot.dureeApplicationMs)");
  });

  it("cite la clé du titre — jamais un libellé écrit en dur", () => {
    const source = sourceDeLecran();
    expect(source).toContain('t("imports.duree_application_titre")');
  });
});
