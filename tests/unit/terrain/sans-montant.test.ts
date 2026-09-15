import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { niveau } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";

/**
 * AUCUN MONTANT SUR L'ÉCRAN DU TERRAIN (R5-01, matrice §5.2).
 *
 * La matrice ne donne au technicien **aucun** `voir_montants_vente` — l'arbitrage
 * 3.8 et D37 en ont même retiré des rôles qui l'avaient. L'acceptation de R5-01
 * l'exige : *« le même compte ne voit aucun montant »*.
 *
 * ## POURQUOI UN GARDIEN STATIQUE, ET CE QU'IL NE PRÉTEND PAS
 *
 * `listerPlanning` rend `montant_ht` dans sa ligne : la garantie n'est donc pas
 * que la donnée soit absente de la lecture, c'est que **l'écran ne la rende
 * pas**. Une garantie qui vit dans un écran se mesure sur cet écran, et un
 * gardien statique est ce qui l'attrape au moment où quelqu'un ajoutera la
 * colonne « par commodité ».
 *
 * *Il ne prétend pas que le technicien ne PEUT PAS lire un montant* — il le
 * pourrait par une requête. Ce qui le lui interdirait vraiment est une clause
 * en base, et rien n'en porte une aujourd'hui : la question est ouverte, elle
 * est écrite, et elle n'est pas refermée par ce fichier.
 *
 * ## LE TÉMOIN : le motif mord ailleurs
 *
 * Un gardien qui cherche des mots peut se tromper de mots et rester vert pour
 * cette raison-là (§9, 11/09). Le même motif est donc passé sur la fiche du
 * back-office, **qui doit le déclencher** : elle affiche le total décomposé de
 * D83. Si le motif ne mordait plus nulle part, c'est ce témoin qui tomberait,
 * pas l'assertion du haut.
 */

const RACINE = process.cwd();
const ECRAN_TERRAIN = join(RACINE, "app/(mobile)/terrain/page.tsx");
const FICHE_BACK_OFFICE = join(
  RACINE,
  "app/(back-office)/planning/[id]/page.tsx",
);

/** Ce par quoi un montant arrive à l'écran, sous une forme ou une autre. */
const MARQUES_DE_MONTANT = [
  "montant_ht",
  "formatMoney",
  "valorisation",
  "devise",
  "tauxHoraire",
  "totalHT",
];

function marquesTrouvees(chemin: string): readonly string[] {
  const source = readFileSync(chemin, "utf8");
  return MARQUES_DE_MONTANT.filter((marque) => source.includes(marque));
}

describe("l'écran du terrain ne montre aucun montant", () => {
  it("le technicien n'a aucun accès aux montants — c'est la matrice qui le dit", () => {
    expect(niveau(Role.technicien, "voir_montants_vente")).toBe("aucun");
  });

  it("aucune marque de montant dans l'écran du terrain", () => {
    expect(marquesTrouvees(ECRAN_TERRAIN)).toEqual([]);
  });

  it("le TÉMOIN : le même motif mord sur la fiche du back-office", () => {
    // Sans lui, un motif devenu obsolète rendrait la vérification ci-dessus
    // verte sans avoir rien cherché — le vert le plus cher qui soit.
    expect(marquesTrouvees(FICHE_BACK_OFFICE).length).toBeGreaterThan(0);
  });
});
