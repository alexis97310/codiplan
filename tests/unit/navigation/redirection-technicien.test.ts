import { describe, expect, it } from "vitest";

import {
  CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN,
  declarationAbsenceOuverteAuTechnicien,
  idInterventionDuChemin,
} from "@/lib/navigation/redirection-technicien";

/**
 * QUELLE INTERVENTION UNE URL DU BACK-OFFICE NOMME-T-ELLE ? (D221, décision
 * d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) — fonction
 * PURE, éprouvée ici sans session ni base. `app/(back-office)/layout.tsx`
 * confronte le reste (droit, redirection) à un vrai PostgreSQL ; voir
 * `tests/e2e/9g8-redirection-technicien.spec.ts`.
 */
describe("idInterventionDuChemin", () => {
  const ID = "01923f4e-7c3a-7c3a-9c3a-0123456789ab";

  it("reconnaît la fiche d'une intervention", () => {
    expect(idInterventionDuChemin(`/interventions/${ID}`)).toBe(ID);
  });

  it("reconnaît le bon d'une intervention", () => {
    expect(idInterventionDuChemin(`/interventions/${ID}/bon`)).toBe(ID);
  });

  it("ignore la casse de l'identifiant (UUID rendu en majuscules)", () => {
    expect(idInterventionDuChemin(`/interventions/${ID.toUpperCase()}`)).toBe(
      ID.toUpperCase(),
    );
  });

  it("ne reconnaît PAS la liste des interventions (aucun identifiant)", () => {
    expect(idInterventionDuChemin("/interventions")).toBeNull();
  });

  it("ne reconnaît PAS « nouvelle » ou « a-facturer », qui ne sont pas des identifiants", () => {
    expect(idInterventionDuChemin("/interventions/nouvelle")).toBeNull();
    expect(idInterventionDuChemin("/interventions/a-facturer")).toBeNull();
  });

  it("ne confond PAS un identifiant de client, de site ou de demande avec celui d'une intervention", () => {
    expect(idInterventionDuChemin(`/clients/${ID}`)).toBeNull();
    expect(idInterventionDuChemin(`/sites/${ID}`)).toBeNull();
    expect(idInterventionDuChemin(`/demandes/${ID}`)).toBeNull();
    expect(idInterventionDuChemin(`/parc/${ID}`)).toBeNull();
  });

  it("ne reconnaît pas un autre segment ajouté après le bon", () => {
    expect(
      idInterventionDuChemin(`/interventions/${ID}/autre-chose`),
    ).toBeNull();
  });
});

describe("CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN", () => {
  it("nomme /arrivee, ouverte à tout rôle", () => {
    expect(CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN).toBe("/arrivee");
  });
});

/**
 * Précision du 24/10/2026 sous D221 (décision d'Alexis, 9G8B-REPRISE-9G8A) —
 * `/absences?declarer=1` reste ouverte au technicien ; le reste de la page
 * suit D221 sans changement.
 */
describe("declarationAbsenceOuverteAuTechnicien", () => {
  it("ouvre /absences avec declarer=1", () => {
    expect(
      declarationAbsenceOuverteAuTechnicien("/absences", "?declarer=1"),
    ).toBe(true);
  });

  it("ouvre /absences avec declarer=1 combiné à un autre paramètre", () => {
    expect(
      declarationAbsenceOuverteAuTechnicien(
        "/absences",
        "?semaine=2026-S43&declarer=1",
      ),
    ).toBe(true);
  });

  it("ferme /absences sans declarer=1 — le reste de la page suit D221", () => {
    expect(declarationAbsenceOuverteAuTechnicien("/absences", "")).toBe(false);
  });

  it("ferme /absences?apercu=1 — l'aperçu n'est pas la déclaration", () => {
    expect(
      declarationAbsenceOuverteAuTechnicien("/absences", "?apercu=1"),
    ).toBe(false);
  });

  it("exige la valeur exacte 1, jamais seulement la présence du paramètre", () => {
    expect(
      declarationAbsenceOuverteAuTechnicien("/absences", "?declarer=true"),
    ).toBe(false);
  });

  it("ne reconnaît aucune autre route, même proche", () => {
    expect(
      declarationAbsenceOuverteAuTechnicien(
        "/absences/historique",
        "?declarer=1",
      ),
    ).toBe(false);
    expect(
      declarationAbsenceOuverteAuTechnicien("/planning", "?declarer=1"),
    ).toBe(false);
  });
});
