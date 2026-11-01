import { describe, expect, it } from "vitest";

import { CAPACITES } from "@/lib/auth/habilitations";
import { libelleCapacite } from "@/lib/auth/presentation-capacites";

/**
 * GARDIEN DE COMPLÉTUDE (9I9-MON-COMPTE) — fermé CONTRE `CAPACITES`
 * (`lib/auth/habilitations.ts`), jamais l'inverse : une capacité ajoutée à la
 * matrice du §5.2 sans son libellé ici rougit, plutôt que de s'afficher comme
 * sa propre clé technique sur l'écran « Mon compte ».
 */
describe("chaque capacité de la matrice porte un libellé lisible", () => {
  it.each(CAPACITES)("%s", (capacite) => {
    const libelle = libelleCapacite(capacite);
    expect(libelle.startsWith("capacite.")).toBe(false);
    expect(libelle.trim().length).toBeGreaterThan(0);
  });

  it("ne porte ni « agence » ni « site » hors des trois compositions prévues", () => {
    const motsImposes = /\b(?:agences?|sites?)\b/i;
    for (const capacite of CAPACITES) {
      const libelle = libelleCapacite(capacite);
      if (motsImposes.test(libelle)) {
        expect([
          "administrer_agences",
          "gerer_client_site",
          "consulter_clients_sites",
        ]).toContain(capacite);
      }
    }
  });
});
