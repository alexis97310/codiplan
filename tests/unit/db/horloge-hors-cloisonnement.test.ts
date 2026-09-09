import { describe, expect, it } from "vitest";

import {
  migrationsSql,
  sansCommentairesSql,
  type Migration,
} from "../outils/migrations-sql";

/**
 * Gardien de **D85 — l'horloge n'entre pas dans le cloisonnement**.
 *
 * *« Aucune politique de cloisonnement n'évalue l'heure. Quand un fait de
 * cloisonnement dépend du temps, il est MATÉRIALISÉ : une colonne porte
 * l'état, un travail écrit la colonne, la politique lit la colonne. »*
 *
 * ## Ce que ce gardien regarde, et ce qu'il ne regarde pas
 *
 * Il lit l'**expression** de chaque `CREATE POLICY` et `ALTER POLICY` des
 * migrations — `USING` et `WITH CHECK` — et refuse qu'y figure une fonction
 * temporelle de PostgreSQL. Il ne regarde ni les déclencheurs, ni les valeurs
 * par défaut, ni le code applicatif : **une écriture a le droit d'être datée**,
 * c'est une lecture qui n'a pas le droit de changer toute seule.
 *
 * **Une politique peut lire une colonne de type date sans évaluer l'heure.**
 * `date_planifiee` est une donnée que quelqu'un a écrite ; `now()` est une
 * valeur que personne n'a écrite. C'est la PROVENANCE qui décide, jamais le
 * type — et c'est pourquoi le gardien porte, à côté de chaque cas qui doit
 * rougir, un cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09).
 *
 * ## Les six formes (§9, 26/08), et le verdict mesuré sur chacune
 *
 * 1. **Graphie** — `NOW ( )`, `Now()`, un retour à la ligne entre le nom et la
 *    parenthèse, `pg_catalog.now()` : **refusées**.
 * 2. **Enveloppe d'exécution** — la faute dans un `DO $$ … $$` ou un
 *    `EXECUTE format(…)` : **refusée**. Le périmètre examiné ne retire jamais
 *    les chaînes littérales ; la seule coupure est documentation contre
 *    exécution, et elle vit dans `outils/migrations-sql.ts`.
 * 3. **Deux temps** — l'objet innocent puis son basculement :
 *    `ALTER POLICY … USING (now() …)` : **refusée**. C'est l'état final qui
 *    compte, pas le verbe qui l'installe.
 * 4. **L'exemption** — il n'y en a aucune, et c'est le seul état acceptable :
 *    la liste n'existe pas, donc rien ne peut s'y glisser.
 * 5. **La forme voisine** — celle qu'un correcteur bien intentionné écrirait,
 *    greffée dans le fichier de migration RÉEL où elle se commettrait : la
 *    fenêtre des 7 jours de RG-DRO-02 ajoutée à `cloisonnement_parc` sur
 *    `intervention` : **refusée**.
 * 6. **Hors de portée, et le gardien le dit** — l'assemblage délibéré
 *    (`'no' || 'w()'`), un nom construit à l'exécution. Aucun motif statique
 *    ne les voit. Ce gardien arrête la correction **bien intentionnée**, pas
 *    le contournement **décidé**.
 */

/**
 * Les fonctions par lesquelles PostgreSQL rend l'heure courante.
 *
 * `now`, `transaction_timestamp` et `current_timestamp` sont stables dans une
 * transaction ; `clock_timestamp` et `statement_timestamp` ne le sont même pas.
 * **La stabilité transactionnelle ne sauve rien ici** : elle rend une requête
 * cohérente avec elle-même, jamais deux requêtes cohérentes entre elles, et
 * c'est la seconde propriété que D85 exige.
 *
 * Les trois dernières s'écrivent **sans parenthèses** en SQL — d'où deux motifs
 * plutôt qu'un.
 */
const AVEC_PARENTHESES = [
  "now",
  "clock_timestamp",
  "statement_timestamp",
  "transaction_timestamp",
  "timeofday",
] as const;

const SANS_PARENTHESES = [
  "current_timestamp",
  "current_date",
  "current_time",
  "localtimestamp",
  "localtime",
] as const;

/**
 * Le motif. Insensible à la casse, tolérant sur les espaces et sur la
 * qualification par un schéma (`pg_catalog.now()`), et il exige une frontière
 * de mot en tête : `snow()` n'est pas `now()`, et une colonne nommée
 * `date_maj_now` ne doit pas rougir.
 */
const HORLOGE = new RegExp(
  "(?<![\\w.])(?:pg_catalog\\s*\\.\\s*)?(?:" +
    `(?:${AVEC_PARENTHESES.join("|")})\\s*\\(` +
    "|" +
    `(?:${SANS_PARENTHESES.join("|")})\\b` +
    ")",
  "gi",
);

/** Une instruction de politique isolée de son fichier. */
type Politique = { chemin: string; texte: string; position: number };

/**
 * Isole chaque `CREATE POLICY` / `ALTER POLICY` jusqu'à son `;` terminal.
 *
 * Le découpage naïf sur `;` ne convient pas : une expression peut contenir une
 * chaîne littérale, et une migration contient des blocs `$$ … $$` dont les
 * points-virgules ne terminent rien. Le balayage saute donc les chaînes (avec
 * leurs quotes doublées) et les blocs à dollars.
 */
export function politiquesDeMigration(fichiers: readonly Migration[]) {
  const politiques: Politique[] = [];

  for (const fichier of fichiers) {
    const sql = sansCommentairesSql(fichier.sql);
    const debuts = [
      ...sql.matchAll(/\b(?:create|alter)\s+policy\b/gi),
    ] as RegExpMatchArray[];

    for (const debut of debuts) {
      const depart = debut.index ?? 0;
      let i = depart;
      while (i < sql.length) {
        const c = sql[i];
        if (c === "'") {
          i += 1;
          while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) {
            i += sql[i] === "'" ? 2 : 1;
          }
          i += 1;
          continue;
        }
        const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
        if (dollar !== null) {
          const marque = dollar[0];
          const fin = sql.indexOf(marque, i + marque.length);
          i = fin === -1 ? sql.length : fin + marque.length;
          continue;
        }
        if (c === ";") {
          break;
        }
        i += 1;
      }
      politiques.push({
        chemin: fichier.chemin,
        texte: sql.slice(depart, i),
        position: depart,
      });
    }
  }

  return politiques;
}

/** Écarts au sens de D85 — une liste vide est le seul état acceptable. */
export function ecartsHorloge(fichiers: readonly Migration[]): string[] {
  const ecarts: string[] = [];

  for (const politique of politiquesDeMigration(fichiers)) {
    const trouvees = [...politique.texte.matchAll(HORLOGE)].map((t) =>
      t[0].trim(),
    );
    if (trouvees.length === 0) {
      continue;
    }
    const nom =
      /\b(?:create|alter)\s+policy\s+"?([\w]+)"?/i.exec(politique.texte)?.[1] ??
      "(politique inconnue)";
    ecarts.push(
      `${politique.chemin} : la politique « ${nom} » évalue l'heure ` +
        `(${[...new Set(trouvees)].join(", ")}). D85 l'interdit : le ` +
        "cloisonnement répond à « qui a le droit de lire cette ligne », et " +
        "cette réponse ne doit pas changer d'elle-même — un audit lancé à " +
        "23:59 et à 00:01 se contredirait sans qu'aucune écriture n'ait eu " +
        "lieu, et le jumeau d'un refus passerait parce que l'horloge a bougé " +
        "plutôt que parce que le verrou a cédé. Quand un fait de " +
        "cloisonnement dépend du temps, il se MATÉRIALISE : une colonne " +
        "porte l'état, un travail écrit la colonne, la politique lit la " +
        "colonne. L'horloge ne touche que le travail.",
    );
  }

  return ecarts;
}

describe("aucune politique de cloisonnement n'évalue l'heure (D85)", () => {
  const fichiers = migrationsSql();
  const politiques = politiquesDeMigration(fichiers);

  it("lit réellement des politiques — le témoin de non-vacuité", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08) : sans
    // ce témoin, un motif d'isolement cassé rendrait « zéro violation ».
    expect(politiques.length).toBeGreaterThan(40);
    expect(
      politiques.some((p) => p.texte.includes("app.perimetre_sites")),
      "la forme « parc » doit figurer parmi les politiques lues",
    ).toBe(true);
  });

  it("aucune migration ne porte de politique dépendante de l'horloge", () => {
    expect(ecartsHorloge(fichiers)).toEqual([]);
  });

  /**
   * ÉPREUVE PAR GREFFE — la forme VOISINE (§9, 26/08, forme 5), écrite dans le
   * fichier réel où elle se commettrait, sous la graphie exacte qu'un
   * correcteur bien intentionné emploierait : RG-DRO-02 rendue « enfin »
   * opposable en base. C'est le texte que D84 a mesuré comme exprimable.
   */
  const FENETRE_SEPT_JOURS = `
CREATE POLICY "cloisonnement_technicien_sept_jours" ON "intervention"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND "date_planifiee" <= now()::date + 7
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );
`;

  const CIBLE = "prisma/migrations/20260909200000_intervention_l2_planning";

  function greffe(faute: string): Migration[] {
    const reel = fichiers.find((f) => f.chemin.startsWith(CIBLE));
    if (reel === undefined) {
      throw new Error(
        "la migration d'intervention a disparu : l'épreuve ne greffe plus " +
          "rien, et un gardien qui ne viole rien ne mesure rien",
      );
    }
    return fichiers.map((f) =>
      f.chemin === reel.chemin ? { ...f, sql: `${f.sql}\n${faute}` } : f,
    );
  }

  it("refuse la fenêtre des 7 jours greffée dans la migration réelle", () => {
    const ecarts = ecartsHorloge(greffe(FENETRE_SEPT_JOURS));
    expect(ecarts).toHaveLength(1);
    // L'assertion NOMME la politique fautive : un refus venu d'ailleurs
    // passerait sinon pour celui-ci (§9, 24/08).
    expect(ecarts[0]).toContain("cloisonnement_technicien_sept_jours");
    expect(ecarts[0]).toContain("now(");
  });

  it.each([
    ["graphie majuscule et espaces", "NOW ( )::date + 7"],
    ["graphie sur deux lignes", "now\n      ()::date + 7"],
    ["qualification par le schéma", "pg_catalog.now()::date + 7"],
    ["sans parenthèses", "CURRENT_DATE + 7"],
    ["horloge instable", "clock_timestamp()::date + 7"],
  ])("refuse la forme « %s » (§9, 26/08, forme 1)", (_nom, expression) => {
    const ecarts = ecartsHorloge(
      greffe(FENETRE_SEPT_JOURS.replace("now()::date + 7", expression)),
    );
    expect(ecarts).toHaveLength(1);
  });

  it("refuse la faute écrite DANS un bloc DO (§9, 26/08, forme 2)", () => {
    const ecarts = ecartsHorloge(
      greffe(
        `DO $$ BEGIN EXECUTE format('%s', $x$${FENETRE_SEPT_JOURS}$x$); END $$;`,
      ),
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("cloisonnement_technicien_sept_jours");
  });

  it("refuse le basculement en DEUX TEMPS (§9, 26/08, forme 3)", () => {
    // L'objet innocent, puis son bascule : c'est l'état final qui compte.
    const ecarts = ecartsHorloge(
      greffe(
        `${FENETRE_SEPT_JOURS.replace('AND "date_planifiee" <= now()::date + 7', "")}
ALTER POLICY "cloisonnement_technicien_sept_jours" ON "intervention"
  USING ("date_planifiee" <= CURRENT_DATE + 7);
`,
      ),
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("cloisonnement_technicien_sept_jours");
  });

  /**
   * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09).
   *
   * Toutes les épreuves ci-dessus font rougir le gardien ; aucune ne vérifie
   * qu'un vert est MÉRITÉ. Voici la direction permissive : une politique qui
   * lit une colonne de type date — et jusqu'à une colonne dont le nom contient
   * `now` — reste verte, parce que ce que D85 interdit est l'horloge, pas le
   * temps. Un motif écrit sur le mot « date » redeviendrait rouge ici, et
   * c'est exactement ce qu'on veut voir tomber.
   */
  const MATERIALISEE = `
CREATE POLICY "cloisonnement_technicien_materialise" ON "intervention"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND "date_planifiee" <= "perimetre_technicien_borne"
    AND "date_maj_snowball" IS NOT NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );
`;

  it("laisse passer la forme MATÉRIALISÉE, colonnes de date comprises", () => {
    expect(ecartsHorloge(greffe(MATERIALISEE))).toEqual([]);
  });

  it("la greffe verte est bien LUE — sinon son vert ne prouve rien", () => {
    // Sans ce témoin, un motif d'isolement qui perdrait la greffe rendrait le
    // même vert que la règle bien appliquée.
    const politiquesGreffees = politiquesDeMigration(greffe(MATERIALISEE));
    expect(politiquesGreffees.length).toBe(politiques.length + 1);
    expect(
      politiquesGreffees.some((p) =>
        p.texte.includes("cloisonnement_technicien_materialise"),
      ),
    ).toBe(true);
  });

  it("annonce sa limite : l'assemblage à l'exécution lui échappe", () => {
    // Forme 6 du §9 (26/08). L'écrire vaut mieux que laisser croire l'inverse.
    const assemble = FENETRE_SEPT_JOURS.replace(
      "now()::date + 7",
      "(('no' || 'w()')::text)::date + 7",
    );
    expect(ecartsHorloge(greffe(assemble))).toEqual([]);
  });
});
