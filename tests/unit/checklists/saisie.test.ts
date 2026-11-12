import { describe, expect, it } from "vitest";

import {
  schemaModeleChecklist,
  schemaPointChecklist,
  schemaVersionChecklist,
} from "@/lib/checklists/saisie";

/**
 * SAISIE DU PARAMÉTRAGE DES CHECKLISTS (9K19-CHECKLIST-PARAMETRAGE, CK3).
 *
 * `schemaModeleChecklist` et `schemaPointChecklist` rendent EXACTEMENT les
 * types `SaisieModeleChecklist`/`SaisiePointChecklist` de
 * `lib/checklists/depot.ts` — aucune traduction de casse entre la route et
 * le dépôt (voir l'en-tête de `lib/checklists/saisie.ts`). L'exclusivité des
 * trois rattachements (D238) n'est PAS répétée ici : la base la tient par
 * une contrainte CHECK, et les épreuves d'isolation (`tests/isolation/
 * checklist-parametrage.test.ts`) l'éprouvent par le dépôt réel.
 */
describe("schemaModeleChecklist", () => {
  it("accepte une saisie minimale — tous les rattachements absents par défaut", () => {
    const resultat = schemaModeleChecklist.safeParse({
      code: "VGP-PONT",
      libelle: "Vérification pont élévateur",
    });
    expect(resultat.success).toBe(true);
    if (!resultat.success) return;
    expect(resultat.data).toEqual({
      code: "VGP-PONT",
      libelle: "Vérification pont élévateur",
      typeIntervention: null,
      sousTypeId: null,
      familleId: null,
      modeleId: null,
      exigeMachine: false,
    });
  });

  it("refuse un code vide — même garde que code_pris en base", () => {
    expect(
      schemaModeleChecklist.safeParse({ code: "   ", libelle: "Libellé" })
        .success,
    ).toBe(false);
  });

  it("refuse un libellé vide", () => {
    expect(
      schemaModeleChecklist.safeParse({ code: "COD", libelle: "" }).success,
    ).toBe(false);
  });

  it("refuse une nature d'intervention qui n'est pas l'une des neuf du chapitre 11", () => {
    expect(
      schemaModeleChecklist.safeParse({
        code: "COD",
        libelle: "L",
        typeIntervention: "pas_une_nature",
      }).success,
    ).toBe(false);
  });

  it("accepte le sous-type, la famille ET le modèle à la fois — l'exclusivité n'est pas ici", () => {
    // La base refuse par CHECK (`checklist_modele_un_seul_rattachement`),
    // jamais Zod : répéter la règle ici l'exposerait à diverger de la base
    // qui la fait vraiment respecter.
    const resultat = schemaModeleChecklist.safeParse({
      code: "COD",
      libelle: "L",
      sousTypeId: "019334d2-0000-7000-8000-000000000001",
      familleId: "019334d2-0000-7000-8000-000000000002",
      modeleId: "019334d2-0000-7000-8000-000000000003",
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse un identifiant de rattachement qui n'est pas un UUID", () => {
    expect(
      schemaModeleChecklist.safeParse({
        code: "COD",
        libelle: "L",
        sousTypeId: "pas-un-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("schemaPointChecklist — le type du point fait foi, jamais un champ en trop", () => {
  const commun = { section: "Sécurité", ordre: 1, libelle: "Point" };

  it("conforme_non_conforme_sans_objet — forme minimale acceptée", () => {
    const resultat = schemaPointChecklist.safeParse({
      ...commun,
      typeReponse: "conforme_non_conforme_sans_objet",
    });
    expect(resultat.success).toBe(true);
    if (!resultat.success) return;
    expect(resultat.data.obligatoire).toBe(false);
  });

  it("valeur_mesuree — unité et tolérances facultatives, absentes par défaut", () => {
    const resultat = schemaPointChecklist.safeParse({
      ...commun,
      typeReponse: "valeur_mesuree",
    });
    expect(resultat.success).toBe(true);
    if (!resultat.success || resultat.data.typeReponse !== "valeur_mesuree") {
      return;
    }
    expect(resultat.data.unite).toBeUndefined();
    expect(resultat.data.toleranceMin).toBeUndefined();
  });

  it("choix_dans_une_liste — refuse une liste de choix VIDE", () => {
    expect(
      schemaPointChecklist.safeParse({
        ...commun,
        typeReponse: "choix_dans_une_liste",
        choix: [],
      }).success,
    ).toBe(false);
  });

  it("choix_dans_une_liste — refuse un DOUBLON dans les choix", () => {
    expect(
      schemaPointChecklist.safeParse({
        ...commun,
        typeReponse: "choix_dans_une_liste",
        choix: ["Bon", "Mauvais", "Bon"],
      }).success,
    ).toBe(false);
  });

  it("choix_dans_une_liste — accepte des choix non vides et distincts", () => {
    const resultat = schemaPointChecklist.safeParse({
      ...commun,
      typeReponse: "choix_dans_une_liste",
      choix: ["Bon", "Mauvais"],
    });
    expect(resultat.success).toBe(true);
  });

  it("texte_libre — forme minimale acceptée, aucun champ supplémentaire exigé", () => {
    expect(
      schemaPointChecklist.safeParse({ ...commun, typeReponse: "texte_libre" })
        .success,
    ).toBe(true);
  });

  it("photo (9K28-CHECKLIST-REPONSE-PHOTO) — forme minimale acceptée, ni unité ni choix", () => {
    expect(
      schemaPointChecklist.safeParse({ ...commun, typeReponse: "photo" })
        .success,
    ).toBe(true);
  });

  it("refuse un type de réponse hors des six du chapitre 11", () => {
    expect(
      schemaPointChecklist.safeParse({ ...commun, typeReponse: "autre_chose" })
        .success,
    ).toBe(false);
  });

  it("refuse un libellé vide", () => {
    expect(
      schemaPointChecklist.safeParse({
        ...commun,
        libelle: "",
        typeReponse: "case_faite",
      }).success,
    ).toBe(false);
  });
});

describe("schemaVersionChecklist — AU MOINS un point, au plus deux cents", () => {
  it("refuse une version SANS AUCUN point", () => {
    expect(schemaVersionChecklist.safeParse([]).success).toBe(false);
  });

  it("accepte une version d'un seul point", () => {
    const resultat = schemaVersionChecklist.safeParse([
      { section: "S", ordre: 1, libelle: "L", typeReponse: "case_faite" },
    ]);
    expect(resultat.success).toBe(true);
  });

  it("refuse plus de deux cents points", () => {
    const points = Array.from({ length: 201 }, (_, index) => ({
      section: "S",
      ordre: index,
      libelle: "L",
      typeReponse: "case_faite" as const,
    }));
    expect(schemaVersionChecklist.safeParse(points).success).toBe(false);
  });
});
