import { TABLES_RLS_FORCEE } from "./rls-declaree";

/**
 * LES BLOCS DE GARDE DES MIGRATIONS, ET LE MÉCANISME QUI LES AVEUGLE
 * (ticket L1-02, 07/09/2026 ; CLAUDE.md §9 — la population auto-sélectionnée).
 *
 * ## La classe de défaut, et pourquoi c'est une CLASSE
 *
 * Une migration qui refuse de s'appliquer sur un état inattendu commence par
 * regarder cet état : `SELECT … FROM "agence" WHERE "territoire" IS NULL`, puis
 * `RAISE EXCEPTION` si elle trouve quelque chose. C'est un bon réflexe, et le
 * dépôt en compte plusieurs.
 *
 * **Mais `FORCE ROW LEVEL SECURITY` s'applique au PROPRIÉTAIRE**, donc à la
 * migration. Sans contexte société posé, le propriétaire ne voit AUCUNE ligne
 * des tables cloisonnées. Le bloc trouve zéro, ne lève rien, et se croit
 * rassuré : **il ne se trompe pas, il ne regarde rien.**
 *
 * Mesuré le 06/09/2026, propriétaire non superutilisateur, deux lignes en
 * table : `FORCE` actif → **0 ligne vue** ; `NO FORCE` → 2. Et en local, le
 * rôle de migration est SUPERUTILISATEUR, donc il contourne RLS et voit tout.
 * **Le seul environnement où le défaut existe est le seul qui ne soit jamais
 * exercé** — la leçon du 23/08 sur la latence, rejouée sur les privilèges.
 *
 * C'est la population auto-sélectionnée du 31/08 dans sa forme la plus
 * coûteuse : le `WHERE` implicite qui exclut les lignes n'est pas écrit par
 * l'auteur, il est posé par la base.
 *
 * ## LA RÈGLE, et elle ne vise pas une réparation
 *
 * **Tout bloc de garde qui lit une table sous `FORCE` doit rendre visible le
 * mécanisme qui pourrait l'aveugler.** Deux gestes, et le second est celui
 * qu'on oublie :
 *
 *   1. LEVER `FORCE` pour la durée du diagnostic — `ALTER TABLE … NO FORCE ROW
 *      LEVEL SECURITY` —, et le rendre dans la même transaction ;
 *   2. **REFUSER DE COMPTER tant que la levée n'est pas constatée.** Un témoin
 *      qui lit `relforcerowsecurity` et lève une exception s'il est encore
 *      vrai. Il porte sur le MÉCANISME, jamais sur un décompte : un décompte
 *      légitimement nul rendrait le témoin muet, ce qui est précisément le cas
 *      qu'on veut distinguer.
 *
 * Poser le contexte société à la place de la levée est une variante valable
 * quand on sait de quelle société il s'agit — mais on ne le sait presque jamais
 * dans une migration, `societe` étant elle-même cloisonnée par son identité.
 *
 * ## CE QUE CE MODULE NE PEUT PAS FAIRE, et qui se dit
 *
 * Il lit du SQL statiquement. Il reconnaît un bloc `DO $$ … $$` et les tables
 * qu'il nomme après `FROM` ou `JOIN` ; il ne suit pas un nom de table assemblé
 * à l'exécution, ni une lecture faite depuis une fonction appelée par le bloc.
 * C'est la forme 6 du §9 — l'assemblage délibéré —, et un gardien statique
 * arrête la correction bien intentionnée, pas un contournement décidé.
 */

/** Une migration, telle que le lecteur de fichiers la donne à ce module. */
export type MigrationLue = {
  readonly nom: string;
  readonly sql: string;
};

/** Un bloc de garde aveugle, tel que ce module le décrit. */
export type GardeAveugle = {
  readonly migration: string;
  readonly tables: readonly string[];
};

/**
 * Les migrations DÉJÀ APPLIQUÉES qui portent le défaut, et qu'on ne peut donc
 * plus corriger — une migration appliquée est immuable (CLAUDE.md §7).
 *
 * **Un défaut connu et inventorié n'est pas le même objet qu'un défaut connu et
 * unique.** Cette liste existe pour que le second ne se confonde pas avec le
 * premier : elle dit ce qui est déjà en base, et le gardien refuse tout ajout.
 *
 * Chaque entrée dit ce que le bloc CROIT vérifier et ce qu'il vérifie
 * réellement — sans quoi une liste d'exemptions redevient un passage.
 */
export const GARDES_AVEUGLES_CONNUES: readonly {
  readonly migration: string;
  readonly justification: string;
}[] = [
  {
    migration: "20260823130000_territoire_du_ferie_reference",
    justification:
      "DÉJÀ APPLIQUÉE, donc immuable. Deux blocs : l'un lit `agence` et " +
      "`societe` pour refuser une agence sans territoire, l'autre lit " +
      "`agence` et `calendrier_ferie`. Sur la base hébergée, dont le rôle de " +
      "migration est propriétaire NON superutilisateur, ils voient zéro ligne " +
      "et ne peuvent donc RIEN refuser. Leur effet réel est nul, pas néfaste : " +
      "les contraintes qu'ils précèdent (`SET NOT NULL`, les clés composites) " +
      "échouent d'elles-mêmes sur un état fautif, mais avec un message de " +
      "PostgreSQL qui ne dit ni quelle agence ni quoi faire. Ce qui est perdu " +
      "est la LISIBILITÉ du refus, pas le refus. Rien à reprendre : la " +
      "migration s'est appliquée, donc l'état était bon.",
  },
] as const;

/** Le nom des migrations connues comme aveugles. */
export function migrationsConnues(
  connues: readonly { migration: string }[] = GARDES_AVEUGLES_CONNUES,
): string[] {
  return connues.map((entree) => entree.migration);
}

/** Un bloc `DO $$ … $$`, tel qu'une migration l'écrit. */
const BLOC_DO = /DO\s+\$\$([\s\S]*?)\$\$\s*;/gi;

/** Les tables nommées après `FROM` ou `JOIN`, guillemets ou non. */
const TABLE_LUE = /(?:FROM|JOIN)\s+"?([a-z_][a-z0-9_]*)"?/gi;

/** La levée du drapeau, dans la graphie que PostgreSQL accepte. */
const LEVEE =
  /ALTER\s+TABLE\s+"?([a-z_][a-z0-9_]*)"?\s+NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi;

/**
 * Le TÉMOIN : le fichier constate-t-il l'état du drapeau ?
 *
 * `relforcerowsecurity` est le seul endroit où cet état se lit. Exiger sa
 * présence est un proxy, et il est annoncé comme tel : il ne prouve pas que le
 * témoin soit bien placé, seulement qu'il existe. Ce qu'un motif statique peut
 * tenir s'arrête là ; la revue fait le reste.
 */
const TEMOIN = /relforcerowsecurity/i;

/** Les tables sous `FORCE` qu'un bloc de garde lit. */
export function tablesLuesSousForce(
  bloc: string,
  forcees: readonly string[] = TABLES_RLS_FORCEE,
): string[] {
  const lues = new Set<string>();
  for (const trouve of bloc.matchAll(TABLE_LUE)) {
    const table = (trouve[1] ?? "").toLowerCase();
    if (forcees.includes(table)) {
      lues.add(table);
    }
  }
  return [...lues].sort();
}

/** Les blocs de garde d'une migration qui lisent sous `FORCE` sans se protéger. */
export function gardesAveugles(
  migration: MigrationLue,
  forcees: readonly string[] = TABLES_RLS_FORCEE,
): GardeAveugle[] {
  const aveugles: GardeAveugle[] = [];

  for (const trouve of migration.sql.matchAll(BLOC_DO)) {
    const bloc = trouve[1] ?? "";
    const lues = tablesLuesSousForce(bloc, forcees);
    if (lues.length === 0) {
      continue;
    }

    // Levées et témoin sont cherchés dans TOUT le fichier, pas dans le bloc :
    // la levée précède nécessairement le bloc, et le témoin peut vivre dans un
    // second bloc — c'est d'ailleurs la forme que prend le contrôle de sortie.
    const levees = new Set(
      [...migration.sql.matchAll(LEVEE)].map((m) => (m[1] ?? "").toLowerCase()),
    );
    const nonLevees = lues.filter((table) => !levees.has(table));

    if (nonLevees.length > 0 || !TEMOIN.test(migration.sql)) {
      aveugles.push({
        migration: migration.nom,
        tables: nonLevees.length > 0 ? nonLevees : lues,
      });
    }
  }

  return aveugles;
}

/**
 * Écarts : tout bloc de garde aveugle qui n'est pas une migration déjà
 * appliquée et inventoriée.
 *
 * Le témoin de population ouvre la fonction — zéro migration parcourue
 * ressemble trait pour trait à zéro défaut (§9, 30/08).
 */
export function ecartsGardes(
  migrations: readonly MigrationLue[],
  connues: readonly {
    readonly migration: string;
    readonly justification: string;
  }[] = GARDES_AVEUGLES_CONNUES,
  forcees: readonly string[] = TABLES_RLS_FORCEE,
): string[] {
  if (migrations.length === 0) {
    return [
      "aucune migration parcourue : le contrôle des blocs de garde n'a rien " +
        "établi. Répertoire vide, ou lecture jouée hors du chemin attendu.",
    ];
  }

  const ecarts: string[] = [];
  const nomsConnus = migrationsConnues(connues);
  const existantes = new Set(migrations.map((m) => m.nom));

  // Corollaire du 31/08 sur les sélections négatives : une entrée qui ne
  // s'adosse à aucune migration ne protège plus rien, et la prochaine qui
  // reprendrait ce nom en hériterait sans que personne ne le lui ait accordé.
  for (const connue of connues) {
    if (!existantes.has(connue.migration)) {
      ecarts.push(
        `« ${connue.migration} » est inventoriée comme garde aveugle connue ` +
          "alors qu'aucune migration ne porte ce nom : l'entrée ne protège " +
          "plus rien.",
      );
    }
    if (connue.justification.trim().length === 0) {
      ecarts.push(
        `« ${connue.migration} » est inventoriée sans justification écrite. ` +
          "Une entrée sans « ce que le bloc croit vérifier, et ce qu'il " +
          "vérifie » est un passage, pas un inventaire.",
      );
    }
  }

  for (const migration of migrations) {
    for (const aveugle of gardesAveugles(migration, forcees)) {
      if (nomsConnus.includes(aveugle.migration)) {
        continue;
      }
      ecarts.push(
        `« ${aveugle.migration} » porte un bloc de garde qui lit ` +
          `${aveugle.tables.map((t) => `« ${t} »`).join(", ")} sous ` +
          "`FORCE ROW LEVEL SECURITY` sans lever le drapeau ni constater la " +
          "levée. Sur la base hébergée — propriétaire NON superutilisateur — " +
          "ce bloc voit ZÉRO ligne et ne peut donc rien refuser : il ne se " +
          "trompe pas, il ne regarde rien. En local le rôle de migration est " +
          "superutilisateur et contourne RLS, si bien que le défaut n'existe " +
          "QUE là où rien ne l'exerce. Lever `FORCE` pour la durée du " +
          "diagnostic, le rendre dans la même transaction, et REFUSER DE " +
          "COMPTER tant que `relforcerowsecurity` n'a pas été constaté faux.",
      );
    }
  }

  return ecarts;
}
