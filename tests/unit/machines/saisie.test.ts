import { describe, expect, it } from "vitest";

import {
  BORNE_ANNEE_FABRICATION_MAX,
  BORNE_ANNEE_FABRICATION_MIN,
  PREFIXE_SERIE_INCONNUE,
  schemaMachine,
  serieInconnue,
} from "@/lib/machines/saisie";

/**
 * LA SAISIE D'UNE FICHE MACHINE — D6, et le trou qu'elle ferme (ticket L2-01).
 *
 * D6 corrige le guide : **quatre champs obligatoires, et non trois.** Le numéro
 * de série redevient obligatoire, ce qui rend l'unicité définissable et
 * supprime le risque de doublons silencieux au recensement.
 */

const valide = {
  modele_id: "01a08000-0000-7000-8000-000000000001",
  client_id: "01a08000-0000-7000-8000-000000000002",
  site_id: "01a08000-0000-7000-8000-000000000003",
  numero_serie: "SN-12345",
};

describe("les QUATRE champs obligatoires — D6", () => {
  it("accepte une fiche minimale, et le reste y naît nul", () => {
    const lu = schemaMachine.parse(valide);
    expect(lu.numero_serie).toBe("SN-12345");
    expect(lu.localisation).toBeNull();
    expect(lu.date_mise_en_service).toBeNull();
    expect(lu.statut).toBe("en_service");
    expect(lu.criticite).toBe("normale");
  });

  it.each(["modele_id", "client_id", "site_id", "numero_serie"] as const)(
    "refuse une fiche sans « %s »",
    (champ) => {
      const ampute: Record<string, unknown> = { ...valide };
      delete ampute[champ];
      expect(() => schemaMachine.parse(ampute)).toThrow();
    },
  );

  it("refuse un numéro de série VIDE — le NULL déguisé", () => {
    // Une chaîne vide serait le NULL que D6 refuse, sous un autre nom : elle
    // ferait de l'unicité une passoire par le bas.
    expect(() =>
      schemaMachine.parse({ ...valide, numero_serie: "   " }),
    ).toThrow();
  });
});

describe("le numéro ILLISIBLE est un cas, pas un trou", () => {
  it("`SN-INCONNU-…` marque la fiche INCOMPLÈTE", () => {
    const lu = schemaMachine.parse({
      ...valide,
      numero_serie: `${PREFIXE_SERIE_INCONNUE}REF-77`,
    });
    expect(lu.complet).toBe(false);
    // Et le numéro reste une VALEUR : c'est elle qui porte l'unicité.
    expect(lu.numero_serie).toBe(`${PREFIXE_SERIE_INCONNUE}REF-77`);
  });

  it("une plaque lisible donne une fiche COMPLÈTE", () => {
    expect(schemaMachine.parse(valide).complet).toBe(true);
  });

  it("`complet` est DÉDUIT, jamais accepté depuis l'entrée", () => {
    // Deux sources d'un même fait divergent en silence (§9, 01/09) : celle-ci
    // se calcule. Le forcer à `true` sur une plaque illisible ne doit rien
    // changer.
    const lu = schemaMachine.parse({
      ...valide,
      numero_serie: `${PREFIXE_SERIE_INCONNUE}REF-99`,
      complet: true,
    } as Record<string, unknown>);
    expect(lu.complet).toBe(false);
  });

  it("la reconnaissance ne TOLÈRE rien — la casse compte", () => {
    // Une tolérance choisirait à la place de celui qui a saisi : « sn-inconnu- »
    // en minuscules est un numéro de série ordinaire.
    expect(serieInconnue("sn-inconnu-REF")).toBe(false);
    expect(serieInconnue(`  ${PREFIXE_SERIE_INCONNUE}REF `)).toBe(true);
  });
});

describe("ce que la saisie NE fabrique PAS", () => {
  it("ni `id`, ni `qr_token`, ni `numero`", () => {
    // D7 / I10 : l'`id` est un UUID v7 généré SUR L'APPAREIL, le `qr_token` en
    // est dérivé, et `numero` est attribué par le SERVEUR à la première
    // synchronisation. Les trois appartiennent au chemin qui écrit.
    const lu = schemaMachine.parse({
      ...valide,
      id: "01a08000-0000-7000-8000-0000000000ff",
      qr_token: "jeton-choisi-par-le-client",
      numero: 42,
    } as Record<string, unknown>);
    const champs = Object.keys(lu);
    expect(champs).not.toContain("id");
    expect(champs).not.toContain("qr_token");
    expect(champs).not.toContain("numero");
  });
});

describe("l'année de fabrication (plaque) — 9I8C", () => {
  it("absente, la fiche naît avec `null`", () => {
    expect(schemaMachine.parse(valide).annee_fabrication).toBeNull();
  });

  it("une chaîne vide est acceptée comme une absence", () => {
    expect(
      schemaMachine.parse({ ...valide, annee_fabrication: "" })
        .annee_fabrication,
    ).toBeNull();
  });

  it("une année valide est enregistrée", () => {
    expect(
      schemaMachine.parse({ ...valide, annee_fabrication: "1999" })
        .annee_fabrication,
    ).toBe(1999);
  });

  it("refuse une année sous la borne basse", () => {
    expect(() =>
      schemaMachine.parse({
        ...valide,
        annee_fabrication: String(BORNE_ANNEE_FABRICATION_MIN - 1),
      }),
    ).toThrow();
  });

  it("refuse une année au-delà de la borne haute", () => {
    expect(() =>
      schemaMachine.parse({
        ...valide,
        annee_fabrication: String(BORNE_ANNEE_FABRICATION_MAX + 1),
      }),
    ).toThrow();
  });

  it("accepte les deux bornes, incluses", () => {
    expect(
      schemaMachine.parse({
        ...valide,
        annee_fabrication: String(BORNE_ANNEE_FABRICATION_MIN),
      }).annee_fabrication,
    ).toBe(BORNE_ANNEE_FABRICATION_MIN);
    expect(
      schemaMachine.parse({
        ...valide,
        annee_fabrication: String(BORNE_ANNEE_FABRICATION_MAX),
      }).annee_fabrication,
    ).toBe(BORNE_ANNEE_FABRICATION_MAX);
  });

  it("refuse un texte qui n'est pas un nombre", () => {
    expect(() =>
      schemaMachine.parse({ ...valide, annee_fabrication: "mille-neuf" }),
    ).toThrow();
  });
});

describe("les énumérations sont closes", () => {
  it("refuse un statut hors des cinq", () => {
    expect(() =>
      schemaMachine.parse({ ...valide, statut: "en_reparation" }),
    ).toThrow();
    expect(
      schemaMachine.parse({ ...valide, statut: "ferraillee" }).statut,
    ).toBe("ferraillee");
  });

  it("refuse une criticité et une source hors des listes", () => {
    expect(() =>
      schemaMachine.parse({ ...valide, criticite: "urgente" }),
    ).toThrow();
    expect(() =>
      schemaMachine.parse({ ...valide, source_creation: "api" }),
    ).toThrow();
  });
});
