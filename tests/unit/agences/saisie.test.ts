import { describe, expect, it } from "vitest";

import {
  schemaCreationAgence,
  schemaModificationAgence,
} from "@/lib/agences/saisie";

/**
 * LES RÈGLES DE SAISIE D'UNE AGENCE (AGENCE-1 ; CLAUDE.md §2 — Zod sur toute
 * entrée serveur, sans exception).
 *
 * ## Le constat que ce fichier ferme
 *
 * `grep -rn "agence.create|creerAgence" lib app scripts` ne rendait rien avant
 * ce lot : aucun chemin de création n'existait hors du semis. Ces règles sont
 * PURES — elles s'éprouvent sans base — et leur jumelle en base (l'unicité
 * `(societe_id, code)`, la contrainte `agence_territoire_iso_alpha2`, la
 * politique de cloisonnement) est éprouvée dans
 * `tests/isolation/ecriture-agences.test.ts`.
 *
 * ## D46 : le territoire n'est jamais le fuseau
 *
 * Les deux champs sont testés SÉPARÉMENT ci-dessous, et jamais l'un en
 * fonction de l'autre — c'est ce que
 * `tests/unit/calendar/territoire-independant-du-fuseau.test.ts` refuse déjà
 * au niveau du code source ; ce fichier l'éprouve au niveau du COMPORTEMENT de
 * la saisie.
 */

const MINIMALE = {
  code: "DUCOS",
  libelle: "Ducos",
  territoire: "NC",
};

describe("création d'une agence (AGENCE-1)", () => {
  it("accepte la saisie minimale — code, libellé, territoire", () => {
    const resultat = schemaCreationAgence.safeParse(MINIMALE);
    expect(resultat.success).toBe(true);
  });

  it("exige le code, le libellé et le territoire", () => {
    expect(schemaCreationAgence.safeParse({}).success).toBe(false);
    expect(
      schemaCreationAgence.safeParse({ libelle: "Ducos", territoire: "NC" })
        .success,
    ).toBe(false);
    expect(
      schemaCreationAgence.safeParse({ code: "DUCOS", territoire: "NC" })
        .success,
    ).toBe(false);
    expect(
      schemaCreationAgence.safeParse({ code: "DUCOS", libelle: "Ducos" })
        .success,
    ).toBe(false);
  });

  it("refuse un code ou un libellé vide ou fait de blancs", () => {
    for (const vide of ["", "   ", "\t\n"]) {
      expect(
        schemaCreationAgence.safeParse({ ...MINIMALE, code: vide }).success,
      ).toBe(false);
      expect(
        schemaCreationAgence.safeParse({ ...MINIMALE, libelle: vide }).success,
      ).toBe(false);
    }
  });

  describe("le territoire — ISO 3166-1 alpha-2, jamais déduit du fuseau (D46)", () => {
    it("accepte un code alpha-2 majuscule", () => {
      for (const territoire of ["NC", "FR", "QM"]) {
        expect(
          schemaCreationAgence.safeParse({ ...MINIMALE, territoire }).success,
          territoire,
        ).toBe(true);
      }
    });

    it("refuse un nom de territoire ou un fuseau déguisé en territoire", () => {
      for (const faux of [
        "NOUVELLE_CALEDONIE",
        "Nouvelle-Calédonie",
        "Pacific/Noumea",
        "nc",
        "FRA",
        "",
      ]) {
        expect(
          schemaCreationAgence.safeParse({ ...MINIMALE, territoire: faux })
            .success,
          faux,
        ).toBe(false);
      }
    });
  });

  describe("le fuseau — FACULTATIF, jamais dérivé du territoire (D5, D46)", () => {
    it("accepte un fuseau IANA connu", () => {
      const resultat = schemaCreationAgence.safeParse({
        ...MINIMALE,
        fuseau_horaire: "Pacific/Noumea",
      });
      expect(resultat.success).toBe(true);
      expect(resultat.success && resultat.data.fuseau_horaire).toBe(
        "Pacific/Noumea",
      );
    });

    it("vaut `null` quand il est omis — l'agence hérite du fuseau de la société (D5)", () => {
      const resultat = schemaCreationAgence.safeParse(MINIMALE);
      expect(resultat.success && resultat.data.fuseau_horaire).toBeNull();
    });

    it("accepte `null` explicitement", () => {
      const resultat = schemaCreationAgence.safeParse({
        ...MINIMALE,
        fuseau_horaire: null,
      });
      expect(resultat.success).toBe(true);
    });

    it("refuse un décalage numérique déguisé en fuseau", () => {
      for (const faux of ["UTC+11", "+11:00", "GMT+11"]) {
        expect(
          schemaCreationAgence.safeParse({ ...MINIMALE, fuseau_horaire: faux })
            .success,
          faux,
        ).toBe(false);
      }
    });

    it("refuse un fuseau inconnu du moteur", () => {
      expect(
        schemaCreationAgence.safeParse({
          ...MINIMALE,
          fuseau_horaire: "Pacific/Nulle-Part",
        }).success,
      ).toBe(false);
    });
  });

  it("l'agence naît active par défaut", () => {
    const resultat = schemaCreationAgence.safeParse(MINIMALE);
    expect(resultat.success && resultat.data.actif).toBe(true);
  });

  it("refuse une entrée qui n'a pas sa place — societe_id, id, calendrier_id, pas_creneau_minutes", () => {
    for (const champInterdit of [
      { societe_id: "0192f0a0-0000-7000-8000-000000000001" },
      { id: "0192f0a0-0000-7000-8000-000000000002" },
      { calendrier_id: "0192f0a0-0000-7000-8000-000000000003" },
      { pas_creneau_minutes: 15 },
    ]) {
      expect(
        schemaCreationAgence.safeParse({ ...MINIMALE, ...champInterdit })
          .success,
        JSON.stringify(champInterdit),
      ).toBe(false);
    }
  });
});

describe("modification d'une agence (AGENCE-1)", () => {
  it("accepte un objet vide — une modification partielle ne touche rien", () => {
    expect(schemaModificationAgence.safeParse({}).success).toBe(true);
  });

  it("accepte chaque champ seul", () => {
    expect(
      schemaModificationAgence.safeParse({ libelle: "Ducos rénové" }).success,
    ).toBe(true);
    expect(
      schemaModificationAgence.safeParse({ territoire: "FR" }).success,
    ).toBe(true);
    expect(
      schemaModificationAgence.safeParse({ fuseau_horaire: "Europe/Paris" })
        .success,
    ).toBe(true);
    expect(schemaModificationAgence.safeParse({ actif: false }).success).toBe(
      true,
    );
  });

  it("REFUSE `code` — la clé naturelle ne se modifie pas ici (voir l'en-tête de lib/agences/saisie.ts)", () => {
    expect(schemaModificationAgence.safeParse({ code: "AUTRE" }).success).toBe(
      false,
    );
  });

  it("refuse un libellé ou un territoire vide s'ils sont fournis", () => {
    expect(schemaModificationAgence.safeParse({ libelle: "" }).success).toBe(
      false,
    );
    expect(
      schemaModificationAgence.safeParse({ territoire: "nc" }).success,
    ).toBe(false);
  });
});
