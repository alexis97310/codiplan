import { describe, expect, it } from "vitest";

import { titreDeLaFiche } from "@/app/(back-office)/interventions/presentation";

/**
 * TR-51 (audit du 28/09/2026 ; 9DR-TP-NAV2-RETOURS-FIL) — la fiche
 * intervention nomme son client, jamais la seule référence.
 */
describe("titreDeLaFiche", () => {
  it("compose « <client> — Intervention <référence> » quand le client est connu", () => {
    expect(
      titreDeLaFiche(
        { id: "x", numero: 42, annee: 2026 },
        "CODIMA Nouvelle-Calédonie",
      ),
    ).toBe("CODIMA Nouvelle-Calédonie — Intervention INT-2026-0042");
  });

  it("retombe sur « Intervention <référence> » seule quand le client est `null`", () => {
    expect(
      titreDeLaFiche({ id: "abc123def456", numero: null, annee: null }, null),
    ).toBe("Intervention Local-DEF456");
  });
});
