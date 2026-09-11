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

/**
 * LE CODE, PAS L'IDENTIFIANT — c'est ce que D73 veut lire dans un refus.
 *
 * *Le verdict rendait l'UUID seul, et l'écran l'affichait tel quel.* « habilitation
 * 0192f0a0-… absente » n'apprend rien à personne ; « habilitation BR absente »
 * dit ce qui manque et à qui le demander.
 */
const CODE = { [B1V]: "BR", [CACES]: "CACES R489" } as const;

const INTERVENTION = new Date("2026-09-15T00:00:00Z");

function exigence(habilitation_id: string, bloquant: boolean): ExigenceDuSite {
  return {
    habilitation_id,
    code: CODE[habilitation_id as keyof typeof CODE],
    bloquant,
  };
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
      { habilitation_id: B1V, code: "BR", motif: "absente" },
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
    // **LA DATE VOYAGE AVEC LE MOTIF, ET JAMAIS SANS LUI** (D56, L3-02) : D73
    // veut « habilitation CACES expirée le 12/08/2026 ». Une date seule ne dit
    // ni de quoi elle parle ni qu'elle est dépassée.
    expect(verdict.bloquantes).toEqual([
      {
        habilitation_id: B1V,
        code: "BR",
        motif: "expiree",
        expiraitLe: new Date("2026-09-14"),
      },
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
      { habilitation_id: CACES, code: "CACES R489", motif: "absente" },
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
      {
        habilitation_id: B1V,
        code: "BR",
        motif: "expiree",
        expiraitLe: new Date("2026-01-01"),
      },
    ]);
    expect(verdict.avertissements).toEqual([
      { habilitation_id: CACES, code: "CACES R489", motif: "absente" },
    ]);
  });

  it("une expiration NULLE ne porte JAMAIS de date de motif — le cas qui doit rester vert pour SA raison", () => {
    // §9 du 11/09 : *à côté de chaque cas qui doit rougir, un cas qui doit
    // rester vert POUR SA PROPRE RAISON.* Ici, le voisin qui lui ressemble est
    // « expirée » — même exigence, même technicien, un seul champ de
    // différence. Si `expireeLe` confondait « pas de date » et « date
    // dépassée », ce cas passerait en `expiree` avec `expiraitLe: null`, et le
    // type le refuse à la compilation autant que cette assertion à
    // l'exécution.
    const sansEcheance = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, null)],
      INTERVENTION,
    );
    const depassee = verdictAffectation(
      [exigence(B1V, true)],
      [detenue(B1V, "2026-09-14")],
      INTERVENTION,
    );
    expect(sansEcheance.bloquantes).toEqual([]);
    expect(depassee.bloquantes).toHaveLength(1);
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
