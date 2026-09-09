import { describe, expect, it } from "vitest";

import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import {
  forfaitApplicable,
  forfaitRetenu,
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
    rang: 1,
    montant_mineur: 12000,
    cumulable_temps: true,
  };

  it("accepte un forfait minimal, et les trois axes y naissent NULS", () => {
    const lu = schemaForfait.parse(valide);
    expect(lu.zone_geo).toBeNull();
    expect(lu.famille_id).toBeNull();
    expect(lu.type_intervention).toBeNull();
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

  it("N'ADMET PLUS d'heures incluses — un forfait s'ajoute toujours aux heures", () => {
    // Arbitrage du 09/09/2026 (Q4) : un forfait est un montant fixe qui vient
    // EN PLUS du temps passé ; il n'absorbe aucune heure, et la notion d'heure
    // excédentaire ne s'applique pas à lui. La colonne qui modélisait le cas
    // inverse a été retirée — *une colonne qui modélise un cas qui n'existe pas
    // est pire qu'une colonne absente*.
    const lu = schemaForfait.parse({
      ...valide,
      heures_incluses_minutes: 120,
    }) as Record<string, unknown>;
    expect(lu.heures_incluses_minutes).toBeUndefined();
  });
});

/**
 * LA FORME QUE LA BASE REND, ET CELLE QUE LA SAISIE ÉCRIT (09/09/2026).
 *
 * Zod écrit `null` pour « aucune condition ». **La base ne le peut pas** : une
 * liste scalaire PostgreSQL n'est pas nullable, Prisma rend toujours un
 * `String[]`, et l'absence de condition y est le tableau VIDE. La règle ne
 * lisait que la première forme — mesuré : le forfait général, celui que ce
 * module documente comme le cas le plus courant, ne s'appliquait JAMAIS par le
 * chemin de production.
 */
describe("les deux écritures de « aucune condition »", () => {
  const TELLE_QUE_LA_BASE_REND: ConditionsForfait = {
    zone_geo: [],
    famille_id: null,
    type_intervention: [],
  };

  it("le tableau VIDE vaut « aucune condition », comme le null", () => {
    expect(forfaitApplicable(TELLE_QUE_LA_BASE_REND, PARTOUT)).toBe(true);
  });

  it("et il s'applique même quand l'intervention ne sait rien", () => {
    // Sans condition, il n'y a rien à vérifier : c'est le forfait général.
    expect(
      forfaitApplicable(TELLE_QUE_LA_BASE_REND, {
        zone: null,
        familleId: null,
        typeIntervention: null,
      }),
    ).toBe(true);
  });

  it("mais une liste NON vide reste une condition — le vert doit être mérité", () => {
    // Le cas qui doit rester ROUGE à côté du cas qui doit rester vert : sans
    // lui, « tout est satisfait » passerait pour la règle (§9, 11/09).
    expect(
      forfaitApplicable(
        { ...TELLE_QUE_LA_BASE_REND, zone_geo: ["nord"] },
        PARTOUT,
      ),
    ).toBe(false);
  });
});

/**
 * D86 — LE RANG DÉCIDE, ET L'ORDRE DES LIGNES NE DÉCIDE PLUS RIEN.
 */
describe("le forfait retenu quand plusieurs s'appliquent", () => {
  const GENERAL = { id: "b", rang: 20, ...SANS_CONDITION };
  const SUD = { id: "a", rang: 10, ...SANS_CONDITION, zone_geo: ["sud"] };
  const NORD = { id: "c", rang: 5, ...SANS_CONDITION, zone_geo: ["nord"] };

  it("le PLUS PETIT rang applicable l'emporte", () => {
    // NORD a le plus petit rang mais ne s'applique pas : c'est bien parmi les
    // APPLICABLES que le rang décide, et non parmi tous.
    expect(forfaitRetenu([NORD, GENERAL, SUD], PARTOUT)?.id).toBe("a");
  });

  it("le général l'emporte quand aucun forfait de zone ne convient", () => {
    expect(
      forfaitRetenu([NORD, GENERAL, SUD], { ...PARTOUT, zone: "iles" })?.id,
    ).toBe("b");
  });

  it("rend null quand aucun ne s'applique", () => {
    expect(forfaitRetenu([NORD, SUD], { ...PARTOUT, zone: "iles" })).toBeNull();
  });

  /**
   * LE JUMEAU DEMANDÉ PAR L'EXPLOITATION : deux forfaits qui se recouvrent,
   * facturation IDENTIQUE quel que soit l'ordre de création des lignes.
   *
   * Les six permutations sont jouées, et pas seulement deux : c'est l'ensemble
   * des ordres possibles, donc la propriété est démontrée et non échantillonnée.
   */
  it("le résultat ne dépend d'AUCUN ordre des lignes", () => {
    const permutations = [
      [GENERAL, SUD, NORD],
      [GENERAL, NORD, SUD],
      [SUD, GENERAL, NORD],
      [SUD, NORD, GENERAL],
      [NORD, GENERAL, SUD],
      [NORD, SUD, GENERAL],
    ];
    const retenus = permutations.map((p) => forfaitRetenu(p, PARTOUT)?.id);
    expect(retenus).toEqual(["a", "a", "a", "a", "a", "a"]);

    // TÉMOIN : sans lui, une règle qui rendrait toujours `null` passerait ce
    // scénario — six fois la même absence est aussi une égalité.
    expect(new Set(retenus).size).toBe(1);
    expect(retenus[0]).toBe("a");
  });

  it("l'ordre d'ALPHABET, lui, aurait donné un autre forfait", () => {
    // La mesure de ce que D86 change : `orderBy code` — ici l'ordre des `id` —
    // aurait retenu « a » par hasard ; en renommant, il retient « b ».
    const parAlphabet = [GENERAL, SUD]
      .filter((f) => forfaitApplicable(f, PARTOUT))
      .sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(parAlphabet[0]?.id).toBe("a");
    const renommes = [
      { ...GENERAL, id: "aa" },
      { ...SUD, id: "zz" },
    ];
    expect(
      renommes
        .filter((f) => forfaitApplicable(f, PARTOUT))
        .sort((x, y) => (x.id < y.id ? -1 : 1))[0]?.id,
      "l'alphabet a changé de gagnant sans qu'aucun tarif ne change",
    ).toBe("aa");
    // Le rang, lui, ne bouge pas : c'est toute la décision.
    expect(forfaitRetenu(renommes, PARTOUT)?.id).toBe("zz");
  });

  it("un rang dupliqué ne rend pas l'arbitraire invisible", () => {
    // La base l'interdit ; si une restauration l'avait perdu, la règle reste
    // DÉTERMINISTE plutôt que dépendante de l'ordre de la requête.
    const ex_aequo = [
      { ...GENERAL, id: "z", rang: 10 },
      { ...SUD, id: "a", rang: 10 },
    ];
    expect(forfaitRetenu(ex_aequo, PARTOUT)?.id).toBe("a");
    expect(forfaitRetenu([...ex_aequo].reverse(), PARTOUT)?.id).toBe("a");
  });
});

describe("le rang à la saisie", () => {
  const valide = {
    code: "DEP-NORD",
    libelle: "Déplacement Nord",
    type: "deplacement",
    montant_mineur: 12000,
    cumulable_temps: true,
  };

  it("est OBLIGATOIRE — aucun défaut ne se déguise en décision", () => {
    expect(() => schemaForfait.parse(valide)).toThrow();
  });

  it("refuse zéro et le négatif : « 1 » se lit « le premier »", () => {
    expect(() => schemaForfait.parse({ ...valide, rang: 0 })).toThrow();
    expect(() => schemaForfait.parse({ ...valide, rang: -1 })).toThrow();
    expect(schemaForfait.parse({ ...valide, rang: 1 }).rang).toBe(1);
  });
});
