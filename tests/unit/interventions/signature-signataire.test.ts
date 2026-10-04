import { describe, expect, it } from "vitest";

import { schemaSignature } from "@/lib/interventions/depot-rapport-terrain";

/**
 * `schemaSignature` (76-BON-4, SAV-10 ; 9DE-TP-CY1, D-S5) — LE NOM DU
 * SIGNATAIRE EST OBLIGATOIRE POUR UNE SIGNATURE « SIGNEE », SA QUALITÉ
 * FACULTATIVE. LES DEUX AUTRES ISSUES VEULENT UN MOTIF, JAMAIS UNE IMAGE.
 *
 * Un bon signé ne disait pas QUI avait signé pour le client — voir l'en-tête
 * du modèle `InterventionSignature`. Ce fichier couvre le schéma seul, hors
 * de toute écriture en base (`enregistrerSignature` reste couvert par
 * `tests/isolation/rapport-terrain.test.ts` et par `tests/e2e/bon-4.spec.ts`).
 */
const IMAGE = "data:image/png;base64,AAAA";

describe("schemaSignature — le nom du signataire (issue signee)", () => {
  it("refuse un nom vide", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "",
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un nom de 121 caractères", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "a".repeat(121),
    });
    expect(analyse.success).toBe(false);
  });

  it("accepte un nom de 120 caractères", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "a".repeat(120),
    });
    expect(analyse.success).toBe(true);
  });

  it("rogne les espaces du nom", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "  Jean Dupont  ",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success && analyse.data.issue === "signee") {
      expect(analyse.data.signataire_nom).toBe("Jean Dupont");
    }
  });

  it("refuse l'absence de nom", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
    });
    expect(analyse.success).toBe(false);
  });
});

describe("schemaSignature — la qualité du signataire, facultative (issue signee)", () => {
  it("accepte une qualité absente", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success && analyse.data.issue === "signee") {
      expect(analyse.data.signataire_qualite).toBeUndefined();
    }
  });

  it("accepte une qualité explicitement nulle", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: null,
    });
    expect(analyse.success).toBe(true);
    if (analyse.success && analyse.data.issue === "signee") {
      expect(analyse.data.signataire_qualite).toBeNull();
    }
  });

  it("rogne les espaces de la qualité", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: "  Chef d'atelier  ",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success && analyse.data.issue === "signee") {
      expect(analyse.data.signataire_qualite).toBe("Chef d'atelier");
    }
  });

  it("refuse une qualité de 81 caractères", () => {
    const analyse = schemaSignature.safeParse({
      issue: "signee",
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: "a".repeat(81),
    });
    expect(analyse.success).toBe(false);
  });
});

/**
 * LES DEUX AUTRES ISSUES (9DE-TP-CY1, décision du 03/10/2026 point 11) —
 * aucune image, un motif obligatoire.
 */
describe.each(["client_absent", "refus_signature"] as const)(
  "schemaSignature — issue %s",
  (issue) => {
    it("refuse un motif vide", () => {
      const analyse = schemaSignature.safeParse({ issue, motif: "" });
      expect(analyse.success).toBe(false);
    });

    it("refuse l'absence de motif", () => {
      const analyse = schemaSignature.safeParse({ issue });
      expect(analyse.success).toBe(false);
    });

    it("accepte un motif, et le rogne", () => {
      const analyse = schemaSignature.safeParse({
        issue,
        motif: "  Client injoignable  ",
      });
      expect(analyse.success).toBe(true);
      if (analyse.success && analyse.data.issue === issue) {
        expect(analyse.data.motif).toBe("Client injoignable");
      }
    });

    it("refuse un motif de 501 caractères", () => {
      const analyse = schemaSignature.safeParse({
        issue,
        motif: "a".repeat(501),
      });
      expect(analyse.success).toBe(false);
    });

    // R1 (relecture du 04/10/2026 de 9DE/9DEA/9DEB, 9DF-TP-CY2-MATRICE-D8) —
    // l'en-tête dit « JAMAIS UNE IMAGE » : avant `.strict()`, une clé
    // inconnue était retirée en silence plutôt que refusée, et cette forme
    // passait, image jetée sans un mot.
    it("refuse une image — cette issue n'en porte JAMAIS", () => {
      const analyse = schemaSignature.safeParse({
        issue,
        motif: "Client injoignable",
        image_base64: IMAGE,
      });
      expect(analyse.success).toBe(false);
    });
  },
);

describe("schemaSignature — l'issue elle-même", () => {
  it("refuse une issue inconnue", () => {
    const analyse = schemaSignature.safeParse({
      issue: "autre_chose",
      motif: "peu importe",
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse l'absence d'issue", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
    });
    expect(analyse.success).toBe(false);
  });
});
