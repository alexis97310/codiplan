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

  /*
   * ── DEUX ALARMES DE NATURE DIFFÉRENTE, ET ELLES NE SE REMPLACENT PAS ──────
   *
   * Cette liste doit SE VIDER. Un plafond n'est pas une règle de gestion, c'est
   * une alarme de dérive : *le jour où l'on en compte quatre, la question n'est
   * plus « laquelle ajouter » mais « pourquoi aucune n'a été rattrapée ».*
   *
   * **Le COMPTE EXACT** oblige à rouvrir ce fichier — donc à relire le motif —
   * à chaque addition ET à chaque retrait. C'est une alarme *à chaque
   * mouvement*, pas un seuil : elle ne dit pas « c'est trop », elle dit
   * « quelqu'un a bougé, regardez ».
   *
   * **Le PLAFOND**, lui, ne bouge pas. Quatre est le nombre que la note
   * d'origine nomme, et il est ici sous la forme d'une assertion plutôt que
   * d'un commentaire — *une prescription qui ne se vérifie pas est une
   * intention* (§9, 31/08). Le jour où il est atteint, c'est un arbitrage,
   * jamais une mise à jour de ce fichier.
   *
   * *Historique du compte exact, pour que le chiffre ne s'écrive pas sans sa
   * raison :* **2** à D104 (les deux suspensions) ; **3** le 12/09/2026
   * (`intervention_cloture_a_son_statut_facturation`, N-04d) — les
   * interventions DÉJÀ clôturées n'ont pas de statut de facturation, et la
   * colonne qui dirait lesquelles ont été facturées, `reference_facture`,
   * **n'existe pas** (mesuré). Choisir entre « à facturer » et « facturée »
   * serait choisir entre refacturer et renoncer. Puis **1**, le même soir
   * (R3-02, D117) : le rattrapage des suspensions a été écrit, et les deux
   * entrées de D104 sont parties AVEC lui. *C'est la première fois que cette
   * liste DESCEND, et c'est ce pour quoi le compte exact existe — il oblige à
   * rouvrir ce fichier à chaque mouvement, dans les deux sens.*
   */
  it("compte EXACTEMENT une entrée — toute addition ou tout retrait rouvre ce fichier", () => {
    expect(CONTRAINTES_NON_VALIDEES).toHaveLength(1);
  });

  it("LE PLAFOND, lui, ne bouge pas : quatre est un arbitrage, pas une mise à jour", () => {
    expect(CONTRAINTES_NON_VALIDEES.length).toBeLessThan(4);
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
