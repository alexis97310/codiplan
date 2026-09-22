import { describe, expect, it } from "vitest";

import { libelleAgenceAvecCode } from "@/lib/agences/presentation";
import { fr } from "@/lib/i18n/fr";

/**
 * « libellé — code » DISTINGUE DEUX AGENCES DE MÊME LIBELLÉ (AGENCE-CODE-1).
 *
 * Mesuré le 23/09/2026 sur la base de production d'Alexis : deux agences
 * « DUCOS » y coexistent, l'une active et l'autre inactive, avec deux
 * identifiants distincts — et jusqu'ici, aucun écran ne lisait `code`.
 * `code` est la clé unique par société (`@@unique([societe_id, code])`),
 * jamais le libellé : c'est donc lui qui doit apparaître pour que deux
 * lignes de même libellé restent lisibles l'une de l'autre.
 */
describe("libelleAgenceAvecCode (AGENCE-CODE-1)", () => {
  it("compose le libellé et le code, séparés par la ponctuation partagée", () => {
    expect(libelleAgenceAvecCode("Ducos", "DUCOS")).toBe(
      `Ducos${fr["ponctuation.separateur"]}DUCOS`,
    );
  });

  it("deux agences de même libellé et de codes différents restent distinguables", () => {
    const premiere = libelleAgenceAvecCode("Ducos", "DUCOS");
    const seconde = libelleAgenceAvecCode("Ducos", "DUCOS-2");

    expect(premiere).not.toBe(seconde);
    // Témoin du défaut mesuré : le libellé SEUL, lui, ne les distinguait pas.
    expect(premiere.startsWith("Ducos")).toBe(true);
    expect(seconde.startsWith("Ducos")).toBe(true);
  });
});
