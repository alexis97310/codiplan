import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * LE PLANCHER DE 12 PX DANS `components/ui/` ET LA NAVIGATION (D138, TP-UX1-1).
 *
 * D138 (`docs/arbitrages.md`, 29/09/2026) : « Rien, dans le produit, ne
 * s'affiche en dessous de 12 px. » Ce gardien tient la commande du plan
 * TP-UX (`docs/propositions/ergonomie-2026-09-28/lots-ux.md`) — la même
 * regex, appliquée au territoire de ce ticket : `components/ui/**\/*.tsx`,
 * `components/navigation/barre.tsx`, `components/navigation/marque.tsx`.
 *
 * **La population se dérive du dépôt, jamais d'une liste tenue à la main** :
 * un fichier ajouté demain à `components/ui/` entre dans ce périmètre le jour
 * même, sans qu'aucune ligne d'ici n'ait à bouger (§9, 10/09).
 */

const CLASSE_SOUS_LE_PLANCHER = /text-\[(9|1[01])(\.[0-9])?px\]/;

const CIBLES = [
  ...fichiersSource(["components/ui"]),
  ...fichiersSource(["components/navigation"]).filter(
    (fichier) =>
      fichier.chemin === "components/navigation/barre.tsx" ||
      fichier.chemin === "components/navigation/marque.tsx",
  ),
];

describe("plancher de 12 px — components/ui et la navigation (D138)", () => {
  it("a réellement parcouru des fichiers — le témoin de non-vacuité", () => {
    expect(CIBLES.length).toBeGreaterThan(10);
  });

  it("aucune classe sous 12 px (9, 9.5, 10, 10.5, 11, 11.5 px) ne subsiste", () => {
    const fautifs = CIBLES.filter((fichier) =>
      CLASSE_SOUS_LE_PLANCHER.test(sansCommentaires(fichier.contenu)),
    ).map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "D138 (docs/arbitrages.md, 29/09/2026) : plancher de 12 px, amende " +
        "D124 et D95 — aucun texte de ces répertoires ne descend en dessous",
    ).toEqual([]);
  });
});
