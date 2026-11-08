import { describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import { SELECTION_FICHE_MACHINE_PORTAIL } from "@/lib/portail/depot";

/**
 * LE GARDIEN QUI EMPÊCHE UN MONTANT OU UNE DONNÉE INTERNE DE SORTIR VERS LA
 * FICHE MACHINE DU PORTAIL (9J06-PORTAIL-FICHE-MACHINE) — même patron que
 * `tests/unit/portail/commentaires-colonnes-fermees.test.ts`.
 *
 * `machine` porte `facture_origine`, `garantie_fin`, `qr_token`,
 * `vgp_exception`, `vgp_exception_motif`, `criticite`, `source_creation` et
 * `machine_remplacee_id` — réservées au back-office. La liste close ne nomme
 * que les colonnes RÉELLEMENT sélectionnées par `SELECTION_FICHE_MACHINE_
 * PORTAIL`, dans les deux sens : une clé ajoutée là-bas sans être ajoutée ici
 * rougit, et réciproquement.
 *
 * `modele` (9K03) est une JOINTURE, pas une colonne plate de `Machine` : la
 * liste ci-dessous la ferme à son tour, par ses DEUX sous-niveaux
 * (`ModeleMateriel`, `FamilleMateriel`) — même discipline, dans les deux sens.
 */
const CHAMPS_VISIBLES_CLIENT = [
  "id",
  "numero_serie",
  "reference_interne",
  "localisation",
  "statut",
  "site_id",
  "date_mise_en_service",
  "modele",
] as const;

/** Le sous-select de `modele` — fermé comme `CHAMPS_VISIBLES_CLIENT`. */
const CHAMPS_MODELE_VISIBLES_CLIENT = [
  "marque",
  "reference",
  "famille",
] as const;

/** Le sous-select de `modele.famille` — fermé comme `CHAMPS_VISIBLES_CLIENT`. */
const CHAMPS_FAMILLE_VISIBLES_CLIENT = ["libelle"] as const;

describe("le select de la fiche machine du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_FICHE_MACHINE_PORTAIL);
    for (const cle of cles) {
      expect(CHAMPS_VISIBLES_CLIENT).toContain(cle);
    }
  });

  it("la liste close ne nomme que des colonnes qu'`Machine` porte RÉELLEMENT", () => {
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "Machine",
    );
    if (modele === undefined) {
      throw new Error("le modèle Machine a disparu du schéma");
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_VISIBLES_CLIENT) {
      expect(colonnes).toContain(champ);
    }
  });

  it("le sous-select de `modele` est fermé, dans les deux sens", () => {
    const sousSelect = SELECTION_FICHE_MACHINE_PORTAIL.modele.select;
    const cles = Object.keys(sousSelect);
    for (const cle of cles) {
      expect(CHAMPS_MODELE_VISIBLES_CLIENT).toContain(cle);
    }
    for (const champ of CHAMPS_MODELE_VISIBLES_CLIENT) {
      expect(cles).toContain(champ);
    }
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "ModeleMateriel",
    );
    if (modele === undefined) {
      throw new Error("le modèle ModeleMateriel a disparu du schéma");
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_MODELE_VISIBLES_CLIENT) {
      expect(colonnes).toContain(champ);
    }
  });

  it("le sous-select de `modele.famille` est fermé, dans les deux sens", () => {
    const sousSelect =
      SELECTION_FICHE_MACHINE_PORTAIL.modele.select.famille.select;
    const cles = Object.keys(sousSelect);
    for (const cle of cles) {
      expect(CHAMPS_FAMILLE_VISIBLES_CLIENT).toContain(cle);
    }
    for (const champ of CHAMPS_FAMILLE_VISIBLES_CLIENT) {
      expect(cles).toContain(champ);
    }
    const famille = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "FamilleMateriel",
    );
    if (famille === undefined) {
      throw new Error("le modèle FamilleMateriel a disparu du schéma");
    }
    const colonnes = famille.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_FAMILLE_VISIBLES_CLIENT) {
      expect(colonnes).toContain(champ);
    }
  });

  it("aucune colonne interne ou de montant n'est dans la liste close ni dans le select", () => {
    const interdites = [
      "facture_origine",
      "garantie_fin",
      "qr_token",
      "vgp_exception",
      "vgp_exception_motif",
      "criticite",
      "source_creation",
      "machine_remplacee_id",
      "date_vente",
      "annee_fabrication",
      "modele_id",
    ];
    for (const champ of interdites) {
      expect(CHAMPS_VISIBLES_CLIENT).not.toContain(champ);
      expect(Object.keys(SELECTION_FICHE_MACHINE_PORTAIL)).not.toContain(champ);
    }
    const interditesModele = [
      "periodicite_jours",
      "periodicite_compteur",
      "caracteristiques",
      "vgp_periodicite_mois",
      "vgp_reference_texte",
      "famille_id",
      "societe_id",
    ];
    for (const champ of interditesModele) {
      expect(CHAMPS_MODELE_VISIBLES_CLIENT).not.toContain(champ);
    }
    const interditesFamille = [
      "code",
      "assujettissement_vgp",
      "vgp_periodicite_mois",
      "vgp_reference_texte",
      "societe_id",
    ];
    for (const champ of interditesFamille) {
      expect(CHAMPS_FAMILLE_VISIBLES_CLIENT).not.toContain(champ);
    }
  });
});
