import { describe, expect, it } from "vitest";

import { migrationsSql, type Migration } from "../outils/migrations-sql";

/**
 * Gardien de D50 : **aucune fonction `SECURITY DEFINER` dans une migration**,
 * sauf entrée d'une liste close — aujourd'hui vide.
 *
 * **La tentation qu'il ferme, et elle est nommée.** Le chaînage de D48 porte
 * `ON UPDATE RESTRICT` des deux côtés (D49), mais un seul des deux refus a un
 * déclencheur explicatif : `agence_territoire_verrou_ecarts`. Rien de tel côté
 * `jour_ferie`. Vue de loin, cette asymétrie ressemble à un oubli — et un oubli
 * appelle quelqu'un pour le corriger, c'est-à-dire pour recopier le
 * déclencheur. Il découvrira alors qu'un déclencheur `SECURITY INVOKER` n'y
 * voit rien : l'écrivain de `jour_ferie` est un rôle éditeur sans société
 * active, et `calendrier_ferie` est cloisonnée en `FORCE ROW LEVEL SECURITY`
 * (mesuré : 0 écart vu contre 1 réel). Le réflexe suivant est `SECURITY
 * DEFINER` sur un rôle `BYPASSRLS`. **C'est exactement la direction
 * dangereuse** : un message d'erreur deviendrait un lecteur inter-sociétés, et
 * un décompte apprendrait à un salarié de l'éditeur combien d'agences clientes
 * chôment ce jour-là.
 *
 * **Pourquoi une interdiction large plutôt qu'un motif étroit.** On pourrait
 * ne refuser que les déclencheurs `SECURITY DEFINER` posés sur une table
 * cloisonnée. Il faudrait alors relier, en lisant du SQL, une fonction à son
 * déclencheur puis à sa table, et le premier contournement — une fonction
 * appelée depuis une politique plutôt que depuis un déclencheur — passerait au
 * travers. `SECURITY DEFINER` est le mécanisme qui fait sauter le
 * cloisonnement, quel que soit l'endroit d'où on l'appelle : c'est lui qu'on
 * surveille. La liste close reprend l'idiome de I1 — une exception se nomme,
 * elle ne se déduit pas.
 *
 * **La liste est vide, et elle a déjà un premier candidat connu.** Le repli de
 * consolidation portable de D36 (lot 5) sera une fonction `SECURITY DEFINER`.
 * Il y entrera **par arbitrage**, avec son nom écrit ici — pas par une décision
 * de session qui trouverait le gardien encombrant.
 */

/**
 * Fonctions `SECURITY DEFINER` autorisées, par arbitrage explicite.
 *
 * **CLOSE ET VIDE.** Une addition se décide dans `docs/arbitrages.md`, jamais
 * dans un ticket : c'est la règle de toutes les listes closes du projet
 * (CLAUDE.md §3, leçon du 20/08).
 */
const AUTORISEES_PAR_ARBITRAGE: readonly string[] = [];

/**
 * Les migrations à inspecter. La lecture vit dans `outils/migrations-sql.ts`
 * depuis L0-10 : deux gardiens la partagent, chacun avec sa propre règle.
 */
export function migrations(): Migration[] {
  return migrationsSql();
}

/**
 * Retire du SQL ce qui DOCUMENTE, pour ne garder que ce qui S'EXÉCUTE.
 *
 * **Sans cela, le gardien se mordrait la queue** — et il l'a fait à la
 * première exécution : la note de D50 explique précisément pourquoi on
 * n'emploie PAS `SECURITY DEFINER`, elle emploie donc ces deux mots, et le
 * gardien a refusé la phrase qui énonce sa propre règle. Un gardien qui
 * interdit d'écrire sa raison d'être apprend surtout à ne plus l'écrire.
 *
 * **La coupure n'est donc pas « commentaires », c'est « documentation contre
 * exécution ».** Deux choses sont retirées, et deux seulement :
 *   — les commentaires `--`, qui ne s'exécutent jamais ;
 *   — les instructions `COMMENT ON … IS '…'`, qui ne créent rien : elles
 *     déposent du texte dans `pg_description`, et c'est précisément là que
 *     D50 veut que la note vive, à côté de l'objet concerné.
 * Tout le reste est examiné, **y compris les chaînes littérales** : la faute
 * écrite dans un bloc `DO $$ … $$`, dans un `EXECUTE 'CREATE FUNCTION …
 * SECURITY DEFINER …'` ou dans un `EXECUTE format(…)` est vue — mesuré, elle
 * est refusée dans les trois cas.
 *
 * **La limite honnête du gardien est ailleurs, et c'est celle-ci : les deux
 * mots assemblés à l'exécution.** `'SECURITY ' || 'DEFINER'` passe, et un nom
 * construit à l'exécution aussi — mesuré également. Aucun contrôle textuel ne
 * les verrait. Un gardien statique arrête donc la correction **bien
 * intentionnée**, pas le contournement **décidé** ; l'exemple qui illustre
 * cette limite doit être celui qui passe réellement, sans quoi le lecteur
 * conclut que le gardien est plus faible qu'il n'est.
 *
 * Le motif de `COMMENT ON` va jusqu'à la chaîne fermante plutôt qu'au premier
 * `;` : un point-virgule à l'intérieur du texte couperait sinon l'instruction
 * en deux et laisserait sa fin dans le périmètre examiné. Les quotes doublées
 * de SQL sont prises en compte.
 */
export function sansCommentairesSql(sql: string): string {
  return sql
    .split("\n")
    .map((ligne) => ligne.replace(/--.*$/, ""))
    .join("\n")
    .replace(/comment\s+on\b[^']*'(?:[^']|'')*'\s*;/gi, "");
}

/**
 * Le motif. Insensible à la casse, et tolérant sur les espaces : PostgreSQL
 * accepte `security definer` en minuscules comme sur plusieurs lignes, et une
 * faute ne se commet pas forcément dans la graphie qu'on attend (leçon du
 * 21/08 — un motif qui ne voit qu'une forme laisse passer les autres).
 */
const SECURITY_DEFINER = /security\s+definer/gi;

/** Le nom de la fonction déclarée juste avant l'occurrence trouvée. */
function fonctionPortante(sqlNettoye: string, position: number): string {
  const avant = sqlNettoye.slice(0, position);
  const declarations = [
    ...avant.matchAll(/create\s+(?:or\s+replace\s+)?function\s+"?([\w.]+)"?/gi),
  ];
  return declarations[declarations.length - 1]?.[1] ?? "(fonction inconnue)";
}

/** Écarts au sens de D50 — une liste vide est le seul état acceptable. */
export function ecartsSecurityDefiner(
  fichiers: readonly Migration[],
  autorisees: readonly string[] = AUTORISEES_PAR_ARBITRAGE,
): string[] {
  const ecarts: string[] = [];

  for (const fichier of fichiers) {
    const sql = sansCommentairesSql(fichier.sql);
    for (const trouve of sql.matchAll(SECURITY_DEFINER)) {
      const fonction = fonctionPortante(sql, trouve.index);
      if (autorisees.includes(fonction)) {
        continue;
      }
      ecarts.push(
        `${fichier.chemin} : la fonction « ${fonction} » est déclarée ` +
          "SECURITY DEFINER. Elle s'exécute avec les droits de son " +
          "propriétaire et échappe donc au cloisonnement — y compris à " +
          "FORCE ROW LEVEL SECURITY. Si c'est pour donner un message d'erreur " +
          "explicatif là où un déclencheur SECURITY INVOKER ne voit rien " +
          "(le refus côté jour_ferie, par exemple), c'est précisément ce que " +
          "D50 refuse : un message d'erreur est un canal d'information, " +
          "soumis au cloisonnement comme une requête. Toute exception passe " +
          "par un arbitrage et s'inscrit dans AUTORISEES_PAR_ARBITRAGE — " +
          "elle ne se décide pas dans un ticket.",
      );
    }
  }

  return ecarts;
}

describe("aucune fonction SECURITY DEFINER hors arbitrage (D50)", () => {
  const fichiers = migrations();

  it("lit réellement des migrations — sinon le gardien serait vide", () => {
    // Un gardien qui ne parcourt rien passe au vert sans rien garder.
    expect(fichiers.length).toBeGreaterThan(5);
    expect(
      fichiers.some((fichier) => fichier.sql.includes("CREATE FUNCTION")),
    ).toBe(true);
  });

  it("la liste des exceptions est close, et vide", () => {
    // Elle se vérifie explicitement : une entrée apparue sans arbitrage doit
    // faire tomber ce test-ci, pas seulement échapper au précédent.
    expect(
      AUTORISEES_PAR_ARBITRAGE,
      "une exception a été ajoutée sans arbitrage : D36 (lot 5) est le premier " +
        "candidat connu, et il y entrera par une décision écrite",
    ).toEqual([]);
  });

  it("aucune migration ne déclare de fonction SECURITY DEFINER", () => {
    expect(ecartsSecurityDefiner(fichiers)).toEqual([]);
  });

  /**
   * ÉPREUVE PAR RETRAIT — les trois exigences du §9.
   *
   * Le verrou visé est bien celui-ci, et non un voisin : on ne retire aucune
   * autre contrainte, on écrit LA faute. Le scénario se place là où le défaut
   * RÉUSSIRAIT — la violation est greffée dans le fichier de migration réel qui
   * porte le déclencheur `agence`, sous la forme exacte qu'un correcteur
   * bien intentionné écrirait : un jumeau côté `jour_ferie`. Et l'assertion
   * NOMME la fonction fautive, sans quoi un écart venu d'ailleurs passerait
   * pour celui-ci.
   */
  const JUMEAU_TENTANT = `
CREATE FUNCTION "jour_ferie_correction_verrou_ecarts"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE nombre BIGINT;
BEGIN
  SELECT count(*) INTO nombre FROM "calendrier_ferie" WHERE "jour_ferie_id" = OLD."id";
  IF nombre > 0 THEN
    RAISE EXCEPTION 'Correction refusée : % écart(s) référencent ce férié.', nombre;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "jour_ferie_correction_verrou_ecarts"
  BEFORE UPDATE ON "jour_ferie"
  FOR EACH ROW EXECUTE FUNCTION "jour_ferie_correction_verrou_ecarts"();
`;

  function migrationDuDeclencheur(): Migration {
    const trouvee = fichiers.find((fichier) =>
      fichier.sql.includes('CREATE TRIGGER "agence_territoire_verrou_ecarts"'),
    );
    if (trouvee === undefined) {
      throw new Error(
        "La migration portant `agence_territoire_verrou_ecarts` est " +
          "introuvable : l'épreuve ne peut pas se placer là où la faute se " +
          "commettrait.",
      );
    }
    return trouvee;
  }

  it("ÉPREUVE : le jumeau tentant, greffé dans la vraie migration, est refusé", () => {
    const reelle = migrationDuDeclencheur();
    const fautive = { ...reelle, sql: reelle.sql + JUMEAU_TENTANT };

    const ecarts = ecartsSecurityDefiner([fautive]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("jour_ferie_correction_verrou_ecarts");
    expect(ecarts[0]).toContain(reelle.chemin);
    expect(ecarts[0]).toContain("canal d'information");
  });

  it("ÉPREUVE : les graphies détournées sont vues elles aussi", () => {
    // Un motif qui ne voit qu'une forme laisse passer les autres (leçon du
    // 21/08). Minuscules, retour à la ligne, espaces multiples : PostgreSQL
    // accepte les trois.
    for (const graphie of [
      'CREATE FUNCTION "f"() RETURNS trigger LANGUAGE plpgsql security definer AS $$ BEGIN RETURN NEW; END $$;',
      'CREATE FUNCTION "f"() RETURNS trigger\n  LANGUAGE plpgsql\n  SECURITY\n  DEFINER\n  AS $$ BEGIN RETURN NEW; END $$;',
      'CREATE OR REPLACE FUNCTION "f"() RETURNS trigger LANGUAGE plpgsql   Security   Definer AS $$ BEGIN RETURN NEW; END $$;',
    ]) {
      expect(
        ecartsSecurityDefiner([{ chemin: "fabriquée.sql", sql: graphie }]),
        graphie,
      ).toHaveLength(1);
    }
  });

  it("mais la NOTE qui explique la règle passe — éprouvé sur la vraie note", () => {
    // Le gardien se mordrait la queue autrement, et il l'a fait : la note de
    // D50 emploie nécessairement les deux mots qu'elle interdit, dans un
    // commentaire `--` ET dans une chaîne de `COMMENT ON`. Éprouvé sur la
    // vraie note, pas sur une phrase fabriquée — c'est elle qui doit survivre.
    const note = fichiers.find((fichier) =>
      fichier.chemin.includes("note_asymetrie_message_cloisonne"),
    );
    expect(
      note,
      "la migration portant la note de D50 est introuvable",
    ).toBeDefined();
    expect(note?.sql).toMatch(/SECURITY DEFINER/);
    expect(note?.sql).toMatch(/COMMENT ON FUNCTION/);
    expect(ecartsSecurityDefiner([note as Migration])).toEqual([]);
  });

  it("ÉPREUVE : l'exemption de COMMENT ON n'ouvre pas de trou", () => {
    // Le risque de la coupure précédente : qu'une vraie déclaration se glisse
    // dans un fichier qui porte aussi une note, et passe avec elle. On place
    // donc les deux côte à côte — la note réelle, puis la faute réelle — et on
    // exige exactement un écart, celui de la fonction, nommé.
    const note = fichiers.find((fichier) =>
      fichier.chemin.includes("note_asymetrie_message_cloisonne"),
    ) as Migration;

    const ecarts = ecartsSecurityDefiner([
      { ...note, sql: note.sql + JUMEAU_TENTANT },
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("jour_ferie_correction_verrou_ecarts");
  });
});
