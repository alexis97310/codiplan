import { describe, expect, it } from "vitest";

import { lireClasseur } from "@/lib/excel/classeur";
import { classeurDUneFeuille, nomDuFichierExport } from "@/lib/excel/export";

/**
 * LE SOCLE D'EXPORT (MO-9, D169) — une seule feuille, les en-têtes puis les
 * lignes, aucun marqueur de rechargement (à la différence de
 * `classeurDesRejets`, `lib/excel/ecriture.ts`) : un export n'est jamais
 * réimporté.
 */
describe("classeurDUneFeuille (MO-9, D169)", () => {
  it("pose les en-têtes puis les lignes, dans l'ordre reçu", async () => {
    const classeur = await classeurDUneFeuille(
      ["Référence", "Client"],
      [
        ["INT-00001", "GARAGE DUPOND"],
        ["INT-00002", "GARAGE DUPONT"],
      ],
    );

    expect(Buffer.isBuffer(classeur)).toBe(true);

    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];

    expect(lignes[0]?.map((c) => c?.texte)).toEqual(["Référence", "Client"]);
    expect(lignes[1]?.map((c) => c?.texte)).toEqual([
      "INT-00001",
      "GARAGE DUPOND",
    ]);
    expect(lignes[2]?.map((c) => c?.texte)).toEqual([
      "INT-00002",
      "GARAGE DUPONT",
    ]);
    expect(lignes.length).toBe(3);
  });

  it("n'écrit que les en-têtes quand le filtre ne rend aucune ligne", async () => {
    const classeur = await classeurDUneFeuille(["Référence", "Client"], []);
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];

    expect(lignes.length).toBe(1);
    expect(lignes[0]?.map((c) => c?.texte)).toEqual(["Référence", "Client"]);
  });
});

describe("nomDuFichierExport (MO-9, D169)", () => {
  it("compose <écran>-<AAAA-MM-JJ>.xlsx", () => {
    expect(nomDuFichierExport("interventions", "2026-10-05")).toBe(
      "interventions-2026-10-05.xlsx",
    );
  });
});
