import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SOCIETES } from "../../../prisma/seed-data";
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

  it("LA BASCULE : le jour où une SECONDE géographie les emploie, elles deviennent un référentiel cloisonné", () => {
    // **Une borne qui porte sa CONDITION, et non une date** (CLAUDE.md §9,
    // 01/09 sur les bornes). « On verra plus tard » n'est pas un critère, et
    // « en 2027 » n'en est pas un non plus : ce qui déclenche la bascule est un
    // FAIT observable, et le voici.
    //
    // Aujourd'hui, Zod suffit parce qu'une seule géographie existe : les six
    // zones de D23 sont celles de la Nouvelle-Calédonie, et seule CODIMA-NC les
    // emploie. CODIMA-EU porte un site à `zone_geo` nul — aucune des six ne
    // décrit Lyon.
    //
    // **Le jour où une société ayant sa PROPRE géographie entre au jeu de
    // données, les zones cessent d'être une énumération et deviennent un
    // RÉFÉRENTIEL CLOISONNÉ** : une table métier portant `societe_id NOT NULL`,
    // que chaque société peuple avec sa géographie. Ce scénario rougit ce
    // jour-là, et il renvoie ici — il ne demande pas qu'on s'en souvienne.
    //
    // Pourquoi ce critère et pas un autre : ce qui rend une énumération globale
    // intenable n'est pas le nombre de sociétés, c'est le nombre de
    // GÉOGRAPHIES qu'elle prétend décrire à la fois.
    const paysQuiEmploientLesZones = new Set(
      SOCIETES.filter((societe) =>
        societe.clients.some((client) =>
          client.sites.some((site) => site.zone_geo !== null),
        ),
      ).map((societe) => societe.pays),
    );

    // TÉMOIN DE NON-VACUITÉ : si personne n'emploie les zones, ce contrôle est
    // vert sans rien regarder — et il le resterait le jour de la bascule.
    expect(
      paysQuiEmploientLesZones.size,
      "aucune société du jeu de démonstration n'emploie les zones : ce " +
        "contrôle ne surveille rien, et il resterait vert quoi qu'il arrive",
    ).toBeGreaterThan(0);

    expect(
      [...paysQuiEmploientLesZones].sort(),
      "DEUX géographies emploient désormais l'énumération de D23. Les six " +
        "zones sont celles d'UN territoire : les faire décrire deux " +
        "géographies à la fois est le moment où elles doivent devenir un " +
        "RÉFÉRENTIEL CLOISONNÉ — une table métier `societe_id NOT NULL`, que " +
        "chaque société peuple avec sa propre géographie. C'est la bascule " +
        "enregistrée au ticket L1-02 ; son critère de déclenchement vient " +
        "d'être atteint. Voir docs/decisions/" +
        "2026-09-06-site-et-la-cle-du-compte-portail.md.",
    ).toHaveLength(1);
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
