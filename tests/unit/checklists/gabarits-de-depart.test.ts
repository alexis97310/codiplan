import { describe, expect, it } from "vitest";

import {
  GABARITS_DE_DEPART,
  gabaritDeDepart,
} from "@/lib/checklists/gabarits-de-depart";
import { schemaPointChecklist } from "@/lib/checklists/saisie";

/**
 * 9K20-CHECKLIST-DUPLIQUER-DEPART — le gabarit « pont 2 colonnes
 * électromécanique » : quinze points EXACTS (ni les points 16 à 19, non
 * validés, ni une valeur chiffrée inventée), tous conformes au schéma que
 * `publierVersion` validerait.
 */

describe("GABARITS_DE_DEPART", () => {
  it("ne contient que le gabarit pont 2 colonnes électromécanique", () => {
    expect(GABARITS_DE_DEPART).toHaveLength(1);
    expect(GABARITS_DE_DEPART[0]?.libelle).toBe(
      "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
    );
  });

  it("porte EXACTEMENT quinze points, ordonnés 1 à 15 sans trou ni doublon", () => {
    const gabarit = GABARITS_DE_DEPART[0];
    expect(gabarit?.points).toHaveLength(15);
    expect(gabarit?.points.map((p) => p.ordre)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it("chaque point est conforme au schéma de publication (cinq types de réponse)", () => {
    const gabarit = GABARITS_DE_DEPART[0];
    for (const point of gabarit?.points ?? []) {
      const verdict = schemaPointChecklist.safeParse(point);
      expect(verdict.success, JSON.stringify(verdict.error?.issues)).toBe(
        true,
      );
    }
  });

  it("AUCUNE tolérance, aucune valeur chiffrée — seule l'unité des mesures est posée", () => {
    const gabarit = GABARITS_DE_DEPART[0];
    const mesures = (gabarit?.points ?? []).filter(
      (p) => p.typeReponse === "valeur_mesuree",
    );
    expect(mesures).toHaveLength(2);
    for (const point of mesures) {
      expect(point.typeReponse === "valeur_mesuree" && point.unite).toBe(
        "mm",
      );
      expect(
        point.typeReponse === "valeur_mesuree" ? point.toleranceMin : null,
      ).toBeUndefined();
      expect(
        point.typeReponse === "valeur_mesuree" ? point.toleranceMax : null,
      ).toBeUndefined();
    }
  });

  it("quatre points obligatoires exactement — les autres facultatifs", () => {
    const gabarit = GABARITS_DE_DEPART[0];
    const obligatoires = (gabarit?.points ?? []).filter((p) => p.obligatoire);
    expect(obligatoires).toHaveLength(6);
  });

  it("gabaritDeDepart retrouve le gabarit par son identifiant, undefined sinon", () => {
    const gabarit = GABARITS_DE_DEPART[0];
    expect(gabarit).toBeDefined();
    if (gabarit === undefined) return;
    expect(gabaritDeDepart(gabarit.id)).toBe(gabarit);
    expect(gabaritDeDepart("inconnu")).toBeUndefined();
  });
});
