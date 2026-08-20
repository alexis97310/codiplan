import { describe, expect, it } from "vitest";

import {
  motifRefusApplicatif,
  motifRefusReporting,
  type DiagnosticRole,
  type DiagnosticRoleReporting,
} from "@/lib/db/garde-role";

/**
 * Contrôle au démarrage du rôle de connexion (correction de revue L0-04, I1).
 *
 * `motifRefusApplicatif` est la décision pure du garde-fou : elle dit si un rôle
 * est apte à porter les connexions applicatives. Trois attributs la
 * disqualifient, chacun parce qu'il fait tomber le cloisonnement RLS.
 *
 * Ticket L0-06 : le garde ne juge plus l'attribut mais l'USAGE. Un second jeu
 * de scénarios couvre `motifRefusReporting`, dont les exigences sont inverses
 * sur `BYPASSRLS` — la consolidation multi-sociétés l'exige, là où
 * l'application l'interdit.
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
    expect(motifRefusApplicatif(diagnostic())).toBeNull();
  });

  it("refuse le rôle propriétaire de la base", () => {
    const motif = motifRefusApplicatif(diagnostic({ proprietaire_base: true }));
    expect(motif).toContain("propriétaire de la base");
  });

  it("refuse un superutilisateur", () => {
    const motif = motifRefusApplicatif(diagnostic({ superutilisateur: true }));
    expect(motif).toContain("superutilisateur");
  });

  it("refuse un rôle portant BYPASSRLS", () => {
    const motif = motifRefusApplicatif(diagnostic({ contourne_rls: true }));
    expect(motif).toContain("BYPASSRLS");
  });

  it("nomme le rôle et la base dans le refus, pour qu'il soit exploitable", () => {
    const motif = motifRefusApplicatif(
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

/** Diagnostic de l'usage consolidation : les mêmes attributs, plus l'écriture. */
function diagnosticReporting(
  surcharge: Partial<DiagnosticRoleReporting> = {},
): DiagnosticRoleReporting {
  return {
    role: "codiplan_reporting",
    base: "codiplan",
    superutilisateur: false,
    // La consolidation EXIGE ce que l'application interdit (D21).
    contourne_rls: true,
    proprietaire_base: false,
    ecriture_possible: false,
    ...surcharge,
  };
}

describe("garde-fou du rôle de consolidation", () => {
  it("accepte un rôle BYPASSRLS, non propriétaire, en lecture seule", () => {
    expect(motifRefusReporting(diagnosticReporting())).toBeNull();
  });

  it("refuse un rôle SANS BYPASSRLS — l'agrégat serait tronqué en silence", () => {
    const motif = motifRefusReporting(
      diagnosticReporting({ contourne_rls: false }),
    );
    expect(motif).toContain("BYPASSRLS");
    expect(motif).toContain("tronqué");
  });

  it("refuse un rôle capable d'écrire — D21 ne lui accorde que SELECT", () => {
    const motif = motifRefusReporting(
      diagnosticReporting({ ecriture_possible: true }),
    );
    expect(motif).toContain("écriture");
  });

  it("refuse le rôle propriétaire de la base", () => {
    const motif = motifRefusReporting(
      diagnosticReporting({ proprietaire_base: true }),
    );
    expect(motif).toContain("propriétaire de la base");
  });

  it("refuse un superutilisateur", () => {
    const motif = motifRefusReporting(
      diagnosticReporting({ superutilisateur: true }),
    );
    expect(motif).toContain("superutilisateur");
  });

  it("les deux gardes se contredisent sur BYPASSRLS, et c'est l'objet du ticket", () => {
    // Le même rôle, jugé par les deux usages : accepté ici, refusé là. C'est la
    // preuve que le garde distingue les usages et non les attributs.
    const rolePourConsolidation = diagnosticReporting();

    expect(motifRefusReporting(rolePourConsolidation)).toBeNull();
    expect(motifRefusApplicatif(rolePourConsolidation)).toContain("BYPASSRLS");

    const rolePourApplication: DiagnosticRole = {
      role: "codiplan_app",
      base: "codiplan",
      superutilisateur: false,
      contourne_rls: false,
      proprietaire_base: false,
    };

    expect(motifRefusApplicatif(rolePourApplication)).toBeNull();
    expect(
      motifRefusReporting({ ...rolePourApplication, ecriture_possible: true }),
    ).toContain("BYPASSRLS");
  });
});
