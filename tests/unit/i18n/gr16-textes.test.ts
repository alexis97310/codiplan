import { describe, expect, it } from "vitest";

import { estCleTraduction, fr } from "@/lib/i18n/fr";

/**
 * GR16 (audit d'ergonomie du 26/09/2026, constat G18) — neuf textes
 * réécrits, sans changement de règle de gestion. Chaque scénario ci-dessous
 * couvre un point du lot.
 */
describe("GR16 — clients.nouveau.sous_titre supprimé", () => {
  it("la clé n'existe plus dans le dictionnaire", () => {
    expect(estCleTraduction("clients.nouveau.sous_titre")).toBe(false);
    expect(Object.keys(fr)).not.toContain("clients.nouveau.sous_titre");
  });
});
