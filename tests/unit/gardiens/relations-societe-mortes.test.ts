import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { corpsDuModele, lireSchema } from "../outils/schema-prisma";

/**
 * 9L16A-MEMOIRE-BUILD-MARGE — LE PLAFOND MÉMOIRE DE `pnpm build` SE REFERME
 * SUR UNE ACCUMULATION, PAS SUR UNE RÉCIPROQUE.
 *
 * ## Ce que ce gardien rend mesurable
 *
 * 9L04A-MEMOIRE-BUILD-CAUSE (13/11/2026, D246) a mesuré que `pnpm build`
 * déborde du plafond `--max-old-space-size` par ACCUMULATION de réciproques
 * Prisma à plusieurs (`champ Modele[]`) jamais navigées (ni `include`, ni
 * `select` imbriqué, ni accès direct) — chacune alourdit un peu le type
 * `PrismaClient` généré, aucune seule ne fait déborder. 9L13A (18/11/2026) a
 * mesuré que cette marge s'était érodée, lot après lot, depuis le correctif —
 * *exactement le risque que 9L04A nommait déjà comme ouvert*. Ce gardien
 * ferme ce risque pour `Societe`, le modèle le plus relié du schéma et celui
 * dont chaque réciproque morte pèse le plus (27 des 34 `@ignore` de 9L04A y
 * vivaient déjà).
 *
 * ## Ce qu'il ne prétend pas faire
 *
 * Un champ qui ressort de ce grep n'est pas nécessairement VIVANT : `tx.
 * demandeStatutHistorique.findMany` (l'accesseur de PREMIER NIVEAU du client
 * Prisma) et `demandeStatutHistorique: {...}` (la navigation de la
 * RÉCIPROQUE sur `Societe`) partagent le même texte, et seule une lecture du
 * code distingue les deux (9L16A, passation). Ce gardien ne fait que la
 * vérification la moins chère et la plus sûre dans le sens qui compte pour
 * la mémoire : AUCUNE occurrence du nom du champ hors de `schema.prisma`
 * veut dire, sans ambiguïté, que la réciproque n'est pas lue — et c'est
 * précisément le cas que 9L04A et 9L16A ont trouvé, chaque fois, en
 * remontant jusqu'à la compilation réelle (`pnpm typecheck`).
 */

const schema = lireSchema();
const corpsSociete = corpsDuModele(schema, "Societe");

const TYPES_SCALAIRES = new Set(["String", "Int", "Boolean", "Float", "DateTime"]);

/** Un champ de relation à plusieurs déclaré sur `Societe`, ignoré ou non. */
type ChampRelation = { readonly nom: string; readonly ignore: boolean };

function relationsAPlusieursDeSociete(): readonly ChampRelation[] {
  return corpsSociete
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0 && !ligne.startsWith("//") && !ligne.startsWith("@@"))
    .map((ligne) => {
      const motif = /^(\w+)\s+(\w+)\[\]/.exec(ligne);
      if (motif === null) {
        return null;
      }
      const [, nom, type] = motif;
      if (TYPES_SCALAIRES.has(type)) {
        return null;
      }
      return { nom, ignore: ligne.includes("@ignore") };
    })
    .filter((champ): champ is ChampRelation => champ !== null);
}

/** Le nom du champ apparaît-il hors de `prisma/schema.prisma` ? */
function estReferenceHorsDuSchema(nomDuChamp: string): boolean {
  try {
    execFileSync(
      "grep",
      [
        "-rl",
        "--include=*.ts",
        "--include=*.tsx",
        `\\b${nomDuChamp}\\b`,
        "app",
        "lib",
        "components",
        "scripts",
        "tests",
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] },
    );
    return true;
  } catch {
    // `grep` rend un code non nul quand AUCUN fichier ne correspond.
    return false;
  }
}

describe("9L16A — les réciproques de Societe n'erodent pas la marge mémoire", () => {
  it("TÉMOIN — la population n'est pas vide", () => {
    // Sans ce témoin, une erreur de motif rendrait zéro champ et le gardien
    // passerait au vert sur rien (§9, 30/08).
    expect(relationsAPlusieursDeSociete().length).toBeGreaterThan(40);
  });

  it("toute relation à plusieurs NON @ignore sur Societe est référencée hors du schéma", () => {
    const vivantes = relationsAPlusieursDeSociete().filter((c) => !c.ignore);
    const introuvables = vivantes.filter(
      (c) => !estReferenceHorsDuSchema(c.nom),
    );

    expect(
      introuvables,
      introuvables.length === 0
        ? undefined
        : `${introuvables.map((c) => c.nom).join(", ")} — aucune occurrence hors de ` +
            "prisma/schema.prisma. Avant de poser @ignore, vérifier le PARTENAIRE " +
            "de la relation (grep + compilation réelle, méthode de 9L04A/9L16A) : " +
            "un champ qui ressort d'ici peut être une vraie réciproque morte, ou " +
            "un piège documenté « PAS @ignore » comme Prestation.realisations.",
    ).toEqual([]);
  });
});
