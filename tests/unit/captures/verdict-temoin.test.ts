import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";

import {
  type EcranTemoin,
  verdictDuTemoin,
} from "../../../scripts/lib/verdict-temoin";

/**
 * LE VERDICT D'UN TÉMOIN, ÉPROUVÉ SANS NAVIGATEUR (99O-CAPTURES-TEMOIN).
 *
 * `arrivee` et `arrivee-sans-societe` visitent le même chemin et partageaient
 * un seul témoin, « Choisir la société » — présent sur les DEUX écrans,
 * puisque `Choix` se rend dès qu'un compte porte au moins une société, active
 * ou non. Mesuré au `cmp` : les images produites sous ces deux noms étaient
 * identiques à l'octet près. Ces scénarios composent leurs pages depuis le
 * dictionnaire (`t()`), jamais en dur — un libellé qui change ne doit pas
 * rendre ce gardien aveugle en silence.
 */

const ARRIVEE: EcranTemoin = {
  nom: "arrivee",
  chemin: "/arrivee",
  temoin: "société",
};

const ARRIVEE_SANS_SOCIETE: EcranTemoin = {
  nom: "arrivee-sans-societe",
  chemin: "/arrivee",
  temoin: "Choisir la société",
};

/** Le corps d'une page « société active » : un lien d'entrée, un bouton. */
function pageAvecSocieteActive(): string {
  return [
    t("arrivee.compte"),
    t("arrivee.societe"),
    t("arrivee.entrer.planning"),
    t("arrivee.choix.titre"),
    t("arrivee.choix.active"),
    t("arrivee.choix.activer"),
  ].join("\n");
}

/** Le corps d'une page « aucune société active » : deux boutons, pas de lien. */
function pageSansSocieteActive(nombreBoutons: number): string {
  return [
    t("arrivee.compte"),
    t("arrivee.sans_societe"),
    t("arrivee.choix.titre"),
    ...Array.from({ length: nombreBoutons }, () => t("arrivee.choix.activer")),
  ].join("\n");
}

describe("verdictDuTemoin — arrivee-sans-societe", () => {
  it("REFUSE une page « société active » (elle porte le lien du planning)", () => {
    const verdict = verdictDuTemoin({
      corps: pageAvecSocieteActive(),
      cheminAtteint: "/arrivee",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict.verdict).toBe("refuse");
    if (verdict.verdict !== "refuse") return;
    expect(verdict.motif).toContain(t("arrivee.entrer.planning"));
  });

  it("REFUSE un seul bouton « Travailler sur cette société »", () => {
    const verdict = verdictDuTemoin({
      corps: pageSansSocieteActive(1),
      cheminAtteint: "/arrivee",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict.verdict).toBe("refuse");
    if (verdict.verdict !== "refuse") return;
    expect(verdict.motif).toContain(t("arrivee.choix.activer"));
  });

  it("REFUSE quand le chemin atteint n'est pas /arrivee", () => {
    const verdict = verdictDuTemoin({
      corps: pageSansSocieteActive(2),
      cheminAtteint: "/planning",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict.verdict).toBe("refuse");
    if (verdict.verdict !== "refuse") return;
    expect(verdict.motif).toContain("/planning");
  });

  it("ACCEPTE deux boutons, pas de lien du planning, chemin /arrivee", () => {
    const verdict = verdictDuTemoin({
      corps: pageSansSocieteActive(2),
      cheminAtteint: "/arrivee",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict).toEqual({ verdict: "accepte" });
  });

  it("ACCEPTE au-delà de deux boutons — le plancher n'est pas un plafond", () => {
    const verdict = verdictDuTemoin({
      corps: pageSansSocieteActive(3),
      cheminAtteint: "/arrivee",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict).toEqual({ verdict: "accepte" });
  });

  it("REFUSE quand le témoin lui-même est absent", () => {
    const verdict = verdictDuTemoin({
      corps: t("connexion.email"),
      cheminAtteint: "/connexion",
      ecran: ARRIVEE_SANS_SOCIETE,
    });
    expect(verdict.verdict).toBe("refuse");
    if (verdict.verdict !== "refuse") return;
    expect(verdict.motif).toContain("Choisir la société");
  });
});

describe("verdictDuTemoin — arrivee (avec société active)", () => {
  it("ACCEPTE une page « société active » sur /arrivee", () => {
    const verdict = verdictDuTemoin({
      corps: pageAvecSocieteActive(),
      cheminAtteint: "/arrivee",
      ecran: ARRIVEE,
    });
    expect(verdict).toEqual({ verdict: "accepte" });
  });

  it("REFUSE quand le chemin atteint n'est pas celui déclaré", () => {
    const verdict = verdictDuTemoin({
      corps: pageAvecSocieteActive(),
      cheminAtteint: "/tableau-de-bord",
      ecran: ARRIVEE,
    });
    expect(verdict.verdict).toBe("refuse");
  });
});

describe("verdictDuTemoin — un écran ordinaire, sans règle propre à l'arrivée", () => {
  const PLANNING: EcranTemoin = {
    nom: "planning",
    chemin: "/planning",
    temoin: "Planning",
  };

  it("ACCEPTE quand le témoin est présent, quel que soit le chemin atteint", () => {
    // Seuls `arrivee` et `arrivee-sans-societe` portent le contrôle de
    // chemin (99O) : les écrans à `decouvrir` naviguent légitimement
    // ailleurs que leur `chemin` déclaré.
    const verdict = verdictDuTemoin({
      corps: "Planning de la semaine",
      cheminAtteint: "/planning?vue=jour",
      ecran: PLANNING,
    });
    expect(verdict).toEqual({ verdict: "accepte" });
  });

  it("REFUSE quand le témoin est absent", () => {
    const verdict = verdictDuTemoin({
      corps: t("connexion.email"),
      cheminAtteint: "/connexion",
      ecran: PLANNING,
    });
    expect(verdict.verdict).toBe("refuse");
  });
});
