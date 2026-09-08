import { describe, expect, it } from "vitest";

import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import {
  forfaitApplicable,
  schemaForfait,
  TYPES_FORFAIT,
  type ConditionsForfait,
  type ConditionsIntervention,
} from "@/lib/tarification/forfaits";

/**
 * RG-TAR-06 — « Un forfait ne s'applique que si ses conditions sont remplies —
 * zone, famille de matériel, type d'intervention. »
 *
 * Le cas qui décide de la justesse de cette règle n'est pas celui où une
 * condition échoue : c'est celui où il n'y en a PAS. Un forfait sans zone
 * s'applique partout, et le confondre avec « aucune zone ne convient »
 * retirerait du catalogue tous les forfaits généraux — c'est-à-dire la majorité.
 */

const SANS_CONDITION: ConditionsForfait = {
  zone_geo: null,
  famille_id: null,
  type_intervention: null,
};

const PARTOUT: ConditionsIntervention = {
  zone: "sud",
  familleId: "aaaaaaaa-0000-7000-8000-0000000000f0",
  typeIntervention: "curatif",
};

describe("RG-TAR-06 — l'absence de condition n'est pas une condition qui échoue", () => {
  it("un forfait sans aucune condition s'applique", () => {
    expect(forfaitApplicable(SANS_CONDITION, PARTOUT)).toBe(true);
  });

  it("il s'applique même quand l'intervention ne renseigne RIEN", () => {
    expect(
      forfaitApplicable(SANS_CONDITION, {
        zone: null,
        familleId: null,
        typeIntervention: null,
      }),
    ).toBe(true);
  });
});

describe("RG-TAR-06 — les trois axes sont conjoints", () => {
  it("la zone écarte le forfait quand elle ne figure pas dans la liste", () => {
    expect(
      forfaitApplicable(
        { ...SANS_CONDITION, zone_geo: ["nord", "iles"] },
        PARTOUT,
      ),
    ).toBe(false);
    expect(
      forfaitApplicable({ ...SANS_CONDITION, zone_geo: ["sud"] }, PARTOUT),
    ).toBe(true);
  });

  it("la famille écarte le forfait — un axe à valeur unique, pas une liste", () => {
    expect(
      forfaitApplicable(
        { ...SANS_CONDITION, famille_id: "une-autre" },
        PARTOUT,
      ),
    ).toBe(false);
    expect(
      forfaitApplicable(
        { ...SANS_CONDITION, famille_id: PARTOUT.familleId },
        PARTOUT,
      ),
    ).toBe(true);
  });

  it("le troisième axe DÉCIDE déjà, même si rien ne l'alimente encore", () => {
    // Le module est écrit entier ; c'est la DONNÉE qui manque (voir le registre
    // et le COMMENT ON de `forfait.type_intervention`). Ce scénario le montre :
    // le jour où le lot 2 posera des types, la règle n'aura pas à changer.
    expect(
      forfaitApplicable(
        { ...SANS_CONDITION, type_intervention: ["preventif"] },
        PARTOUT,
      ),
    ).toBe(false);
    expect(
      forfaitApplicable(
        { ...SANS_CONDITION, type_intervention: ["curatif", "preventif"] },
        PARTOUT,
      ),
    ).toBe(true);
  });

  it("UN SEUL axe non satisfait suffit à écarter le forfait", () => {
    expect(
      forfaitApplicable(
        {
          zone_geo: ["sud"],
          famille_id: PARTOUT.familleId,
          type_intervention: ["preventif"],
        },
        PARTOUT,
      ),
    ).toBe(false);
  });
});

describe("RG-TAR-06 — une condition qu'on ne peut pas vérifier n'est PAS remplie", () => {
  const cas = [
    ["zone", { ...SANS_CONDITION, zone_geo: ["sud"] }, { zone: null }],
    ["famille", { ...SANS_CONDITION, famille_id: "f" }, { familleId: null }],
    [
      "type d'intervention",
      { ...SANS_CONDITION, type_intervention: ["curatif"] },
      { typeIntervention: null },
    ],
  ] as const;

  it.each(cas)(
    "une %s absente face à une condition posée écarte le forfait",
    (_axe, forfait, manque) => {
      expect(
        forfaitApplicable(forfait, { ...PARTOUT, ...manque }),
        "on ne suppose pas ce qu'on ne sait pas : appliquer un forfait de zone " +
          "à une intervention dont la zone est inconnue facturerait un " +
          "déplacement que personne n'a constaté.",
      ).toBe(false);
    },
  );
});

describe("la saisie d'un forfait", () => {
  const valide = {
    code: "DEP-NORD",
    libelle: "Déplacement Nord",
    type: "deplacement",
    montant_mineur: 12000,
    cumulable_temps: true,
  };

  it("accepte un forfait minimal, et les trois axes y naissent NULS", () => {
    const lu = schemaForfait.parse(valide);
    expect(lu.zone_geo).toBeNull();
    expect(lu.famille_id).toBeNull();
    expect(lu.type_intervention).toBeNull();
    expect(lu.heures_incluses_minutes).toBeNull();
    expect(lu.actif).toBe(true);
  });

  it("accepte ZÉRO — une prestation offerte est un forfait à zéro", () => {
    expect(
      schemaForfait.parse({ ...valide, montant_mineur: 0 }).montant_mineur,
    ).toBe(0);
  });

  it("refuse un montant négatif — ce serait un avoir, pas un forfait", () => {
    expect(() =>
      schemaForfait.parse({ ...valide, montant_mineur: -1 }),
    ).toThrow();
  });

  it("refuse un montant FLOTTANT (I3 — les décimales sont à la devise)", () => {
    expect(() =>
      schemaForfait.parse({ ...valide, montant_mineur: 12000.5 }),
    ).toThrow();
  });

  it("refuse un tableau VIDE : « sans condition », c'est NULL et rien d'autre", () => {
    expect(() => schemaForfait.parse({ ...valide, zone_geo: [] })).toThrow();
  });

  it("refuse un doublon dans une condition", () => {
    expect(() =>
      schemaForfait.parse({ ...valide, zone_geo: ["sud", "sud"] }),
    ).toThrow();
  });

  it("refuse une zone inconnue — la MÊME liste que `site.zone_geo`", () => {
    expect(() =>
      schemaForfait.parse({ ...valide, zone_geo: ["koumac"] }),
    ).toThrow();
    // TÉMOIN : les six zones de D23 passent toutes, sans quoi ce refus ne
    // prouverait que l'existence d'un refus.
    expect(
      schemaForfait.parse({ ...valide, zone_geo: [...ZONES_GEOGRAPHIQUES] })
        .zone_geo,
    ).toHaveLength(ZONES_GEOGRAPHIQUES.length);
  });

  it("refuse un type de forfait hors des quatre natures", () => {
    expect(() => schemaForfait.parse({ ...valide, type: "autre" })).toThrow();
    for (const type of TYPES_FORFAIT) {
      expect(schemaForfait.parse({ ...valide, type }).type).toBe(type);
    }
  });

  it("refuse des heures incluses nulles ou négatives", () => {
    expect(() =>
      schemaForfait.parse({ ...valide, heures_incluses_minutes: 0 }),
    ).toThrow();
    expect(
      schemaForfait.parse({ ...valide, heures_incluses_minutes: 120 })
        .heures_incluses_minutes,
    ).toBe(120);
  });
});
