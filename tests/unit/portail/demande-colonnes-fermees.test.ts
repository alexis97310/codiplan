import { describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import { SELECTION_DEMANDE_PORTAIL } from "@/lib/portail/demandes";

/**
 * LE GARDIEN QUI EMPÊCHE UN FUTUR CHAMP INTERNE DE `demande` DE SORTIR VERS
 * LE PORTAIL PAR RÉUTILISATION (9K15-PORTAIL-MATRICE-LECTURE-ECRITURE, étude
 * du 08/11 §3.2 M1) — même patron que
 * `tests/unit/portail/machine-colonnes-fermees.test.ts`.
 *
 * `demande` ne porte aujourd'hui AUCUNE colonne interne ou de montant — la
 * liste close ci-dessous ne retire donc rien que `CHAMPS_DEMANDE`
 * (`lib/demandes/depot.ts`, qui sert la file ADV) n'ait déjà. Ce que ce
 * gardien ferme, c'est la DÉRIVE FUTURE : `CHAMPS_DEMANDE_PORTAIL` est une
 * liste PROPRE au portail, confrontée au schéma réel plutôt qu'à l'autre
 * liste — un champ ajouté un jour à `CHAMPS_DEMANDE` pour le bureau
 * n'atteint donc jamais le portail par simple réutilisation.
 */
const CHAMPS_VISIBLES_CLIENT = [
  "id",
  "numero",
  "annee",
  "statut",
  "source",
  "urgence",
  "machine_arretee",
  "description",
  "date_souhaitee",
  "client_id",
  "site_id",
  "machine_id",
  "agence_id",
  "contact_id",
  "depose_le",
  "compteur_accuse_le",
  "accuse_le",
  "motif_cloture",
  "close_le",
] as const;

describe("le select des demandes du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_DEMANDE_PORTAIL);
    for (const cle of cles) {
      expect(CHAMPS_VISIBLES_CLIENT).toContain(cle);
    }
  });

  it("la liste close ne nomme que des colonnes qu'`Demande` porte RÉELLEMENT", () => {
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "Demande",
    );
    if (modele === undefined) {
      throw new Error("le modèle Demande a disparu du schéma");
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_VISIBLES_CLIENT) {
      expect(colonnes).toContain(champ);
    }
  });

  it("ne sélectionne pas la colonne de cloisonnement, ni les horodatages techniques — un client les tire du contexte, jamais de la ligne", () => {
    const interdites = ["societe_id", "cree_le", "modifie_le"];
    for (const champ of interdites) {
      expect(CHAMPS_VISIBLES_CLIENT).not.toContain(champ);
      expect(Object.keys(SELECTION_DEMANDE_PORTAIL)).not.toContain(champ);
    }
  });
});
