import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ZONES_GEOGRAPHIQUES, estZoneConnue } from "@/lib/sites";

/**
 * Les zones géographiques de D23, et l'endroit où la liste est TENUE
 * (ticket L1-02).
 *
 * Deux propriétés, et la seconde est celle qui compte : la liste est close
 * (D23 l'arrête à six), et elle est close **à l'entrée serveur, pas en base**.
 * Ce second point est une décision, portée au registre des arbitrages du
 * ticket ; ce gardien la rend visible plutôt que tacite — si quelqu'un ajoute
 * un jour une contrainte d'énumération à la migration, c'est ici qu'on veut
 * qu'il relise le raisonnement.
 */

const RACINE = join(import.meta.dirname, "..", "..", "..");
const MIGRATION = join(
  RACINE,
  "prisma",
  "migrations",
  "20260906120000_site_l1_02",
  "migration.sql",
);

describe("les zones géographiques (D23)", () => {
  it("sont les SIX que D23 arrête, dans son ordre", () => {
    expect([...ZONES_GEOGRAPHIQUES]).toEqual([
      "grand_noumea",
      "sud",
      "cote_est",
      "cote_ouest",
      "nord",
      "iles",
    ]);
  });

  it("refuse toute valeur hors de la liste", () => {
    expect(estZoneConnue("grand_noumea")).toBe(true);
    expect(estZoneConnue("koumac")).toBe(false);
    expect(estZoneConnue("GRAND_NOUMEA")).toBe(false);
    expect(estZoneConnue(null)).toBe(false);
  });

  it("ne sont PAS fermées en base, et le gardien le constate", () => {
    // **Ce que ce scénario surveille n'est pas une faute : c'est une décision.**
    // Les six valeurs sont la géographie de la Nouvelle-Calédonie ; les figer
    // en type énuméré ou en `CHECK` ferait de la carte d'un territoire une
    // contrainte du produit, et il faudrait une migration le jour du premier
    // client hors territoire — le jeu de démonstration en compte déjà un
    // (CODIMA-EU, site de Lyon, `zone_geo` nul).
    //
    // Le jour où quelqu'un voudra fermer l'énumération en base, ce scénario
    // rougira et le renverra à ce raisonnement. C'est un arbitrage, pas une
    // ligne de migration.
    const sql = readFileSync(MIGRATION, "utf8");

    // TÉMOIN : le gardien lit bien la bonne migration, et elle parle de zone.
    expect(sql).toMatch(/CREATE TABLE "site"/);
    expect(sql).toMatch(/"zone_geo" TEXT/);

    // Aucune contrainte ni aucun type énuméré ne fixe les valeurs. On cherche
    // les DEUX formes qu'une fermeture prendrait — un `CHECK` nommant la
    // colonne, et un type énuméré PostgreSQL — hors des lignes de commentaire,
    // qui, elles, ont le droit de nommer les zones pour expliquer la décision.
    const executable = sql
      .split("\n")
      .filter((ligne) => !ligne.trimStart().startsWith("--"))
      .join("\n");

    expect(executable).not.toMatch(/CREATE\s+TYPE/i);
    expect(executable).not.toMatch(/CHECK\s*\([^)]*zone_geo/i);
  });
});
