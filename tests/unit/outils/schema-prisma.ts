import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RACINE } from "./fichiers-source";

/**
 * Lecture du schéma Prisma, pour les gardiens statiques (L0-06b, arbitrage D39).
 *
 * Une règle de I1 ne se prouve pas en exécutant du code : « aucune donnée métier
 * sur `utilisateur` » porte sur la FORME du schéma, pas sur son comportement. Ce
 * module fournit la lecture ; le test fournit la règle.
 *
 * L'analyse est délibérément grossière — repérer un bloc `model X { … }` et en
 * lister les champs suffit, et c'est ce qui la rend lisible. Elle est éprouvée
 * sur un schéma fabriqué avant de l'être sur le vrai : une extraction fautive
 * rendrait le gardien vert sur n'importe quoi.
 */

/** Chemin du schéma. */
export const FICHIER_SCHEMA = join(RACINE, "prisma", "schema.prisma");

/** Le schéma tel qu'il est écrit dans le dépôt. */
export function lireSchema(): string {
  return readFileSync(FICHIER_SCHEMA, "utf8");
}

/**
 * Corps d'un modèle, commentaires et lignes vides retirés.
 *
 * Les accolades sont appariées : un bloc `@@unique([…])` ou un attribut portant
 * une accolade ne doit pas clore le modèle prématurément.
 */
export function corpsDuModele(schema: string, modele: string): string {
  // L'indentation est tolérée : le schéma réel déclare ses modèles en colonne
  // zéro, mais les schémas fabriqués des scénarios sont indentés dans le code.
  const entete = new RegExp(`^[ \t]*model\\s+${modele}\\s*\\{`, "m").exec(
    schema,
  );
  if (entete === null) {
    throw new Error(`Modèle « ${modele} » introuvable dans le schéma Prisma.`);
  }

  let profondeur = 0;
  const depart = entete.index + entete[0].length - 1;
  let curseur = depart;

  for (; curseur < schema.length; curseur += 1) {
    const caractere = schema[curseur];
    if (caractere === "{") {
      profondeur += 1;
    } else if (caractere === "}") {
      profondeur -= 1;
      if (profondeur === 0) {
        break;
      }
    }
  }

  return schema.slice(depart + 1, curseur);
}

/**
 * Noms des champs d'un modèle — colonnes scalaires ET relations.
 *
 * Les deux comptent pour I1 : une colonne `agence_id` et une relation
 * `agence Agence` disent exactement la même chose du point de vue de la règle
 * « aucune donnée métier sur `utilisateur` ».
 *
 * Les lignes d'attribut de bloc (`@@map`, `@@unique`, `@@index`) et les
 * commentaires (`//`, `///`) sont écartés : ce ne sont pas des champs.
 */
export function champsDuModele(schema: string, modele: string): string[] {
  return corpsDuModele(schema, modele)
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0)
    .filter((ligne) => !ligne.startsWith("//") && !ligne.startsWith("@@"))
    .map((ligne) => ligne.split(/\s+/)[0] ?? "")
    .filter((nom) => nom.length > 0);
}
