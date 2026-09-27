import { describe, expect, it } from "vitest";

import { estCleTraduction, fr, t } from "@/lib/i18n/fr";

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

describe("GR16 — demande.sans_numero", () => {
  it("reprend le texte déjà en usage pour une intervention sans numéro", () => {
    expect(t("demande.sans_numero")).toBe("Numéro provisoire");
    expect(t("demande.sans_numero")).toBe(t("intervention.sans_numero"));
  });
});

describe("GR16 — absences.sous_titre", () => {
  it("dit une consigne, pas une justification", () => {
    expect(t("absences.sous_titre")).not.toContain("médecine");
  });
});
