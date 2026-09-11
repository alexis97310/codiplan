import { describe, expect, it } from "vitest";

import {
  CONTRAINTES_NON_VALIDEES,
  ecartsContraintesNonValidees,
  rapportContraintesNonValidees,
  type ContrainteObservee,
  type NonValideeDeclaree,
} from "../../../scripts/lib/contraintes-non-validees";

/**
 * L'ÉTAT NON VALIDÉ EST VISIBLE, OU IL N'EXISTE PAS (D104).
 *
 * Une contrainte `NOT VALID` vaut pour toute ligne nouvelle ou modifiée, et ne
 * relit jamais les lignes d'avant. C'est ce qu'il faut dire quand une règle
 * naît après les données qu'elle gouverne — **et c'est aussi la forme la plus
 * commode d'une règle qu'on n'applique pas**. Seule une liste close, gardée
 * dans les deux sens, sépare les deux.
 */

const validee = (table: string, contrainte: string): ContrainteObservee => ({
  table,
  contrainte,
  validee: true,
});
const nonValidee = (table: string, contrainte: string): ContrainteObservee => ({
  table,
  contrainte,
  validee: false,
});

const declaree = (table: string, contrainte: string): NonValideeDeclaree => ({
  table,
  contrainte,
  motif: "motif fabriqué",
  rattrapage: "rattrapage fabriqué",
});

describe("contraintes posées NOT VALID", () => {
  it("accepte une base dont les non validées sont exactement les déclarées", () => {
    const ecarts = ecartsContraintesNonValidees(
      [
        validee("intervention", "intervention_piece_attendue_a_son_horizon"),
        nonValidee("intervention", "intervention_suspension_a_son_motif"),
      ],
      [declaree("intervention", "intervention_suspension_a_son_motif")],
    );

    expect(ecarts).toEqual([]);
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Une
  // contrainte qui porte le MÊME NOM sur une AUTRE table n'est pas la même :
  // un contrôle qui comparerait les noms seuls accepterait une NOT VALID posée
  // ailleurs, en restant vert.
  it("ne confond pas deux contraintes de même nom sur deux tables", () => {
    const ecarts = ecartsContraintesNonValidees(
      [
        nonValidee("intervention", "a_son_motif"),
        nonValidee("demande", "a_son_motif"),
      ],
      [declaree("intervention", "a_son_motif")],
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("demande.a_son_motif");
  });

  it("refuse une NOT VALID que personne n'a décidée", () => {
    const ecarts = ecartsContraintesNonValidees(
      [nonValidee("machine", "machine_serie_non_vide")],
      [],
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("machine.machine_serie_non_vide");
    expect(ecarts[0]).toContain("CONTRAINTES_NON_VALIDEES");
  });

  // LE SENS QU'ON OUBLIE : le rattrapage a eu lieu, et l'entrée ment désormais.
  it("refuse une entrée dont la contrainte est redevenue VALIDÉE", () => {
    const ecarts = ecartsContraintesNonValidees(
      [validee("intervention", "intervention_suspension_a_son_motif")],
      [declaree("intervention", "intervention_suspension_a_son_motif")],
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("rattrapage a eu lieu");
  });

  // L'ADOSSEMENT (§9, 31/08) : une exemption qui ne désigne plus rien n'exempte
  // plus personne, et le premier objet qui reprendra ce nom en héritera.
  it("refuse une entrée qui ne s'adosse à AUCUNE contrainte existante", () => {
    const ecarts = ecartsContraintesNonValidees(
      [validee("intervention", "autre_chose")],
      [declaree("intervention", "contrainte_disparue")],
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("s'adosse plus à rien");
  });

  // TÉMOIN DE NON-VACUITÉ : zéro contrainte lue n'est pas un vert.
  it("refuse de conclure sur une population VIDE", () => {
    const ecarts = ecartsContraintesNonValidees([], []);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("n'a rien observé");
  });
});

describe("la liste déclarée", () => {
  it("nomme un motif ET un rattrapage pour chaque entrée", () => {
    expect(CONTRAINTES_NON_VALIDEES.length).toBeGreaterThan(0);
    for (const entree of CONTRAINTES_NON_VALIDEES) {
      expect(entree.motif.length, entree.contrainte).toBeGreaterThan(40);
      expect(entree.rattrapage.length, entree.contrainte).toBeGreaterThan(20);
    }
  });

  // Cette liste doit SE VIDER. Un plafond n'est pas une règle de gestion, c'est
  // une alarme de dérive : le jour où l'on en compte quatre, la question n'est
  // plus « laquelle ajouter » mais « pourquoi aucune n'a été rattrapée ».
  it("ne dépasse pas les deux entrées de D104", () => {
    expect(CONTRAINTES_NON_VALIDEES).toHaveLength(2);
  });
});

describe("rapport", () => {
  it("NOMME les contraintes de chaque côté du miroir", () => {
    const rapport = rapportContraintesNonValidees(
      [validee("intervention", "horizon"), nonValidee("intervention", "motif")],
      [declaree("intervention", "motif")],
    );

    expect(rapport).toContain("intervention.motif");
    expect(rapport).toContain("observées NON VALIDÉES");
    expect(rapport).toContain("déclarées (dépôt)");
  });
});
