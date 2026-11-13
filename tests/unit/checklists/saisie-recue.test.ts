import { describe, expect, it } from "vitest";

import {
  saisieGabaritRecue,
  saisieModeleChecklistRecue,
} from "@/app/api/parametres/checklists/saisie-recue";

/**
 * SAISIE REÇUE DU VOLET « PARTIR D'UN GABARIT DE DÉPART »
 * (9L04B-GABARIT-RATTACHEMENT) — `saisieGabaritRecue` délègue la lecture de
 * l'en-tête (code, libellé, types, rattachement, `exige_machine`) à
 * `saisieModeleChecklistRecue` : MÊME schéma, MÊMES gardes que la création
 * directe (`/api/parametres/checklists/creer`), jamais une seconde règle qui
 * diverge en silence (§9, 01/09). Seul `gabarit_id` lui est propre.
 */

const SOUS_TYPE_ID = "019334d2-0000-7000-8000-000000000001";

function formulaire(champs: Record<string, string | string[]>): FormData {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    for (const v of Array.isArray(valeur) ? valeur : [valeur]) {
      corps.append(nom, v);
    }
  }
  return corps;
}

describe("saisieGabaritRecue", () => {
  it("refuse sans gabarit_id, même si l'en-tête est valide", () => {
    const resultat = saisieGabaritRecue(
      formulaire({ code: "COD", libelle: "L" }),
    );
    expect(resultat).toBeNull();
  });

  it("refuse sans code ni libellé — même garde que saisieModeleChecklistRecue", () => {
    const resultat = saisieGabaritRecue(formulaire({ gabarit_id: "vgp-pont" }));
    expect(resultat).toBeNull();
  });

  it("porte le rattachement choisi — MÊMES champs que la création directe", () => {
    const corps = formulaire({
      gabarit_id: "vgp-pont",
      code: "9L04B-GABARIT",
      libelle: "Depuis gabarit",
      sous_type_id: SOUS_TYPE_ID,
      exige_machine: "on",
    });
    const resultat = saisieGabaritRecue(corps);
    expect(resultat).toEqual({
      gabaritId: "vgp-pont",
      code: "9L04B-GABARIT",
      libelle: "Depuis gabarit",
      typesIntervention: [],
      sousTypeId: SOUS_TYPE_ID,
      familleId: null,
      modeleId: null,
      exigeMachine: true,
    });
  });

  it("laisser le rattachement vide reste permis — générique, comme aujourd'hui", () => {
    const resultat = saisieGabaritRecue(
      formulaire({ gabarit_id: "vgp-pont", code: "COD", libelle: "L" }),
    );
    expect(resultat?.sousTypeId).toBeNull();
    expect(resultat?.familleId).toBeNull();
    expect(resultat?.modeleId).toBeNull();
    expect(resultat?.exigeMachine).toBe(false);
  });

  it("un identifiant de rattachement qui n'est pas un UUID est refusé — même garde Zod", () => {
    const resultat = saisieGabaritRecue(
      formulaire({
        gabarit_id: "vgp-pont",
        code: "COD",
        libelle: "L",
        sous_type_id: "pas-un-uuid",
      }),
    );
    expect(resultat).toBeNull();
  });

  it("rend EXACTEMENT ce que saisieModeleChecklistRecue rend pour le même en-tête", () => {
    const corpsGabarit = formulaire({
      gabarit_id: "vgp-pont",
      code: "COD",
      libelle: "L",
      famille_id: SOUS_TYPE_ID,
    });
    const corpsCreation = formulaire({
      code: "COD",
      libelle: "L",
      famille_id: SOUS_TYPE_ID,
    });
    const { gabaritId, ...enTete } = saisieGabaritRecue(corpsGabarit) ?? {};
    expect(gabaritId).toBe("vgp-pont");
    expect(enTete).toEqual(saisieModeleChecklistRecue(corpsCreation));
  });
});
