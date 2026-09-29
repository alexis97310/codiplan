import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

import { dureeApplicationLisible } from "../../../app/(back-office)/imports/presentation";

/**
 * CE QUE L'ÉCRAN D'UN LOT MONTRE DE SA DURÉE (MESURE-1, 23/09/2026 ; réécrit
 * TP-A3-RAPPORT-IMPORT, PA-53).
 *
 * `dureeApplicationLisible` ne recalcule rien — elle rend lisible ce que la
 * base porte déjà (`import_lot.duree_application_ms`, mesuré par
 * `lib/imports/application.ts`). Le STATUT du lot décide du libellé d'absence :
 * un lot resté `controle` n'a jamais rien eu à mesurer (« pas encore été
 * appliqué ») ; un lot `applique` ou `annule` sans durée est une anomalie de
 * lecture — la cause n'est pas mesurée ici, seule l'absence l'est (« non
 * mesurée »). Jamais un zéro qui se lirait comme « instantané ».
 */

describe("dureeApplicationLisible", () => {
  it("une durée mesurée s'affiche quel que soit le statut", () => {
    expect(dureeApplicationLisible("controle", 342)).toBe("342 ms");
    expect(dureeApplicationLisible("applique", 342)).toBe("342 ms");
    expect(dureeApplicationLisible("annule", 342)).toBe("342 ms");
  });

  it("une grande durée reste lisible, sans mise en forme par la locale", () => {
    // AUCUN `.toLocaleString()` ni `Intl.NumberFormat` (gardien I3,
    // `tests/unit/money/sans-decimales-en-dur.test.ts`, qui vise tout
    // formatage par la locale, pas seulement les montants) : le chiffre brut
    // suffit à une durée.
    expect(dureeApplicationLisible("applique", 12345)).toBe("12345 ms");
  });

  it("un lot resté `controle` sans durée dit qu'il n'a pas encore été appliqué", () => {
    const rendu = dureeApplicationLisible("controle", null);
    expect(rendu).toBe(t("imports.duree_application_absente"));
    expect(rendu).not.toContain("0 ms");
  });

  it("un lot APPLIQUÉ sans durée NOMME l'anomalie — jamais le même texte qu'un lot non appliqué", () => {
    const rendu = dureeApplicationLisible("applique", null);
    expect(rendu).toBe(t("imports.duree_application_non_mesuree"));
    expect(rendu).not.toBe(t("imports.duree_application_absente"));
    expect(rendu).not.toContain("0 ms");
  });

  it("un lot ANNULÉ sans durée suit la même règle qu'un lot appliqué", () => {
    const rendu = dureeApplicationLisible("annule", null);
    expect(rendu).toBe(t("imports.duree_application_non_mesuree"));
  });
});

const PAGE = join(process.cwd(), "app/(back-office)/imports/[id]/page.tsx");

function sourceDeLecran(): string {
  return readFileSync(PAGE, "utf8");
}

describe("l'écran d'un lot est réellement branché sur la durée mesurée", () => {
  it("importe et appelle `dureeApplicationLisible` sur le statut et la durée du lot", () => {
    const source = sourceDeLecran();
    expect(source).toContain("dureeApplicationLisible");
    expect(source).toContain(
      "dureeApplicationLisible(lot.statut, lot.dureeApplicationMs)",
    );
  });

  it("cite la clé du titre — jamais un libellé écrit en dur", () => {
    const source = sourceDeLecran();
    expect(source).toContain('t("imports.duree_application_titre")');
  });
});
