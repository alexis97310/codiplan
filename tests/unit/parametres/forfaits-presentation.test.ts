import { describe, expect, it } from "vitest";

import {
  phraseSansForfaitDeDeplacement,
  verdict,
} from "@/app/(back-office)/parametres/forfaits/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * LE CALCUL N'APPLIQUE QUE LE DÉPLACEMENT — le verdict le dit, pour les
 * TROIS AUTRES NATURES (PA-18, audit du 28/09/2026).
 *
 * *Aucune lecture neuve, aucun calcul changé* : `verdict` et
 * `phraseSansForfaitDeDeplacement` lisent la même `forfaitRetenu` que la
 * création d'intervention (`lib/interventions/depot.ts`) — elles ne font que
 * choisir QUOI EN DIRE selon la nature.
 */

type Forfait = {
  readonly id: string;
  readonly rang: number;
  readonly actif: boolean;
  readonly zone_geo: readonly string[] | null;
  readonly famille_id: string | null;
  readonly type_intervention: readonly string[] | null;
};

function forfait(partiel: Partial<Forfait> & { id: string }): Forfait {
  return {
    rang: 1,
    actif: true,
    zone_geo: null,
    famille_id: null,
    type_intervention: null,
    ...partiel,
  };
}

const CONDITIONS = { zone: "ducos", familleId: null, typeIntervention: null };

describe("verdict — trois verdicts pour le déplacement, un seul pour les autres natures", () => {
  it("un forfait de déplacement retenu reste « Retenu »", () => {
    const f = forfait({ id: "a" });
    expect(verdict("deplacement", f, "a", CONDITIONS)).toBe(
      t("forfaits.retenu"),
    );
  });

  it("un forfait de déplacement non retenu mais applicable reste « Applicable après »", () => {
    const f = forfait({ id: "a" });
    expect(verdict("deplacement", f, "autre-id", CONDITIONS)).toBe(
      t("forfaits.applicable_apres"),
    );
  });

  it("un forfait de déplacement écarté par ses conditions reste « Écarté »", () => {
    const f = forfait({ id: "a", zone_geo: ["kone"] });
    expect(verdict("deplacement", f, null, CONDITIONS)).toBe(
      t("forfaits.ecarte"),
    );
  });

  it.each(["prestation", "controle", "mise_en_service"] as const)(
    "un forfait « %s » actif et retenu par forfaitRetenu ne rend PAS « Retenu » — le calcul ne le sélectionne pas",
    (type) => {
      const f = forfait({ id: "a" });
      const rendu = verdict(type, f, "a", CONDITIONS);
      expect(rendu).not.toBe(t("forfaits.retenu"));
      expect(rendu).toBe(t("forfaits.non_applique"));
    },
  );

  it("un forfait inactif rend « Inactif » quelle que soit sa nature", () => {
    for (const type of [
      "deplacement",
      "prestation",
      "controle",
      "mise_en_service",
    ] as const) {
      const f = forfait({ id: "a", actif: false });
      expect(verdict(type, f, "a", CONDITIONS)).toBe(t("forfaits.inactif"));
    }
  });
});

describe("phraseSansForfaitDeDeplacement — la zone sans forfait de déplacement se dit (PA-19)", () => {
  it("rend la clé quand aucun déplacement actif n'est retenu pour la zone", () => {
    const catalogue = [
      forfait({ id: "a", rang: 1 }) as Forfait & { type: string },
    ].map((f) => ({ ...f, type: "prestation" }));
    expect(phraseSansForfaitDeDeplacement(catalogue, "ducos")).toBe(
      "forfaits.sans_deplacement",
    );
  });

  it("rend `null` quand un déplacement actif est retenu pour la zone", () => {
    const catalogue = [
      { ...forfait({ id: "a", rang: 1 }), type: "deplacement" },
    ];
    expect(phraseSansForfaitDeDeplacement(catalogue, "ducos")).toBeNull();
  });

  it("rend la clé quand le catalogue est vide", () => {
    expect(phraseSansForfaitDeDeplacement([], "ducos")).toBe(
      "forfaits.sans_deplacement",
    );
  });

  it("rend la clé quand le seul déplacement du catalogue est inactif", () => {
    const catalogue = [
      { ...forfait({ id: "a", rang: 1, actif: false }), type: "deplacement" },
    ];
    expect(phraseSansForfaitDeDeplacement(catalogue, "ducos")).toBe(
      "forfaits.sans_deplacement",
    );
  });
});
