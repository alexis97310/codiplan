import { describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import {
  SELECTION_HISTORIQUE_DEMANDE_CLIENT,
  SELECTION_HISTORIQUE_INTERVENTION_CLIENT,
} from "@/lib/portail/historique-etats";

/**
 * LE GARDIEN QUI FIGE LES COLONNES LUES PAR LA LECTURE PORTAIL DE L'HISTORIQUE
 * DES ÉTATS (9J08B-PORTAIL-TEMPS-PAR-ETAT) — même patron que
 * `intervention-colonnes-fermees.test.ts` (9J07) et `commentaires-colonnes-
 * fermees.test.ts` (9J05).
 *
 * `intervention_statut_historique`/`demande_statut_historique` ne portent que
 * `id`, `societe_id`, `intervention_id`/`demande_id`, `statut_avant`,
 * `statut_apres`, `change_le` — aucun montant, aucun commentaire. La liste
 * close ne nomme QUE les colonnes RÉELLEMENT sélectionnées, dans les deux
 * sens, pour qu'un ajout futur à l'un des deux `select` fasse rougir ce
 * gardien avant d'atteindre le client.
 */
const CHAMPS_INTERVENTION = [
  "statut_avant",
  "statut_apres",
  "change_le",
] as const;
const CHAMPS_DEMANDE = [
  "demande_id",
  "statut_avant",
  "statut_apres",
  "change_le",
] as const;

describe("le select de l'historique d'intervention du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_HISTORIQUE_INTERVENTION_CLIENT);
    for (const cle of cles) {
      expect(CHAMPS_INTERVENTION).toContain(cle);
    }
  });

  it("la liste close ne nomme que des colonnes qu'`InterventionStatutHistorique` porte RÉELLEMENT", () => {
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "InterventionStatutHistorique",
    );
    if (modele === undefined) {
      throw new Error(
        "le modèle InterventionStatutHistorique a disparu du schéma",
      );
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_INTERVENTION) {
      expect(colonnes).toContain(champ);
    }
  });

  it("aucune colonne d'identité ou de filiation n'est dans le select", () => {
    const interdites = ["id", "societe_id", "intervention_id"];
    for (const champ of interdites) {
      expect(
        Object.keys(SELECTION_HISTORIQUE_INTERVENTION_CLIENT),
      ).not.toContain(champ);
    }
  });
});

describe("le select de l'historique de demande du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_HISTORIQUE_DEMANDE_CLIENT);
    for (const cle of cles) {
      expect(CHAMPS_DEMANDE).toContain(cle);
    }
  });

  it("la liste close ne nomme que des colonnes qu'`DemandeStatutHistorique` porte RÉELLEMENT", () => {
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "DemandeStatutHistorique",
    );
    if (modele === undefined) {
      throw new Error("le modèle DemandeStatutHistorique a disparu du schéma");
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_DEMANDE) {
      expect(colonnes).toContain(champ);
    }
  });

  it("aucune colonne d'identité ou de société n'est dans le select", () => {
    const interdites = ["id", "societe_id"];
    for (const champ of interdites) {
      expect(Object.keys(SELECTION_HISTORIQUE_DEMANDE_CLIENT)).not.toContain(
        champ,
      );
    }
  });
});
