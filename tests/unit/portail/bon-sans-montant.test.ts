import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { niveau } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";

/**
 * AUCUN MONTANT, AUCUNE VERSION INTERNE SUR LE BON DU PORTAIL
 * (9J08A-REPRISE-9J08, CLI-2.6, 3.8, D37, 9I8B) — MÊME DISCIPLINE que
 * `tests/unit/terrain/sans-montant.test.ts` : *une garantie qui vit dans un
 * écran se mesure sur cet écran.*
 *
 * Le ticket l'exige deux fois : aucun montant affiché (3.8, D37), et aucun
 * paramètre `version` lu ni relayé (point 3 de 9J08 — la route ne doit même
 * pas SAVOIR que `?version=interne` existe, à la différence du bon
 * back-office qui le lit sous condition de droit).
 *
 * ## LE TÉMOIN : le motif mord ailleurs
 *
 * Un gardien qui cherche des mots peut se tromper de mots et rester vert pour
 * cette raison-là (§9, 11/09). Le bon back-office DOIT déclencher ce même
 * motif — s'il ne mordait plus nulle part, c'est ce témoin qui tomberait, pas
 * l'assertion du haut.
 */

const RACINE = process.cwd();
const PAGE_BON_PORTAIL = join(
  RACINE,
  "app/(portail)/portail/interventions/[id]/bon/page.tsx",
);
const PAGE_BON_BACK_OFFICE = join(
  RACINE,
  "app/(back-office)/interventions/[id]/bon/page.tsx",
);

/** Ce par quoi un montant, ou une version interne, arriverait à l'écran. */
const MARQUES_DE_MONTANT = [
  "montant_ht",
  "formatMoney",
  "accesAuxMontants",
  "versionDuBon",
  "montantTotal",
  "forfaitMontant",
  "searchParams",
];

function marquesTrouvees(chemin: string): readonly string[] {
  const source = readFileSync(chemin, "utf8");
  return MARQUES_DE_MONTANT.filter((marque) => source.includes(marque));
}

describe("le bon du portail ne montre aucun montant et n'accepte aucune version", () => {
  it("le rôle portail n'a aucun accès aux montants — c'est la matrice qui le dit", () => {
    expect(niveau(Role.client, "voir_montants_vente")).toBe("aucun");
  });

  it("aucune marque de montant ni de paramètre de requête dans la page portail", () => {
    expect(marquesTrouvees(PAGE_BON_PORTAIL)).toEqual([]);
  });

  it("le TÉMOIN : le même motif mord sur le bon back-office", () => {
    expect(marquesTrouvees(PAGE_BON_BACK_OFFICE).length).toBeGreaterThan(0);
  });
});
