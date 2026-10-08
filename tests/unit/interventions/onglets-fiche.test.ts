import { describe, expect, it } from "vitest";

import {
  hrefOngletFiche,
  libelleOrigineDemande,
  nomEtFonctionDuContact,
  ongletDeLaFiche,
} from "../../../app/(back-office)/interventions/presentation";

import { t } from "@/lib/i18n/fr";

/**
 * LES ONGLETS DE LA FICHE (9EE-TP-UX4-1-FICHE-INTERVENTION-2, addendum
 * recalage 2, R3) — une liste FERMÉE, jamais une URL libre.
 */
describe("ongletDeLaFiche", () => {
  it("valeur de la liste fermée → elle-même", () => {
    expect(ongletDeLaFiche("temps")).toBe("temps");
    expect(ongletDeLaFiche("historique")).toBe("historique");
  });

  it("absente, forgée, ou un tableau → résumé", () => {
    expect(ongletDeLaFiche(undefined)).toBe("resume");
    expect(ongletDeLaFiche("un-onglet-invente")).toBe("resume");
    expect(ongletDeLaFiche(["temps", "rapport"])).toBe("temps");
    expect(ongletDeLaFiche(["invente"])).toBe("resume");
  });
});

describe("hrefOngletFiche", () => {
  it("pose l'onglet, sans depuis ni retour quand ils sont absents", () => {
    const href = hrefOngletFiche("int-1", "temps", {
      depuis: undefined,
      depuisId: undefined,
      retour: undefined,
    });
    expect(href).toBe("/interventions/int-1?onglet=temps");
  });

  it("garde depuis (liste fermée) et depuis_id ensemble", () => {
    const href = hrefOngletFiche("int-1", "rapport", {
      depuis: "machine",
      depuisId: "machine-1",
      retour: undefined,
    });
    expect(href).toBe(
      "/interventions/int-1?onglet=rapport&depuis=machine&depuis_id=machine-1",
    );
  });

  it("ignore un depuis hors de la liste fermée", () => {
    const href = hrefOngletFiche("int-1", "historique", {
      depuis: "un-site-invente",
      depuisId: undefined,
      retour: undefined,
    });
    expect(href).toBe("/interventions/int-1?onglet=historique");
  });

  it("filtre retour via retourVersRegistre, jamais la valeur brute", () => {
    const href = hrefOngletFiche("int-1", "valorisation", {
      depuis: "interventions",
      depuisId: undefined,
      retour: "statut=en_cours&parametre_hors_liste_fermee=1",
    });
    expect(href).toBe(
      "/interventions/int-1?onglet=valorisation&depuis=interventions&retour=statut%3Den_cours",
    );
  });

  it("rejette en bloc un retour forgé (schéma d'URL détourné)", () => {
    const href = hrefOngletFiche("int-1", "resume", {
      depuis: undefined,
      depuisId: undefined,
      retour: "statut=en_cours&q=https://exemple.invalide",
    });
    expect(href).toBe("/interventions/int-1?onglet=resume");
  });
});

describe("libelleOrigineDemande", () => {
  it("numéro attribué → « la demande n° N »", () => {
    expect(libelleOrigineDemande(42)).toBe(
      `${t("intervention.cree_depuis.demande_numero_prefixe")} 42`,
    );
  });

  it("numéro nul (pas encore attribué) → « la demande », sans référence inventée", () => {
    expect(libelleOrigineDemande(null)).toBe(
      t("intervention.cree_depuis.demande"),
    );
  });
});

describe("nomEtFonctionDuContact", () => {
  it("fonction présente → « Nom · Fonction »", () => {
    expect(
      nomEtFonctionDuContact({ nom: "Alexis Dupont", fonction: "Gérant" }),
    ).toBe(`Alexis Dupont${t("ponctuation.point_median")}Gérant`);
  });

  it("fonction nulle → le nom seul", () => {
    expect(
      nomEtFonctionDuContact({ nom: "Alexis Dupont", fonction: null }),
    ).toBe("Alexis Dupont");
  });
});
