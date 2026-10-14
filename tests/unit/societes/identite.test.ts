import { describe, expect, it } from "vitest";

import { sigleDeLaRaisonSociale } from "@/lib/societes/identite";

/**
 * LE SIGLE DE LA PASTILLE (9EWD1-PARAMETRES-HUB-SOLDE, M:4358) — dérivé des
 * initiales de la raison sociale, jamais saisi.
 */
describe("sigleDeLaRaisonSociale (carte « Identité » du hub de paramétrage)", () => {
  it("deux mots ou plus : l'initiale des deux premiers", () => {
    expect(sigleDeLaRaisonSociale("CODIMA Nouvelle-Calédonie")).toBe("CN");
  });

  it("un seul mot : ses deux premiers caractères", () => {
    expect(sigleDeLaRaisonSociale("CODIMA")).toBe("CO");
  });

  it("toujours en capitales, même une raison sociale saisie en minuscules", () => {
    expect(sigleDeLaRaisonSociale("acme services")).toBe("AS");
    expect(sigleDeLaRaisonSociale("acme")).toBe("AC");
  });

  it("espaces multiples ou en tête/fin : ignorés, comme un seul séparateur", () => {
    expect(sigleDeLaRaisonSociale("  CODIMA   Nord  ")).toBe("CN");
  });

  it("chaîne vide : un sigle vide, jamais une exception", () => {
    expect(sigleDeLaRaisonSociale("")).toBe("");
    expect(sigleDeLaRaisonSociale("   ")).toBe("");
  });
});
