import { describe, expect, it } from "vitest";

import { peutReprendre, peutSuspendre } from "@/lib/interventions/cycle-de-vie";
import {
  schemaSuspension,
  STATUTS_INTERVENTION,
  type StatutIntervention,
} from "@/lib/interventions/saisie";

/**
 * LA SUSPENSION ET SA REPRISE (L2-10, RG-INT-06).
 *
 * > *« Une intervention SUSPENDUE porte un motif et, pour une attente de pièce,
 * > la référence attendue et la date de disponibilité prévisionnelle. »*
 *
 * Ce module EXPLIQUE ; la base GARDE — `tests/isolation/suspension.test.ts`
 * confronte les deux.
 */

const UUID = "01a09000-0000-7000-8000-000000000001";

describe("suspendre : ce qui est permis, et ce qui ne l'est pas", () => {
  it("couvre tous les statuts de l'énumération — sans quoi la matrice ment", () => {
    // Témoin de population : un neuvième statut ajouté demain rougit ici.
    expect(STATUTS_INTERVENTION.length).toBeGreaterThan(7);
  });

  it.each([
    "a_planifier",
    "planifiee",
    "envoyee",
    "en_cours",
    "terminee",
  ] as const)("depuis « %s », avec un motif, c'est PERMIS", (statut) => {
    expect(peutSuspendre(statut, "Attente de pièce").refuse).toBe(false);
  });

  it("une intervention FIGÉE ne se suspend pas — il n'y a plus rien à reprendre", () => {
    for (const statut of ["cloturee", "annulee"] as const) {
      expect(peutSuspendre(statut, "Motif").refuse, statut).toBe(true);
    }
  });

  it("une intervention DÉJÀ suspendue non plus, et le motif n'est pas la prudence", () => {
    // *La re-suspendre écraserait `suspendue_le`* — c'est-à-dire remettrait à
    // zéro l'ancienneté que la file de L2-10 et l'alerte « > 30 jours » du
    // chapitre 16.1 mesurent.
    const verdict = peutSuspendre("suspendue", "Motif");
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.deja_suspendue",
    );
  });

  it("SANS motif, c'est refusé — et le refus est le sien, pas celui du statut", () => {
    const verdict = peutSuspendre("planifiee", null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.motif_manquant",
    );
    // Le cas qui doit rester vert POUR SA PROPRE RAISON : le même statut AVEC
    // motif passe, donc le refus vient bien de l'absence de motif.
    expect(peutSuspendre("planifiee", "Attente de pièce").refuse).toBe(false);
  });

  it("un motif fait d'espaces ne compte pas pour un motif", () => {
    expect(peutSuspendre("planifiee", "   ").refuse).toBe(true);
  });
});

describe("reprendre : seule une intervention suspendue se reprend", () => {
  it("depuis « suspendue », c'est permis", () => {
    expect(peutReprendre("suspendue").refuse).toBe(false);
  });

  it("depuis TOUT AUTRE statut, c'est refusé", () => {
    const autres = STATUTS_INTERVENTION.filter(
      (s): s is StatutIntervention => s !== "suspendue",
    );
    // Témoin : la liste n'est pas vide, sinon cette boucle ne mesure rien.
    expect(autres.length).toBeGreaterThan(5);
    for (const statut of autres) {
      const verdict = peutReprendre(statut);
      expect(verdict.refuse, statut).toBe(true);
      expect(verdict.refuse && verdict.cle).toBe(
        "intervention.refus.pas_suspendue",
      );
    }
  });
});

describe("la saisie : la référence et sa date vont ENSEMBLE (RG-INT-06)", () => {
  it("les deux ensemble sont acceptées", () => {
    const saisie = schemaSuspension.parse({
      intervention_id: UUID,
      motif: "Attente de pièce",
      piece_attendue_ref: "CMP-4417-B",
      date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(saisie.piece_attendue_ref).toBe("CMP-4417-B");
  });

  it("aucune des deux est accepté — toute suspension n'attend pas une pièce", () => {
    const saisie = schemaSuspension.parse({
      intervention_id: UUID,
      motif: "Client absent, à reprogrammer",
    });
    expect(saisie.piece_attendue_ref).toBeNull();
    expect(saisie.date_dispo_prevue).toBeNull();
  });

  it("une référence SANS date est refusée — une file sans horizon ne se trie pas", () => {
    expect(() =>
      schemaSuspension.parse({
        intervention_id: UUID,
        motif: "Attente de pièce",
        piece_attendue_ref: "CMP-4417-B",
      }),
    ).toThrow();
  });

  it("une date SANS référence est refusée aussi — c'est le sens qu'on oublie", () => {
    expect(() =>
      schemaSuspension.parse({
        intervention_id: UUID,
        motif: "Attente de pièce",
        date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
      }),
    ).toThrow();
  });

  it("l'instant de la suspension NE SE SAISIT PAS", () => {
    // *Le laisser saisir permettrait de rajeunir une attente*, et l'ancienneté
    // est précisément ce que la file mesure. Le schéma est `strict()` : une clé
    // de plus est refusée, elle n'est pas ignorée.
    expect(() =>
      schemaSuspension.parse({
        intervention_id: UUID,
        motif: "Attente de pièce",
        suspendue_le: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toThrow();
  });
});
