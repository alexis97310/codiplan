import { describe, expect, it } from "vitest";

import {
  schemaAttributionHabilitation,
  schemaCreationHabilitation,
  schemaExigenceSite,
} from "../../../lib/habilitations/saisie";

/**
 * L'ENTRÉE SERVEUR DES HABILITATIONS (ticket L1-04 ; D9, D60).
 *
 * Ce fichier garde surtout une DÉCISION : contrairement aux zones (L1-02) et
 * aux rôles de contact (L1-03), **rien n'est clos ici**.
 */

const HABILITATION = "0192f0a0-1000-7000-8000-000000000001";
const UTILISATEUR = "0192f0a0-1000-7000-8000-000000000002";
const SITE = "0192f0a0-1000-7000-8000-000000000003";

describe("le code d'une habilitation est du TEXTE LIBRE, et c'est D60", () => {
  it("accepte un code réglementaire ET un code maison", () => {
    // « B1V » vient de la NF C 18-510 ; « PRESSE-4T » ne vient de nulle part.
    // Les deux passent, et c'est le point : une société suit des qualifications
    // qu'aucune nomenclature ne connaît.
    expect(
      schemaCreationHabilitation.safeParse({
        code: "B1V",
        libelle: "Travaux d'ordre électrique basse tension",
      }).success,
    ).toBe(true);
    expect(
      schemaCreationHabilitation.safeParse({
        code: "PRESSE-4T",
        libelle: "Formé sur presse 4 tonnes",
      }).success,
    ).toBe(true);
  });

  it("refuse un code vide — le seul refus de contenu", () => {
    expect(
      schemaCreationHabilitation.safeParse({ code: "  ", libelle: "x" })
        .success,
    ).toBe(false);
  });

  it("la durée de validité est FACULTATIVE, et son absence dit « n'expire pas »", () => {
    const lu = schemaCreationHabilitation.parse({
      code: "B0",
      libelle: "Exécutant non électricien",
    });
    expect(lu.duree_validite_mois).toBeNull();
  });

  it("refuse une durée nulle ou négative — zéro compris", () => {
    // Une habilitation valable zéro mois est expirée le jour où on l'obtient.
    for (const duree of [0, -1]) {
      expect(
        schemaCreationHabilitation.safeParse({
          code: "B1",
          libelle: "x",
          duree_validite_mois: duree,
        }).success,
      ).toBe(false);
    }
  });
});

describe("l'attribution — les dates, et le sens de leur absence", () => {
  it("accepte une habilitation SANS expiration", () => {
    const lu = schemaAttributionHabilitation.parse({
      utilisateur_id: UTILISATEUR,
      habilitation_id: HABILITATION,
      date_obtention: "2026-01-01",
    });
    expect(lu.date_expiration).toBeNull();
  });

  it("refuse une expiration ANTÉRIEURE à l'obtention", () => {
    const lu = schemaAttributionHabilitation.safeParse({
      utilisateur_id: UTILISATEUR,
      habilitation_id: HABILITATION,
      date_obtention: "2026-06-01",
      date_expiration: "2026-01-01",
    });
    expect(lu.success).toBe(false);
    if (!lu.success) {
      // Le message porte sur le CHAMP fautif : un refus qui ne dit pas où
      // regarder oblige à deviner.
      expect(
        lu.error.issues.some((issue) => issue.path.includes("date_expiration")),
      ).toBe(true);
    }
  });

  it("accepte une expiration LE JOUR de l'obtention", () => {
    expect(
      schemaAttributionHabilitation.safeParse({
        utilisateur_id: UTILISATEUR,
        habilitation_id: HABILITATION,
        date_obtention: "2026-01-01",
        date_expiration: "2026-01-01",
      }).success,
    ).toBe(true);
  });
});

describe("l'exigence de site — le défaut BLOQUE", () => {
  it("`bloquant` vaut true quand on ne le dit pas", () => {
    // Le défaut sûr est celui qui refuse : une exigence qu'on oublie de
    // qualifier doit bloquer, jamais avertir. Le même défaut est en base.
    const lu = schemaExigenceSite.parse({
      site_id: SITE,
      habilitation_id: HABILITATION,
    });
    expect(lu.bloquant).toBe(true);
  });

  it("et il se dit `false` explicitement", () => {
    const lu = schemaExigenceSite.parse({
      site_id: SITE,
      habilitation_id: HABILITATION,
      bloquant: false,
    });
    expect(lu.bloquant).toBe(false);
  });
});
