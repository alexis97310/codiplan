import { describe, expect, it } from "vitest";

import { motifRefus, type DiagnosticRole } from "@/lib/db/garde-role";

/**
 * Contrôle au démarrage du rôle de connexion (correction de revue L0-04, I1).
 *
 * `motifRefus` est la décision pure du garde-fou : elle dit si un rôle est
 * apte à porter les connexions applicatives. Trois attributs la disqualifient,
 * chacun parce qu'il fait tomber le cloisonnement RLS.
 */
function diagnostic(surcharge: Partial<DiagnosticRole> = {}): DiagnosticRole {
  return {
    role: "codiplan_app",
    base: "codiplan",
    superutilisateur: false,
    contourne_rls: false,
    proprietaire_base: false,
    ...surcharge,
  };
}

describe("garde-fou du rôle applicatif", () => {
  it("accepte un rôle ni propriétaire, ni superutilisateur, ni BYPASSRLS", () => {
    expect(motifRefus(diagnostic())).toBeNull();
  });

  it("refuse le rôle propriétaire de la base", () => {
    const motif = motifRefus(diagnostic({ proprietaire_base: true }));
    expect(motif).toContain("propriétaire de la base");
  });

  it("refuse un superutilisateur", () => {
    const motif = motifRefus(diagnostic({ superutilisateur: true }));
    expect(motif).toContain("superutilisateur");
  });

  it("refuse un rôle portant BYPASSRLS", () => {
    const motif = motifRefus(diagnostic({ contourne_rls: true }));
    expect(motif).toContain("BYPASSRLS");
  });

  it("nomme le rôle et la base dans le refus, pour qu'il soit exploitable", () => {
    const motif = motifRefus(
      diagnostic({
        role: "neondb_owner",
        base: "codiplan",
        superutilisateur: true,
      }),
    );
    expect(motif).toContain("neondb_owner");
    expect(motif).toContain("codiplan");
  });
});
