import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
} from "@/lib/interventions/journee";

/**
 * PG-A2-ORDRE-TECHNICIENS (28/09/2026) — UN SEUL ORDRE, SEMAINE ET JOUR.
 *
 * ## Le défaut mesuré
 *
 * La grille Semaine triait par LIBELLÉ (`comparerLignes`, `grille.ts`) ; la
 * vue Jour triait par `technicienId` — un UUID (`comparerColonnes`,
 * `journee.ts`). En production, les quatre techniciens n'apparaissaient pas
 * dans le même ordre d'une vue à l'autre.
 *
 * ## Le témoin
 *
 * Trois techniciens dont les UUID sont dans l'ordre INVERSE de leurs noms :
 * un tri par identifiant et un tri par libellé rendent alors deux ordres
 * OPPOSÉS, ce qu'un jeu de données où les deux coïncideraient par hasard ne
 * pourrait pas prouver.
 */

const LUNDI: JourLocal = { annee: 2026, mois: 8, jour: 17 };

// Les UUID sont dans l'ordre INVERSE de leurs noms : « zzz » (Alice) avant
// « mmm » (Bob) avant « aaa » (Charlie) par identifiant, alors que les noms
// trient Alice, Bob, Charlie.
const ALICE = "zzz-alice";
const BOB = "mmm-bob";
const CHARLIE = "aaa-charlie";

const NOMS = new Map([
  [ALICE, "Alice"],
  [BOB, "Bob"],
  [CHARLIE, "Charlie"],
]);
const libelleDe = (id: string): string | null => NOMS.get(id) ?? null;

const AGENCE_GRILLE: AgenceDeGrille = {
  id: "ag-test",
  libelle: "Agence de test",
  calendrier: null,
};

const AGENCE_JOURNEE: AgenceDeJournee = {
  id: "ag-test",
  libelle: "Agence de test",
  calendrier: null,
  pasCreneauMinutes: 30,
};

const REFERENTIEL = [ALICE, BOB, CHARLIE].map((id) => ({
  id,
  agenceIds: [AGENCE_GRILLE.id],
}));

/** La file non affectée — `technicienId === null` — vient d'une intervention. */
const NON_AFFECTEE_GRILLE = {
  id: "file",
  technicien_id: null,
  agence_id: AGENCE_GRILLE.id,
  date_planifiee: new Date(Date.UTC(LUNDI.annee, LUNDI.mois - 1, LUNDI.jour)),
};
const NON_AFFECTEE_JOURNEE = {
  id: "file",
  technicien_id: null,
  agence_id: AGENCE_JOURNEE.id,
  creneau_debut: null,
  creneau_fin: null,
  duree_estimee_min: null,
};

const ORDRE_ATTENDU = [null, ALICE, BOB, CHARLIE];

describe("UN SEUL ORDRE DES TECHNICIENS — Semaine et Jour", () => {
  it("la grille Semaine trie par libellé, « Non affectées » en tête", () => {
    const grille = construireGrille(
      [NON_AFFECTEE_GRILLE],
      [LUNDI],
      [AGENCE_GRILLE],
      libelleDe,
      REFERENTIEL,
    );
    expect(grille.map((l) => l.technicienId)).toEqual(ORDRE_ATTENDU);
  });

  it("la vue Jour rend EXACTEMENT LE MÊME ORDRE que la grille Semaine", () => {
    const journee = construireJournee(
      [NON_AFFECTEE_JOURNEE],
      LUNDI,
      [AGENCE_JOURNEE],
      () => 0,
      REFERENTIEL,
      [],
      libelleDe,
    );
    expect(journee.colonnes.map((c) => c.technicienId)).toEqual(ORDRE_ATTENDU);
  });

  it("SANS `libelleDe`, la vue Jour trie par identifiant — le défaut d'avant reste possible sans lui", () => {
    // Non-régression : `libelleDe` est ADDITIF. Un appelant qui ne le fournit
    // pas retrouve le tri par identifiant (`aaa` < `mmm` < `zzz`).
    const journee = construireJournee(
      [NON_AFFECTEE_JOURNEE],
      LUNDI,
      [AGENCE_JOURNEE],
      () => 0,
      REFERENTIEL,
    );
    expect(journee.colonnes.map((c) => c.technicienId)).toEqual([
      null,
      CHARLIE,
      BOB,
      ALICE,
    ]);
  });
});
