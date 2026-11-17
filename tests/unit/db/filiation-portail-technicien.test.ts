import { describe, expect, it } from "vitest";

import {
  COLONNE_NOM_TECHNICIEN_AFFICHE,
  POLITIQUE_PORTAIL_FILIATION_RETIREE,
  TABLE_NOM_TECHNICIEN_AFFICHE,
  TABLE_PORTAIL_FILIATION,
  ecartsNomTechnicienAfficheObligatoire,
  ecartsPolitiquePortailFiliationRetiree,
  rapportNomTechnicienAfficheObligatoire,
  rapportPolitiquePortailFiliationRetiree,
  type ColonneNomTechnicienAffiche,
} from "../../../scripts/lib/filiation-portail-technicien";
import type { PolitiqueObservee } from "../../../scripts/lib/politiques-rls";

/**
 * Décision d'Alexis du 10/11/2026 (9J22A) — éprouvé sur des lignes FABRIQUÉES ;
 * la mesure contre une vraie base vit dans
 * `tests/isolation/9l11-filiation-portail-technicien.test.ts`.
 */

function politique(table: string, nom: string): PolitiqueObservee {
  return {
    table,
    nom,
    permissive: "PERMISSIVE",
    commande: "SELECT",
    lecture: "true",
    ecriture: null,
  };
}

describe("ecartsPolitiquePortailFiliationRetiree (9J22A)", () => {
  it("rend une liste VIDE quand la politique retirée est bien absente", () => {
    const politiques = [
      politique("utilisateur", "utilisateur_lecture"),
      politique("segment_travail", "cloisonnement_interne_lecture"),
    ];
    expect(ecartsPolitiquePortailFiliationRetiree(politiques)).toEqual([]);
  });

  it("ÉCHOUE quand la politique retirée par 9J22A est revenue", () => {
    const politiques = [
      politique("utilisateur", "utilisateur_lecture"),
      politique(TABLE_PORTAIL_FILIATION, POLITIQUE_PORTAIL_FILIATION_RETIREE),
    ];
    const ecarts = ecartsPolitiquePortailFiliationRetiree(politiques);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(POLITIQUE_PORTAIL_FILIATION_RETIREE);
  });

  it("une politique de même nom sur une AUTRE table n'est pas confondue", () => {
    const politiques = [
      politique("site", POLITIQUE_PORTAIL_FILIATION_RETIREE),
    ];
    expect(ecartsPolitiquePortailFiliationRetiree(politiques)).toEqual([]);
  });

  it("refuse le vide : aucune politique observée n'est jamais un sans-faute", () => {
    const ecarts = ecartsPolitiquePortailFiliationRetiree([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucune politique observée");
  });

  it("le rapport nomme la politique et la table, dans les deux états", () => {
    for (const politiques of [
      [] as PolitiqueObservee[],
      [politique(TABLE_PORTAIL_FILIATION, POLITIQUE_PORTAIL_FILIATION_RETIREE)],
    ]) {
      const rapport = rapportPolitiquePortailFiliationRetiree(politiques);
      expect(rapport).toContain(POLITIQUE_PORTAIL_FILIATION_RETIREE);
      expect(rapport).toContain(TABLE_PORTAIL_FILIATION);
    }
  });
});

function colonne(
  obligatoire: boolean,
  presente = true,
): ColonneNomTechnicienAffiche {
  return { table: TABLE_NOM_TECHNICIEN_AFFICHE, presente, obligatoire };
}

describe("ecartsNomTechnicienAfficheObligatoire (9J22A)", () => {
  it("rend une liste VIDE quand la colonne reste NOT NULL", () => {
    expect(ecartsNomTechnicienAfficheObligatoire([colonne(true)])).toEqual(
      [],
    );
  });

  it("ÉCHOUE quand la colonne n'est plus NOT NULL", () => {
    const ecarts = ecartsNomTechnicienAfficheObligatoire([colonne(false)]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(COLONNE_NOM_TECHNICIEN_AFFICHE);
    expect(ecarts[0]).toContain("NOT NULL");
  });

  it("ÉCHOUE quand la colonne est introuvable", () => {
    const ecarts = ecartsNomTechnicienAfficheObligatoire([
      colonne(true, false),
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(TABLE_NOM_TECHNICIEN_AFFICHE);
    expect(ecarts[0]).toContain("ne porte plus de colonne");
  });

  it("refuse le vide : aucune table observée n'est jamais un sans-faute", () => {
    const ecarts = ecartsNomTechnicienAfficheObligatoire([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucune table observée");
  });

  it("le rapport nomme la colonne, obligatoire ou introuvable", () => {
    expect(rapportNomTechnicienAfficheObligatoire([colonne(true)])).toContain(
      "NOT NULL=true",
    );
    expect(rapportNomTechnicienAfficheObligatoire([])).toContain(
      "INTROUVABLE",
    );
  });
});
