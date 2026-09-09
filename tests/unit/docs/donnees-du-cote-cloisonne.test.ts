import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gardien de l'ÉNUMÉRATION de I1 — « ce qui vit du côté cloisonné ».
 *
 * ## Ce qu'il répare, et pourquoi c'était grave sans être visible
 *
 * I1 justifie le non-cloisonnement de `utilisateur` par une règle — *aucune
 * donnée métier sur `utilisateur`* — et par une énumération : *fonction,
 * agence de rattachement, habilitations, préférences vivent dans
 * `utilisateur_societe`*. **Mesuré le 11/09/2026 : `utilisateur_societe` porte
 * `utilisateur_id`, `societe_id` et `role`, et rien d'autre.** Trois des
 * quatre notions n'avaient de colonne nulle part.
 *
 * *La règle était juste, et son énumération était fausse.* Rien ne pouvait le
 * dire : une phrase de la constitution écrite au présent a exactement la forme
 * d'un état constaté — c'est la pente du §9 du 07/09, appliquée à la
 * constitution elle-même, et le registre du 10/09 l'avait relevée sans que
 * personne puisse la tenir ensuite.
 *
 * ## Ce qu'il vérifie, et dans les DEUX sens
 *
 * La marque `(prévu)` du §6 sépare ce qui EST de ce qui est PLANIFIÉ, et c'est
 * elle qui rend l'énumération gardable des deux côtés :
 *
 *   1. une destination énumérée **sans** marque doit exister au schéma —
 *      `table` seule, ou `table.colonne` ;
 *   2. une notion marquée `(prévu)` ne doit désigner **aucune** table ni
 *      colonne existante : le jour où la fonction reçoit sa colonne, c'est le
 *      ticket qui l'écrit qui retire la marque.
 *
 * ## Ce qu'il ne peut pas faire, et qui est écrit plutôt que tu
 *
 * Il ne juge pas si l'énumération est COMPLÈTE : rien, dans un schéma, ne dit
 * qu'une notion métier manque à l'appel. Il tient ce qui est écrit, pas ce
 * qu'on a oublié d'écrire — la même limite que le gardien de l'arborescence.
 */

function schema(): string {
  return readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
}

/** Le tableau de I1, tel qu'il est écrit — lignes « | notion | où | ». */
function lignesDuTableau(): { notion: string; ou: string }[] {
  const claude = readFileSync(join(process.cwd(), "CLAUDE.md"), "utf8");
  const bloc =
    /\| Ce qui vit du côté cloisonné \| Où, aujourd'hui \|\n\|[-| ]+\|\n([\s\S]*?)\n\n/.exec(
      claude,
    );
  if (bloc === null) {
    throw new Error(
      "Le tableau « ce qui vit du côté cloisonné » a disparu de I1 : le " +
        "gardien ne lit plus rien, et son silence ne prouverait rien.",
    );
  }
  return (bloc[1] ?? "")
    .split("\n")
    .filter((l) => l.startsWith("|"))
    .map((l) => {
      const [, notion = "", ou = ""] = l.split("|");
      return { notion: notion.trim(), ou: ou.trim() };
    });
}

/** Les `table` et `table.colonne` citées entre accents graves dans une case. */
function destinations(ou: string): string[] {
  return [...ou.matchAll(/`([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?)`/g)].map(
    (m) => m[1] ?? "",
  );
}

/** La table existe-t-elle au schéma, et porte-t-elle cette colonne ? */
function existe(destination: string): boolean {
  const texte = schema();
  const [table = "", colonne] = destination.split(".");
  const modele = new RegExp(
    `model\\s+\\w+\\s*\\{([\\s\\S]*?)@@map\\("${table}"\\)`,
  ).exec(texte);
  if (modele === null) return false;
  if (colonne === undefined) return true;
  return new RegExp(`^\\s{2}${colonne}\\s`, "m").test(modele[1] ?? "");
}

const lignes = lignesDuTableau();

describe("I1 — ce qui vit du côté cloisonné", () => {
  it("a réellement lu le tableau, et il n'est pas vide", () => {
    // Témoin de non-vacuité : un tableau vide passerait toutes les assertions
    // ci-dessous sans avoir rien regardé (§9, 30/08).
    expect(lignes.length).toBeGreaterThanOrEqual(6);
    expect(lignes.filter((l) => !l.ou.includes("(prévu)")).length).toBeGreaterThanOrEqual(3);
    expect(lignes.filter((l) => l.ou.includes("(prévu)")).length).toBeGreaterThanOrEqual(1);
  });

  it("toute destination NON marquée « (prévu) » existe au schéma", () => {
    const manquantes: string[] = [];
    for (const ligne of lignes) {
      if (ligne.ou.includes("(prévu)")) continue;
      const vues = destinations(ligne.ou);
      expect(
        vues.length,
        `« ${ligne.notion} » ne nomme aucune table : une destination se cite entre accents graves`,
      ).toBeGreaterThan(0);
      for (const destination of vues) {
        if (!existe(destination)) manquantes.push(`${ligne.notion} → ${destination}`);
      }
    }
    expect(
      manquantes,
      `I1 énumère des destinations que prisma/schema.prisma ne porte pas :\n${manquantes.join("\n")}`,
    ).toEqual([]);
  });

  it("toute notion marquée « (prévu) » ne désigne RIEN qui existe", () => {
    // Le sens silencieux : le jour où la fonction reçoit sa colonne, la marque
    // devient fausse et personne ne le remarque — c'est le trou que le §6 a
    // fermé pour les modules, fermé ici pour les colonnes.
    const arrivees: string[] = [];
    for (const ligne of lignes) {
      if (!ligne.ou.includes("(prévu)")) continue;
      for (const destination of destinations(ligne.ou)) {
        if (existe(destination)) arrivees.push(`${ligne.notion} → ${destination}`);
      }
    }
    expect(
      arrivees,
      `Ces notions sont marquées « (prévu) » et existent pourtant au schéma — la marque est à retirer :\n${arrivees.join("\n")}`,
    ).toEqual([]);
  });
});
