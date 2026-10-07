import { describe, expect, it } from "vitest";

import {
  chiffreAPlanifier,
  chiffreDerniereIntervention,
  chiffreMachines,
  chiffreSites,
  complementRechercheClients,
  libelleDonneurOrdre,
  phraseClientsMasques,
} from "../../../app/(back-office)/clients/presentation";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * LA BANDE DE CHIFFRES DE LA CARTE CLIENT (QE-13c, 9EB-TP-UX3-2-LISTES-1) —
 * quatre petites fonctions pures, chacune avec son cas qui doit ROUGIR sans
 * le correctif, à côté de celui qui reste vert (§9, 11/09).
 */

describe("chiffreSites — le mot imposé composé, jamais écrit ici", () => {
  it("accorde le singulier et le pluriel, sans ton", () => {
    expect(chiffreSites({ nombre: 1, communes: [] })).toEqual({
      valeur: 1,
      libelle: motDansUnePhrase("site"),
    });
    expect(chiffreSites({ nombre: 3, communes: [] })).toEqual({
      valeur: 3,
      libelle: motDansUnePhrase("site", true),
    });
  });

  it("rend zéro pour un client sans entrée — jamais une carte amorcée qui échoue", () => {
    expect(chiffreSites(undefined)).toEqual({
      valeur: 0,
      libelle: motDansUnePhrase("site", true),
    });
  });
});

describe("chiffreMachines", () => {
  it("accorde singulier et pluriel", () => {
    expect(chiffreMachines(1)).toEqual({
      valeur: 1,
      libelle: t("clients.equipements_un"),
    });
    expect(chiffreMachines(0)).toEqual({
      valeur: 0,
      libelle: t("clients.equipements_plusieurs"),
    });
  });
});

describe("chiffreAPlanifier — LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : le ton n'apparaît qu'à partir de un", () => {
  it("zéro : pas de ton — rien à signaler", () => {
    expect(chiffreAPlanifier(0).ton).toBeUndefined();
  });

  it("au moins une : ton avertissement", () => {
    expect(chiffreAPlanifier(1).ton).toBe("avertissement");
    expect(chiffreAPlanifier(4).ton).toBe("avertissement");
  });

  it("le libellé ne s'accorde pas — « à planifier » est un participe, pas un nom compté", () => {
    expect(chiffreAPlanifier(1).libelle).toBe(chiffreAPlanifier(4).libelle);
  });
});

describe("chiffreDerniereIntervention — jj/mm dans l'année en cours, jj/mm/aaaa sinon", () => {
  const AUJOURD_HUI = new Date("2026-10-07T00:00:00.000Z");

  it("même année que `aujourdHui` : jj/mm seul", () => {
    expect(
      chiffreDerniereIntervention(
        new Date("2026-03-05T00:00:00.000Z"),
        AUJOURD_HUI,
      ).valeur,
    ).toBe("05/03");
  });

  it("LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : une année différente montre l'année", () => {
    expect(
      chiffreDerniereIntervention(
        new Date("2024-03-05T00:00:00.000Z"),
        AUJOURD_HUI,
      ).valeur,
    ).toBe("05/03/2024");
  });

  it("aucune intervention : un tiret, jamais une date inventée", () => {
    expect(chiffreDerniereIntervention(null, AUJOURD_HUI).valeur).toBe("—");
  });
});

describe("libelleDonneurOrdre — « Donneur d'ordre : X »", () => {
  it("compose le préfixe, les deux-points puis le nom", () => {
    expect(libelleDonneurOrdre("Marc Tjibaou")).toBe(
      `${t("clients.donneur_ordre_prefixe")}${t("ponctuation.deux_points")}Marc Tjibaou`,
    );
  });
});

describe("complementRechercheClients — « pour « x », sans tenir compte des accents »", () => {
  it("absent (recherche nulle) : rien à ajouter", () => {
    expect(complementRechercheClients(null)).toBeUndefined();
  });

  it("présent : compose la phrase, guillemets compris, sans littéral en dur", () => {
    expect(complementRechercheClients("brouette")).toBe(
      `${t("clients.resume.recherche_prefixe")}${t("ponctuation.guillemet_ouvrant")}brouette${t("ponctuation.guillemet_fermant")}${t("clients.resume.recherche_suffixe")}`,
    );
  });
});

describe("phraseClientsMasques — même forme que `phraseSitesMasques`", () => {
  it("accorde singulier et pluriel", () => {
    expect(phraseClientsMasques(1)).toBe(
      `1 ${t("clients.resultat_un")} ${t("clients.masques_suffixe_un")}`,
    );
    expect(phraseClientsMasques(3)).toBe(
      `3 ${t("clients.resultat")} ${t("clients.masques_suffixe_plusieurs")}`,
    );
  });
});
