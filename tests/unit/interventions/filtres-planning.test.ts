import { describe, expect, it } from "vitest";

import {
  idConnuDepuisParametre,
  valeurConnueDepuisParametre,
} from "@/lib/interventions/affichage";

/**
 * LA LECTURE DES FILTRES DE LA BARRE D'OUTILS (PG-C6-FILTRES-AUJOURDHUI) —
 * une valeur hors liste (statique ou connue à l'exécution) est ignorée,
 * jamais une page qui échoue (L1-02f).
 */

describe("valeurConnueDepuisParametre — nature, priorité, statut", () => {
  const LISTE = ["p1", "p2", "p3"] as const;

  it("reconnaît une valeur de la liste", () => {
    expect(valeurConnueDepuisParametre("p2", LISTE)).toBe("p2");
  });

  it("ignore une valeur absente, inconnue, ou un tableau (paramètre répété)", () => {
    expect(valeurConnueDepuisParametre(undefined, LISTE)).toBeNull();
    expect(valeurConnueDepuisParametre("p9", LISTE)).toBeNull();
    expect(valeurConnueDepuisParametre(["p1", "p2"], LISTE)).toBeNull();
  });
});

describe("idConnuDepuisParametre — agence, technicien, client", () => {
  const IDS = ["id-a", "id-b"];

  it("reconnaît un identifiant de la liste connue à l'exécution", () => {
    expect(idConnuDepuisParametre("id-b", IDS)).toBe("id-b");
  });

  it("ignore un identifiant qui ne désigne rien de connu", () => {
    expect(idConnuDepuisParametre(undefined, IDS)).toBeNull();
    expect(idConnuDepuisParametre("id-inconnu", IDS)).toBeNull();
    expect(idConnuDepuisParametre(["id-a", "id-b"], IDS)).toBeNull();
  });

  it("une liste vide (aucune agence/technicien/client) ignore tout", () => {
    expect(idConnuDepuisParametre("id-a", [])).toBeNull();
  });
});
