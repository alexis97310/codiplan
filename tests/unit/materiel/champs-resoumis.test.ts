import { describe, expect, it } from "vitest";

import {
  champsResoumisFamille,
  champsResoumisModele,
  champsResoumisSousType,
} from "@/app/api/parametres/materiel/saisie-recue";

/**
 * 9L39-MATERIEL-DEUXIEME-PASSE, point 3 — « saisie gardée après un refus ».
 *
 * CE QUI AVAIT ÉTÉ SOUMIS doit être capturé TEL QUEL, avant toute validation
 * (même mécanique que `app/api/clients/creer/formulaire.ts` et
 * `app/api/parametres/agences/creer/route.ts`) : une valeur invalide (un
 * champ vide, une case décochée) doit elle aussi se retrouver dans le
 * rapport, puisque c'est elle qu'il faut réafficher au refus.
 */
describe("champsResoumisFamille", () => {
  it("capture le code et le libellé tels que soumis, actif « non » si décochée", () => {
    const formulaire = new FormData();
    formulaire.set("code", "FAM1");
    formulaire.set("libelle", "Une famille");
    expect(champsResoumisFamille(formulaire)).toEqual({
      code: "FAM1",
      libelle: "Une famille",
      actif: "non",
    });
  });

  it("un champ absent du formulaire devient une chaîne vide, jamais `undefined`", () => {
    const formulaire = new FormData();
    formulaire.set("actif", "on");
    expect(champsResoumisFamille(formulaire)).toEqual({
      code: "",
      libelle: "",
      actif: "oui",
    });
  });
});

describe("champsResoumisModele", () => {
  it("capture tous les champs d'un modèle, y compris une périodicité invalide", () => {
    const formulaire = new FormData();
    formulaire.set("famille_id", "0192f0a0-0000-7000-8000-00000000f001");
    formulaire.set("sous_type_id", "");
    formulaire.set("marque", "Ravaglioli");
    formulaire.set("reference", "KPX-300");
    formulaire.set("periodicite_jours", "abc");
    formulaire.set("actif", "on");
    expect(champsResoumisModele(formulaire)).toEqual({
      famille_id: "0192f0a0-0000-7000-8000-00000000f001",
      sous_type_id: "",
      marque: "Ravaglioli",
      reference: "KPX-300",
      periodicite_jours: "abc",
      periodicite_compteur: "",
      actif: "oui",
    });
  });
});

describe("champsResoumisSousType", () => {
  it("capture famille, code et libellé tels que soumis", () => {
    const formulaire = new FormData();
    formulaire.set("famille_id", "0192f0a0-0000-7000-8000-00000000f001");
    formulaire.set("code", "ST1");
    formulaire.set("libelle", "Un sous-type");
    formulaire.set("actif", "on");
    expect(champsResoumisSousType(formulaire)).toEqual({
      famille_id: "0192f0a0-0000-7000-8000-00000000f001",
      code: "ST1",
      libelle: "Un sous-type",
      actif: "oui",
    });
  });
});
