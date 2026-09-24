import { describe, expect, it } from "vitest";

import { schemaSignature } from "@/lib/interventions/depot-rapport-terrain";

/**
 * `schemaSignature` (76-BON-4, SAV-10) — LE NOM DU SIGNATAIRE EST OBLIGATOIRE,
 * SA QUALITÉ FACULTATIVE.
 *
 * Un bon signé ne disait pas QUI avait signé pour le client — voir l'en-tête
 * du modèle `InterventionSignature`. Ce fichier couvre le schéma seul, hors
 * de toute écriture en base (`enregistrerSignature` reste couvert par
 * `tests/isolation/rapport-terrain.test.ts` et par `tests/e2e/bon-4.spec.ts`).
 */
const IMAGE = "data:image/png;base64,AAAA";

describe("schemaSignature — le nom du signataire", () => {
  it("refuse un nom vide", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "",
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un nom de 121 caractères", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "a".repeat(121),
    });
    expect(analyse.success).toBe(false);
  });

  it("accepte un nom de 120 caractères", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "a".repeat(120),
    });
    expect(analyse.success).toBe(true);
  });

  it("rogne les espaces du nom", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "  Jean Dupont  ",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success) {
      expect(analyse.data.signataire_nom).toBe("Jean Dupont");
    }
  });

  it("refuse l'absence de nom", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
    });
    expect(analyse.success).toBe(false);
  });
});

describe("schemaSignature — la qualité du signataire, facultative", () => {
  it("accepte une qualité absente", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success) {
      expect(analyse.data.signataire_qualite).toBeUndefined();
    }
  });

  it("accepte une qualité explicitement nulle", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: null,
    });
    expect(analyse.success).toBe(true);
    if (analyse.success) {
      expect(analyse.data.signataire_qualite).toBeNull();
    }
  });

  it("rogne les espaces de la qualité", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: "  Chef d'atelier  ",
    });
    expect(analyse.success).toBe(true);
    if (analyse.success) {
      expect(analyse.data.signataire_qualite).toBe("Chef d'atelier");
    }
  });

  it("refuse une qualité de 81 caractères", () => {
    const analyse = schemaSignature.safeParse({
      image_base64: IMAGE,
      signataire_nom: "Jean Dupont",
      signataire_qualite: "a".repeat(81),
    });
    expect(analyse.success).toBe(false);
  });
});
