import { describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import { SELECTION_INTERVENTION_PORTAIL } from "@/app/(portail)/portail/interventions/depot";

/**
 * LE GARDIEN QUI EMPÊCHE UN MONTANT, UNE DONNÉE INTERNE OU UN COMMENTAIRE
 * DE SORTIR VERS LA LISTE/FICHE INTERVENTION DU PORTAIL
 * (9J07-PORTAIL-INTERVENTION-ETAT) — même patron que `machine-colonnes-
 * fermees.test.ts` et `commentaires-colonnes-fermees.test.ts`.
 *
 * `intervention` porte `note_interne`, `commentaire_technicien`,
 * `suite_a_donner`, `montant_ht`, `valorisation_figee`, `temps_valide_min`,
 * `technicien_id`, `agence_id`, entre autres — réservées au back-office ou
 * déjà portées par `commentairesVisiblesClient` (9J05), jamais recopiées
 * ici. La liste close ne nomme que les colonnes RÉELLEMENT sélectionnées par
 * `SELECTION_INTERVENTION_PORTAIL`, dans les deux sens.
 */
const CHAMPS_VISIBLES_CLIENT = [
  "id",
  "numero",
  "annee",
  "statut",
  "type",
  "date_planifiee",
  "site_id",
  "cree_le",
] as const;

describe("le select de l'intervention du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_INTERVENTION_PORTAIL);
    for (const cle of cles) {
      expect(CHAMPS_VISIBLES_CLIENT).toContain(cle);
    }
  });

  it("la liste close ne nomme que des colonnes qu'`Intervention` porte RÉELLEMENT", () => {
    const modele = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "Intervention",
    );
    if (modele === undefined) {
      throw new Error("le modèle Intervention a disparu du schéma");
    }
    const colonnes = modele.fields.map((champ) => champ.name);
    for (const champ of CHAMPS_VISIBLES_CLIENT) {
      expect(colonnes).toContain(champ);
    }
  });

  it("aucune colonne interne, de montant ou de commentaire n'est dans la liste close ni dans le select", () => {
    const interdites = [
      "note_interne",
      "commentaire_technicien",
      "suite_a_donner",
      "montant_ht",
      "valorisation_figee",
      "temps_valide_min",
      "temps_mesure_min",
      "technicien_id",
      "agence_id",
      "client_id",
      "contact_id",
      "motif_annulation",
      "motif_suspension",
    ];
    for (const champ of interdites) {
      expect(CHAMPS_VISIBLES_CLIENT).not.toContain(champ);
      expect(Object.keys(SELECTION_INTERVENTION_PORTAIL)).not.toContain(champ);
    }
  });
});
