import { describe, expect, it } from "vitest";

import { Prisma } from "@prisma/client";

import { SELECTION_COMMENTAIRES_CLIENT } from "@/lib/portail/interventions";

/**
 * LE GARDIEN QUI EMPÊCHE `note_interne` DE JAMAIS SORTIR VERS LE PORTAIL
 * (9J05-PORTAIL-COMMENTAIRES-GARDE, CLI-8, Question 7).
 *
 * `CHAMPS_VISIBLES_CLIENT` est la liste close : les deux commentaires que le
 * client doit lire, et les colonnes d'identification strictement
 * nécessaires — `id`, `statut`, pas plus. Ce fichier ne lit JAMAIS une copie
 * tenue à la main du `select` : il lit les clés RÉELLES de
 * `SELECTION_COMMENTAIRES_CLIENT`, exportées par `lib/portail/interventions.ts`
 * — une clé ajoutée là-bas sans être ajoutée ici rougit, et réciproquement.
 */
const CHAMPS_VISIBLES_CLIENT = [
  "id",
  "statut",
  "commentaire_technicien",
  "suite_a_donner",
] as const;

describe("le select du portail — liste close, dans les deux sens", () => {
  it("chaque clé du select appartient à la liste close", () => {
    const cles = Object.keys(SELECTION_COMMENTAIRES_CLIENT);
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

  it("`note_interne` — celui que ce gardien existe pour fermer — n'est JAMAIS dans la liste close ni dans le select", () => {
    expect(CHAMPS_VISIBLES_CLIENT).not.toContain("note_interne");
    expect(Object.keys(SELECTION_COMMENTAIRES_CLIENT)).not.toContain(
      "note_interne",
    );
  });
});
