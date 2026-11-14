import { describe, expect, it } from "vitest";

import {
  validerReponsePoint,
  type PointPourValidation,
} from "@/lib/checklists/validation-reponse";

/**
 * LA VALIDATION DES SIX TYPES DE RÉPONSE (9K18-CHECKLIST-DOMAINE, décision
 * d'Alexis du 10/11/2026 ~13h10 ; `photo` ajoutée à 9K28-CHECKLIST-REPONSE-
 * PHOTO). FONCTION PURE — le TYPE DU POINT est la source de vérité, jamais
 * un type auto-déclaré par la valeur brute.
 */

function point(partiel: Partial<PointPourValidation>): PointPourValidation {
  return {
    typeReponse: "conforme_non_conforme_sans_objet",
    choix: [],
    ...partiel,
  };
}

describe("conforme_non_conforme_sans_objet", () => {
  const POINT = point({ typeReponse: "conforme_non_conforme_sans_objet" });

  it.each(["conforme", "non_conforme", "sans_objet"] as const)(
    "accepte « %s » SEUL (sans détail), suite et commentaire restent `null`",
    (valeur) => {
      const verdict = validerReponsePoint(POINT, valeur);
      expect(verdict).toEqual({
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: valeur,
          suite: null,
          commentaire: null,
        },
      });
    },
  );

  it("refuse une valeur hors énumération", () => {
    const verdict = validerReponsePoint(POINT, "peut_etre");
    expect(verdict).toEqual({
      valide: false,
      cle: "checklist.refus.valeur_invalide",
    });
  });

  // 9L04I-CHECKLIST-NON-CONFORME-DETAIL — la suite à donner, le commentaire
  // et (par une autre voie, `enregistrerReponsePhoto`) les photos liées.
  describe("le détail non conforme (9L04I)", () => {
    it("accepte `non_conforme` avec suite ET commentaire, les DEUX facultatifs", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "non_conforme",
        suite: "piece_a_commander",
        commentaire: "Ne redémarre pas sous 6 bar",
      });
      expect(verdict).toEqual({
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: "non_conforme",
          suite: "piece_a_commander",
          commentaire: "Ne redémarre pas sous 6 bar",
        },
      });
    });

    it("accepte `non_conforme` avec SEULEMENT la suite", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "non_conforme",
        suite: "a_revoir",
      });
      expect(verdict).toEqual({
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: "non_conforme",
          suite: "a_revoir",
          commentaire: null,
        },
      });
    });

    it("accepte `non_conforme` avec SEULEMENT le commentaire", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "non_conforme",
        commentaire: "Fuite constatée",
      });
      expect(verdict).toEqual({
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: "non_conforme",
          suite: null,
          commentaire: "Fuite constatée",
        },
      });
    });

    it("refuse une suite sur `conforme` (detail_hors_non_conforme)", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "conforme",
        suite: "a_revoir",
      });
      expect(verdict).toEqual({
        valide: false,
        cle: "checklist.refus.detail_hors_non_conforme",
      });
    });

    it("refuse un commentaire sur `sans_objet` (detail_hors_non_conforme)", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "sans_objet",
        commentaire: "Hors sujet ici",
      });
      expect(verdict).toEqual({
        valide: false,
        cle: "checklist.refus.detail_hors_non_conforme",
      });
    });

    it("refuse une suite hors énumération", () => {
      const verdict = validerReponsePoint(POINT, {
        conforme: "non_conforme",
        suite: "autre_chose",
      });
      expect(verdict).toEqual({
        valide: false,
        cle: "checklist.refus.valeur_invalide",
      });
    });

    it("refuse un commentaire vide ou trop long", () => {
      expect(
        validerReponsePoint(POINT, {
          conforme: "non_conforme",
          commentaire: "   ",
        }).valide,
      ).toBe(false);
      expect(
        validerReponsePoint(POINT, {
          conforme: "non_conforme",
          commentaire: "x".repeat(501),
        }).valide,
      ).toBe(false);
      expect(
        validerReponsePoint(POINT, {
          conforme: "non_conforme",
          commentaire: "x".repeat(500),
        }).valide,
      ).toBe(true);
    });
  });
});

describe("valeur_mesuree", () => {
  const POINT = point({ typeReponse: "valeur_mesuree" });

  it("accepte un nombre fini", () => {
    expect(validerReponsePoint(POINT, 12.5)).toEqual({
      valide: true,
      saisie: { typeReponse: "valeur_mesuree", valeurMesuree: 12.5 },
    });
  });

  it("refuse une chaîne, NaN, et une valeur hors borne", () => {
    expect(validerReponsePoint(POINT, "12.5").valide).toBe(false);
    expect(validerReponsePoint(POINT, Number.NaN).valide).toBe(false);
    expect(validerReponsePoint(POINT, 1_000_000_000).valide).toBe(false);
  });
});

describe("case_faite", () => {
  const POINT = point({ typeReponse: "case_faite" });

  it("accepte `true`", () => {
    expect(validerReponsePoint(POINT, true)).toEqual({
      valide: true,
      saisie: { typeReponse: "case_faite", valeurFait: true },
    });
  });

  it("refuse `false` — une case non faite ne se répond pas, elle reste absente", () => {
    expect(validerReponsePoint(POINT, false).valide).toBe(false);
  });
});

describe("choix_dans_une_liste", () => {
  const POINT = point({
    typeReponse: "choix_dans_une_liste",
    choix: ["bon", "use", "a_remplacer"],
  });

  it("accepte un choix PARMI ceux du point", () => {
    expect(validerReponsePoint(POINT, "use")).toEqual({
      valide: true,
      saisie: { typeReponse: "choix_dans_une_liste", valeurChoix: "use" },
    });
  });

  it("refuse un choix HORS liste, nommément (choix_inconnu)", () => {
    expect(validerReponsePoint(POINT, "autre_chose")).toEqual({
      valide: false,
      cle: "checklist.refus.choix_inconnu",
    });
  });

  it("refuse une chaîne vide avant même de regarder la liste", () => {
    const verdict = validerReponsePoint(POINT, "");
    expect(verdict).toEqual({
      valide: false,
      cle: "checklist.refus.valeur_invalide",
    });
  });
});

describe("texte_libre", () => {
  const POINT = point({ typeReponse: "texte_libre" });

  it("accepte une chaîne non vide, et la nettoie (trim)", () => {
    expect(validerReponsePoint(POINT, "  Fuite constatée  ")).toEqual({
      valide: true,
      saisie: { typeReponse: "texte_libre", valeurTexte: "Fuite constatée" },
    });
  });

  it("refuse une chaîne vide ou trop longue", () => {
    expect(validerReponsePoint(POINT, "   ").valide).toBe(false);
    expect(validerReponsePoint(POINT, "x".repeat(2001)).valide).toBe(false);
    expect(validerReponsePoint(POINT, "x".repeat(2000)).valide).toBe(true);
  });
});

describe("photo (9K28-CHECKLIST-REPONSE-PHOTO)", () => {
  const POINT = point({ typeReponse: "photo" });

  it("refuse TOUJOURS, quelle que soit la valeur brute — même sans photo", () => {
    expect(validerReponsePoint(POINT, undefined)).toEqual({
      valide: false,
      cle: "checklist.refus.photo_hors_formulaire",
    });
    expect(validerReponsePoint(POINT, null)).toEqual({
      valide: false,
      cle: "checklist.refus.photo_hors_formulaire",
    });
  });

  it("refuse même une valeur qui aurait l'air plausible pour un autre type", () => {
    expect(validerReponsePoint(POINT, "conforme")).toEqual({
      valide: false,
      cle: "checklist.refus.photo_hors_formulaire",
    });
    expect(validerReponsePoint(POINT, 42)).toEqual({
      valide: false,
      cle: "checklist.refus.photo_hors_formulaire",
    });
  });
});
