import { describe, expect, it } from "vitest";

import {
  cleDuPointReleve,
  dernierReleveParCle,
  type ReleveHistorique,
} from "@/lib/checklists/dernier-releve";

/**
 * LE DERNIER RELEVÉ (9L08F-CHECKLIST-DERNIER-RELEVE) — FONCTION PURE
 * d'appariement, séparée de `lib/checklists/depot.ts` qui lit la base (voir
 * l'en-tête du module) : la clé de correspondance, l'absence, et « plusieurs
 * interventions antérieures → la plus récente ».
 */

function releve(partiel: Partial<ReleveHistorique>): ReleveHistorique {
  return {
    libelle: "Pression",
    section: "Mesures",
    valeurMesuree: 6,
    unite: "bar",
    reponduLe: new Date("2026-01-01T00:00:00Z"),
    ...partiel,
  };
}

describe("cleDuPointReleve", () => {
  it("distingue deux points de même libellé mais de section différente", () => {
    expect(cleDuPointReleve("Sécurité", "Pression")).not.toBe(
      cleDuPointReleve("Esthétique", "Pression"),
    );
  });

  it("distingue deux points de même section mais de libellé différent", () => {
    expect(cleDuPointReleve("Mesures", "Pression avant")).not.toBe(
      cleDuPointReleve("Mesures", "Pression arrière"),
    );
  });
});

describe("dernierReleveParCle", () => {
  it("une liste vide ne donne aucun relevé", () => {
    expect(dernierReleveParCle([]).size).toBe(0);
  });

  it("garde la PREMIÈRE occurrence de chaque clé — l'appelant trie déjà par date décroissante", () => {
    const releves = dernierReleveParCle([
      releve({
        valeurMesuree: 6.2,
        reponduLe: new Date("2026-06-01T00:00:00Z"),
      }),
      releve({
        valeurMesuree: 5.5,
        reponduLe: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);
    expect(releves.get(cleDuPointReleve("Mesures", "Pression"))).toEqual({
      valeur: 6.2,
      unite: "bar",
      date: new Date("2026-06-01T00:00:00Z"),
    });
  });

  it("deux points DISTINCTS (sections différentes) ont chacun leur propre dernier relevé", () => {
    const releves = dernierReleveParCle([
      releve({ section: "Sécurité", valeurMesuree: 2 }),
      releve({ section: "Esthétique", valeurMesuree: 9 }),
    ]);
    expect(releves.get(cleDuPointReleve("Sécurité", "Pression"))?.valeur).toBe(
      2,
    );
    expect(
      releves.get(cleDuPointReleve("Esthétique", "Pression"))?.valeur,
    ).toBe(9);
  });

  it("une clé absente de la liste n'a aucun relevé — jamais une valeur devinée", () => {
    const releves = dernierReleveParCle([releve({})]);
    expect(releves.get(cleDuPointReleve("Mesures", "Autre point"))).toBe(
      undefined,
    );
  });
});
