import { describe, expect, it } from "vitest";

import {
  COMPTES_PORTAIL,
  DEVISES,
  SOCIETES,
  UTILISATEURS_INTERNES,
} from "@/prisma/seed-data";

/**
 * Critères d'acceptation du ticket L0-03 : le seed crée deux sociétés — l'une
 * en XPF avec trois agences (Ducos, Koné, Dolbeau), l'autre en EUR — et au
 * moins un compte portail rattaché à un client (D5, D10).
 *
 * Le test porte sur les données pures, indépendamment de la base : il vérifie
 * l'intention du seed, que `pnpm db:seed` matérialise ensuite via Prisma.
 */
describe("jeu de données du socle multi-société", () => {
  it("déclare XPF sans décimale et sans symbole, EUR à deux décimales (I3, D19)", () => {
    const xpf = DEVISES.find((d) => d.code === "XPF");
    const eur = DEVISES.find((d) => d.code === "EUR");

    expect(xpf).toBeDefined();
    expect(xpf?.decimales).toBe(0);
    expect(xpf?.symbole).toBeNull();

    expect(eur).toBeDefined();
    expect(eur?.decimales).toBe(2);
    expect(eur?.symbole).toBe("€");
  });

  it("crée exactement deux sociétés, l'une en XPF, l'autre en EUR", () => {
    expect(SOCIETES).toHaveLength(2);

    const parDevise = SOCIETES.filter((s) => s.devise_code === "XPF");
    expect(parDevise).toHaveLength(1);
    expect(SOCIETES.filter((s) => s.devise_code === "EUR")).toHaveLength(1);
  });

  it("dote la société XPF de trois agences : Ducos, Koné, Dolbeau (D5)", () => {
    const societeXpf = SOCIETES.find((s) => s.devise_code === "XPF");
    expect(societeXpf).toBeDefined();

    const codes = societeXpf?.agences.map((a) => a.code).sort();
    expect(codes).toEqual(["DOLBEAU", "DUCOS", "KONE"]);
  });

  it("rattache toute devise de société à une devise déclarée", () => {
    const codesDevise = new Set(DEVISES.map((d) => d.code));
    for (const societe of SOCIETES) {
      expect(codesDevise.has(societe.devise_code)).toBe(true);
    }
  });

  it("crée au moins un compte portail rattaché à un client (D10)", () => {
    expect(COMPTES_PORTAIL.length).toBeGreaterThanOrEqual(1);

    const codesSociete = new Set(SOCIETES.map((s) => s.code));
    for (const compte of COMPTES_PORTAIL) {
      expect(compte.client_id.length).toBeGreaterThan(0);
      expect(codesSociete.has(compte.societe_code)).toBe(true);
    }
  });

  it("garde les comptes portail exclusifs des habilitations internes (D10)", () => {
    const emailsInternes = new Set(UTILISATEURS_INTERNES.map((u) => u.email));
    for (const compte of COMPTES_PORTAIL) {
      expect(emailsInternes.has(compte.email)).toBe(false);
    }
  });
});
