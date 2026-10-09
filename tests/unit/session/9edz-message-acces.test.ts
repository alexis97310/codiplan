import { describe, expect, it } from "vitest";

import { tonDuMotifDAcces } from "../../../components/session/message-acces";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 5 (D188) — LE MAPPING MOTIF ->
 * TON DU BANDEAU DES ÉCRANS SANS SESSION.
 *
 * Pure, sans rendu : les quatre motifs réels et un motif forgé, jamais
 * d'exception.
 */
describe("tonDuMotifDAcces", () => {
  it("les deux motifs de succès rendent le ton « succes »", () => {
    expect(tonDuMotifDAcces("premier_acces.abouti")).toBe("succes");
    expect(tonDuMotifDAcces("connexion.apres_enrolement")).toBe("succes");
  });

  it("les deux motifs de refus rendent le ton « refus »", () => {
    expect(tonDuMotifDAcces("auth.refus")).toBe("refus");
    expect(tonDuMotifDAcces("auth.indisponible")).toBe("refus");
  });

  it("un motif inconnu (forgé) retombe sur le ton « refus », jamais une exception", () => {
    expect(() => tonDuMotifDAcces("nimporte.quoi")).not.toThrow();
    expect(tonDuMotifDAcces("nimporte.quoi")).toBe("refus");
    expect(tonDuMotifDAcces("")).toBe("refus");
  });
});
