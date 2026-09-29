import { describe, expect, it } from "vitest";

import {
  estRepriseDunImport,
  texteSansSegment,
} from "@/app/(back-office)/interventions/presentation";

/**
 * L'HISTORIQUE REPRIS D'UN IMPORT, ET LE TEXTE DE RÉALISATION QUAND IL N'Y A
 * RIEN À MONTRER (IN-23, audit du 28/09/2026) — même critère que
 * `chronologieDeLaFiche` (audit du 25/09, constat 22), extrait ici pour être
 * lu par la fiche SANS dupliquer le calcul.
 */
describe("estRepriseDunImport", () => {
  const creeLe = new Date("2026-09-22T08:00:00.000Z");

  it("un fait daté précède la création : reprise", () => {
    expect(
      estRepriseDunImport({
        creeLe,
        pauses: [],
        clotureeLe: new Date("2026-08-19T09:00:00.000Z"),
        annuleeLe: null,
      }),
    ).toBe(true);
  });

  it("aucun fait daté n'est antérieur à la création : pas une reprise", () => {
    expect(
      estRepriseDunImport({
        creeLe,
        pauses: [],
        clotureeLe: new Date("2026-09-25T09:00:00.000Z"),
        annuleeLe: null,
      }),
    ).toBe(false);
  });

  it("une pause antérieure à la création compte aussi", () => {
    expect(
      estRepriseDunImport({
        creeLe,
        pauses: [{ debut: new Date("2026-09-01T09:00:00.000Z"), fin: null }],
        clotureeLe: null,
        annuleeLe: null,
      }),
    ).toBe(true);
  });
});

describe("texteSansSegment", () => {
  it("clôturée : le texte sans « pas encore tourné »", () => {
    expect(texteSansSegment("cloturee")).toBe(
      "intervention.realisation.aucun_segment_termine",
    );
  });

  it("annulée : le même texte que clôturée", () => {
    expect(texteSansSegment("annulee")).toBe(
      "intervention.realisation.aucun_segment_termine",
    );
  });

  it("tout autre statut : la clé actuelle, inchangée", () => {
    expect(texteSansSegment("a_planifier")).toBe(
      "intervention.realisation.aucun_segment",
    );
    expect(texteSansSegment("planifiee")).toBe(
      "intervention.realisation.aucun_segment",
    );
  });
});
