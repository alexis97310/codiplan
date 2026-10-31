import { describe, expect, it } from "vitest";

import { conditionsDeFacturation } from "@/lib/tarification/conditions";
import {
  REGLE_HISTORIQUE,
  REGLE_PAR_DEFAUT,
} from "@/lib/tarification/valorisation";

/**
 * LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-DE-
 * FACTURATION-SANS-MONTANT) — ce que le client lit sur l'écran de signature
 * et sur le bon, jamais combien. Voir le docblock de
 * `lib/tarification/conditions.ts`.
 */

const BASE = {
  libelleForfait: null,
  libelleForfaitDeplacement: null,
  majorationApplicable: false,
} as const;

describe("la règle du temps passé, en phrases — (60, 30, 5)", () => {
  it("dit la première heure, puis les tranches de 30 minutes dès 5 minutes", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_PAR_DEFAUT,
    });
    expect(lignes).toEqual([
      "Main-d'œuvre facturée au temps passé.",
      "La première heure est due dès la première minute ; au-delà, le temps se compte par tranches de 30 minutes, une tranche étant due à partir de 5 minutes passées dedans.",
    ]);
  });
});

describe("la règle du temps passé, en phrases — (60, 15, 1)", () => {
  it("dit la première heure, puis toute tranche de 15 minutes commencée", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_HISTORIQUE,
    });
    expect(lignes).toEqual([
      "Main-d'œuvre facturée au temps passé.",
      "La première heure est due dès la première minute ; au-delà, le temps se compte par tranches de 15 minutes, toute tranche commencée étant due.",
    ]);
  });
});

describe("un plancher différent de 60 minutes se nomme en toutes lettres", () => {
  it("« Les premières 90 minutes… » plutôt que « la première heure »", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: { plancherMinutes: 90, palierMinutes: 10, seuilPalierMinutes: 1 },
    });
    expect(lignes[1]).toBe(
      "Les premières 90 minutes sont dues dès la première minute ; au-delà, le temps se compte par tranches de 10 minutes, toute tranche commencée étant due.",
    );
  });
});

describe("le forfait", () => {
  it("nomme le forfait quand un libellé est connu", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "forfait",
      libelleForfait: "Révision annuelle",
      regle: REGLE_PAR_DEFAUT,
    });
    expect(lignes).toEqual([
      "Intervention facturée au forfait : Révision annuelle.",
    ]);
  });

  it("reste sans libellé quand aucun forfait de prestation n'est encore sélectionnable (mesuré, 9I8B)", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "forfait",
      regle: REGLE_PAR_DEFAUT,
    });
    expect(lignes).toEqual(["Intervention facturée au forfait."]);
  });

  it("« forfait plus heures » porte À LA FOIS le forfait et la règle du temps passé", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "forfait_plus_heures",
      libelleForfait: "Mise en service",
      regle: REGLE_PAR_DEFAUT,
    });
    expect(lignes).toEqual([
      "Main-d'œuvre facturée au temps passé.",
      "La première heure est due dès la première minute ; au-delà, le temps se compte par tranches de 30 minutes, une tranche étant due à partir de 5 minutes passées dedans.",
      "Intervention facturée au forfait : Mise en service.",
    ]);
  });
});

describe("le forfait de déplacement", () => {
  it("s'ajoute, nommé, quand il y en a un", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_PAR_DEFAUT,
      libelleForfaitDeplacement: "Zone urbaine",
    });
    expect(lignes).toContain("Déplacement : Zone urbaine.");
  });

  it("ne s'ajoute pas quand aucun n'est retenu", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_PAR_DEFAUT,
    });
    expect(lignes.some((ligne) => ligne.includes("Déplacement"))).toBe(false);
  });
});

describe("la majoration hors ouverture", () => {
  it("s'affiche, sans chiffre, quand elle s'applique", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_PAR_DEFAUT,
      majorationApplicable: true,
    });
    expect(lignes).toContain(
      "Intervention hors heures d'ouverture : majoration applicable selon nos conditions tarifaires.",
    );
  });

  it("ne s'affiche pas quand elle ne s'applique pas", () => {
    const lignes = conditionsDeFacturation({
      ...BASE,
      mode: "temps_passe",
      regle: REGLE_PAR_DEFAUT,
      majorationApplicable: false,
    });
    expect(lignes.some((ligne) => ligne.includes("majoration"))).toBe(false);
  });
});

describe("AUCUNE ligne ne porte jamais un montant", () => {
  /**
   * MÊME RÉGEX QUE LES ÉPREUVES E2E DU TERRAIN (`tests/e2e/
   * 9f4-terrain-enregistrement-auto.spec.ts`) — la forme que `formatMoney`
   * produit : chiffres groupés par milliers, espace insécable, devise.
   */
  const FORME_MONTANT = /\d[\d ]*(?:,\d+)? (?:XPF|€)/u;
  const SYMBOLES_DEVISE = /XPF|€|\$/u;

  const scenarios: ReadonlyArray<
    Parameters<typeof conditionsDeFacturation>[0]
  > = [
    { ...BASE, mode: "temps_passe", regle: REGLE_PAR_DEFAUT },
    { ...BASE, mode: "temps_passe", regle: REGLE_HISTORIQUE },
    {
      ...BASE,
      mode: "forfait",
      libelleForfait: "Forfait VIP — 5000 points fidélité",
      regle: REGLE_PAR_DEFAUT,
    },
    {
      ...BASE,
      mode: "forfait_plus_heures",
      libelleForfait: "Contrat annuel",
      libelleForfaitDeplacement: "Zone éloignée",
      regle: REGLE_PAR_DEFAUT,
      majorationApplicable: true,
    },
  ];

  it.each(scenarios)("scénario %#", (entree) => {
    const lignes = conditionsDeFacturation(entree);
    for (const ligne of lignes) {
      expect(ligne).not.toMatch(FORME_MONTANT);
      expect(ligne).not.toMatch(SYMBOLES_DEVISE);
    }
  });

  // MESURÉ (9I8B) : un libellé de forfait LIBRE peut contenir un chiffre qui
  // RESSEMBLE à un montant sans en être un (ex. « Forfait VIP — 5000 points
  // fidélité » ci-dessus) — c'est le texte du catalogue, jamais un montant
  // calculé par ce module. Le scénario ci-dessus le mesure : il ne porte ni
  // de code de devise ni la forme exacte de `formatMoney`, ce qui suffit à
  // ce que ce module garantit — il ne lui est pas demandé de deviner qu'un
  // libellé saisi ailleurs ne contient aucun chiffre.
});
