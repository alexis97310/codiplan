import { describe, expect, it } from "vitest";

import {
  verdictAffectation,
  type ExigenceDuSite,
  type HabilitationDetenue,
} from "../../../lib/habilitations/affectation";

/**
 * RG-PLA-04 — « L'affectation est **bloquée** si le site exige une habilitation
 * marquée **bloquante** que le technicien n'a pas, ou dont la date d'expiration
 * est antérieure à la date d'intervention. Une exigence non bloquante produit un
 * **avertissement**. » *(amendée par D9)*
 *
 * Le ticket L1-04 disait « signalée » ; la règle dit « bloquée », et D9 a
 * corrigé le ticket en le disant. **La règle l'emporte** — c'est ce que ce
 * fichier vérifie, cas par cas.
 */

const B1V = "0192f0a0-1000-7000-8000-00000000b11v";
const CACES = "0192f0a0-1000-7000-8000-0000000cace5";

const INTERVENTION = new Date("2026-09-15T00:00:00Z");

function exigence(habilitation_id: string, bloquant: boolean): ExigenceDuSite {
  return { habilitation_id, bloquant };
}

function detenue(
  habilitation_id: string,
  expiration: string | null,
): HabilitationDetenue {
  return {
    habilitation_id,
    date_expiration: expiration === null ? null : new Date(expiration),
  };
}

describe("RG-PLA-04 — l'affectation est BLOQUÉE, et non signalée", () => {
  it("passe quand le technicien détient ce que le site exige", () => {
    const verdict = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, "2027-01-01")],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(false);
    expect(verdict.bloquantes).toEqual([]);
    expect(verdict.avertissements).toEqual([]);
  });

  it("BLOQUE sur une exigence bloquante ABSENTE", () => {
    const verdict = verdictAffectation([exigence(B1V, true)], [], INTERVENTION);
    expect(verdict.bloquee).toBe(true);
    expect(verdict.bloquantes).toEqual([
      { habilitation_id: B1V, motif: "absente" },
    ]);
  });

  it("BLOQUE sur une exigence bloquante EXPIRÉE à la date d'intervention", () => {
    // La veille de l'intervention : la règle dit « antérieure », et elle l'est.
    const verdict = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, "2026-09-14")],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(true);
    expect(verdict.bloquantes).toEqual([
      { habilitation_id: B1V, motif: "expiree" },
    ]);
  });

  it("la BORNE du jour même : expirer LE jour de l'intervention laisse passer", () => {
    // « Antérieure à la date d'intervention » — une date égale ne l'est pas.
    // C'est le genre de borne qu'on décide une fois ou qu'on subit longtemps.
    const verdict = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, "2026-09-15")],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(false);
  });

  it("une expiration NULLE n'est pas une expiration — elle dit « n'expire pas »", () => {
    // Le piège de la colonne nullable : `null` se lit trop facilement comme
    // « pas de date valide », donc « expirée ». C'est l'inverse.
    const verdict = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, null)],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(false);
  });

  it("une exigence NON bloquante avertit et laisse passer", () => {
    const verdict = verdictAffectation(
      [exigence(CACES, false)],
      [],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(false);
    expect(verdict.avertissements).toEqual([
      { habilitation_id: CACES, motif: "absente" },
    ]);
    expect(verdict.bloquantes).toEqual([]);
  });

  it("les deux natures coexistent : une bloque, l'autre avertit", () => {
    // Le cas réel, et celui qui distingue ce verdict d'un booléen : l'appelant
    // doit pouvoir afficher les DEUX, et un booléen l'aurait obligé à refaire
    // le tri pour rendre un motif lisible (D50).
    const verdict = verdictAffectation(
      [exigence(B1V, true), exigence(CACES, false)],
      [detenue(B1V, "2026-01-01")],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(true);
    expect(verdict.bloquantes).toEqual([
      { habilitation_id: B1V, motif: "expiree" },
    ]);
    expect(verdict.avertissements).toEqual([
      { habilitation_id: CACES, motif: "absente" },
    ]);
  });

  it("un site SANS exigence ne bloque rien", () => {
    // Témoin de non-vacuité à l'envers : sans ce cas, un verdict qui bloquerait
    // toujours passerait tous les autres scénarios ci-dessus… sauf celui-ci.
    const verdict = verdictAffectation([], [detenue(B1V, null)], INTERVENTION);
    expect(verdict.bloquee).toBe(false);
    expect(verdict.avertissements).toEqual([]);
  });

  it("une habilitation détenue mais NON exigée n'intervient pas", () => {
    const verdict = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, null), detenue(CACES, "2020-01-01")],
      INTERVENTION,
    );
    expect(verdict.bloquee).toBe(false);
  });
});
