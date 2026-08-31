import { describe, expect, it } from "vitest";

import { migrationsSql } from "../outils/migrations-sql";
import { lireSchema, modelesDuSchema } from "../outils/schema-prisma";

/**
 * Gardien du PÉRIMÈTRE du journal d'audit (ticket L0-10, invariant I8,
 * arbitrage D32).
 *
 * **Ce qu'il répare, et ce n'est pas une table.** Trois des tables de I8
 * n'existent pas encore — elles arrivent aux lots 2 et 4. Une liste écrite
 * aujourd'hui et des tables créées dans six mois, c'est exactement
 * l'enchaînement du 20/08 : **la liste est fermée un jour, une décision
 * ultérieure crée la table, et personne ne revient l'y rattacher.** Le journal
 * resterait vert, avec un périmètre devenu faux — et un journal qui ne trace
 * pas les interventions ressemble beaucoup trop à un journal qui fonctionne.
 *
 * **Le renversement.** Ce gardien ne part pas des déclencheurs pour vérifier
 * qu'ils sont légitimes ; il part du PÉRIMÈTRE DE I8 et exige que chaque table
 * qui existe porte son déclencheur. Une table créée demain sans déclencheur
 * fait tomber la vérification le jour où elle est écrite, pas trois lots plus
 * tard.
 *
 * **Et il est clos DES DEUX CÔTÉS depuis D52.** Tant que I8 énumérait des
 * NOTIONS — « paramétrage société », « compte client » —, il fallait
 * l'interpréter pour savoir ce qui était couvert, et le gardien ne pouvait
 * refuser qu'un élargissement nommé d'avance. D52 a corrigé la source plutôt
 * que l'interprétation (méthode de D44) : I8 énumère désormais des TABLES, et
 * la comparaison devient exacte. Un déclencheur posé sur une table absente de
 * la liste échoue, quelle qu'elle soit — élargir la traçabilité est un
 * arbitrage, jamais une décision de ticket.
 */

/** Ce que le déclencheur d'audit s'appelle, partout où il est posé. */
const NOM_DECLENCHEUR = "journal_audit";

/**
 * Le périmètre de I8, recopié EN TOUTES LETTRES.
 *
 * La recopie est délibérée, comme celle des listes closes de I1 : un gardien
 * qui tirerait son périmètre de la même source que les migrations ne
 * vérifierait rien. Ici, c'est la constitution qui est confrontée au dépôt.
 *
 * `table` est le nom SQL attendu ; `lot` dit d'où elle viendra quand elle
 * n'existe pas encore.
 */
const PERIMETRE_I8 = [
  { entite: "paramétrage de la société", table: "societe", lot: null },
  { entite: "établissements", table: "agence", lot: null },
  { entite: "heures d'ouverture", table: "calendrier", lot: null },
  { entite: "heures d'ouverture", table: "calendrier_plage", lot: null },
  {
    entite: "écarts locaux de calendrier",
    table: "calendrier_ferie",
    lot: null,
  },
  // D52 — c'est par cette table qu'on se donne un accès. « Qui a accordé ce
  // droit, quand, depuis quelle valeur » est la question de l'auditeur, et
  // celle qui rend vérifiable la procédure de déblocage de D40 (L7-01).
  { entite: "habilitations (D52)", table: "utilisateur_societe", lot: null },
  { entite: "comptes portail (D10)", table: "utilisateur_client", lot: null },
  // Les trois tables métier qui n'existent pas encore.
  { entite: "fiches machine", table: "machine", lot: "L2-01" },
  { entite: "interventions", table: "intervention", lot: "L2-07" },
  { entite: "contrats", table: "contrat", lot: "lot 4" },
] as const;

/**
 * Retire du SQL ce qui DOCUMENTE, pour ne garder que ce qui S'EXÉCUTE.
 *
 * La coupure est celle de D50, et elle penche ici dans l'autre sens. Le gardien
 * `SECURITY DEFINER` risquait d'être trop STRICT — il refusait la note qui
 * énonçait sa propre règle. Celui-ci risque d'être trop PERMISSIF : une phrase
 * de commentaire citant un `CREATE TRIGGER … ON "intervention"` lui ferait
 * croire qu'`intervention` est couverte alors que rien ne la couvre. Les
 * commentaires `--` sont donc retirés — ils ne s'exécutent jamais, et rien ne
 * se perd à les ignorer.
 *
 * Les chaînes littérales, elles, restent dans le périmètre (§9, forme 2) : un
 * déclencheur posé depuis un bloc `DO $$ … $$` ou un `EXECUTE format(…)` est
 * bel et bien posé.
 */
export function sansCommentairesSql(sql: string): string {
  return sql
    .split("\n")
    .map((ligne) => ligne.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * Tables sur lesquelles le déclencheur d'audit est POSÉ ET ACTIF, migrations
 * lues dans l'ordre du temps.
 *
 * **C'est l'ÉTAT FINAL qui compte, pas le verbe qui l'installe** (§9, forme 3).
 * Un gardien qui ne regarderait que `CREATE TRIGGER` ne lirait que la moitié de
 * l'histoire : une migration ultérieure peut le déposer (`DROP TRIGGER`) ou
 * l'endormir (`ALTER TABLE … DISABLE TRIGGER`), et la table sortirait du
 * périmètre sans qu'aucune ligne de `CREATE` ne disparaisse. Les trois verbes
 * sont donc suivis, et le dernier gagne.
 *
 * **Ce qui reste hors de portée, et qui se dit ici plutôt que se tait** (§9,
 * forme 6) : un nom de table construit à l'exécution (`EXECUTE format('… ON
 * %I', cible)`) n'est pas vu, pas plus qu'un `ALTER TABLE … DISABLE TRIGGER`
 * dont le nom de table serait assemblé. Un gardien statique arrête la
 * correction bien intentionnée — celle du ticket qui crée `intervention` et
 * oublie le journal —, pas un contournement décidé.
 */
export function tablesDeclenchees(
  fichiers: readonly { chemin: string; sql: string }[],
): string[] {
  // Le nom de la table peut être nu, entre guillemets, et qualifié par son
  // schéma — `"public"."intervention"` autant qu'`intervention`. Le préfixe est
  // consommé sans être capturé : c'est le nom de table qui compte (§9, forme 1).
  const TABLE = `(?:"?\\w+"?\\s*\\.\\s*)?"?(\\w+)"?`;
  const pose = new RegExp(
    `create\\s+trigger\\s+"?${NOM_DECLENCHEUR}"?[\\s\\S]*?\\son\\s+${TABLE}`,
    "gi",
  );
  const depose = new RegExp(
    `drop\\s+trigger\\s+(?:if\\s+exists\\s+)?"?${NOM_DECLENCHEUR}"?\\s+on\\s+${TABLE}`,
    "gi",
  );
  // `DISABLE TRIGGER` accepte un nom, `ALL` ou `USER` : les trois endorment le
  // déclencheur d'audit, et les trois comptent.
  const endort = new RegExp(
    `alter\\s+table\\s+(?:only\\s+)?${TABLE}\\s+disable\\s+trigger\\s+` +
      `(?:"?${NOM_DECLENCHEUR}"?|all|user)\\b`,
    "gi",
  );

  const actif = new Map<string, boolean>();
  const marquer = (motif: RegExp, sql: string, valeur: boolean): void => {
    for (const trouve of sql.matchAll(motif)) {
      actif.set(trouve[1] ?? "", valeur);
    }
  };

  // Les migrations sont lues dans l'ordre de leur nom, donc du temps : c'est
  // cet ordre qui donne son sens à « le dernier gagne ».
  for (const fichier of [...fichiers].sort((a, b) =>
    a.chemin.localeCompare(b.chemin),
  )) {
    const sql = sansCommentairesSql(fichier.sql);
    marquer(pose, sql, true);
    marquer(depose, sql, false);
    marquer(endort, sql, false);
  }

  return [...actif.entries()]
    .filter(([, pose]) => pose)
    .map(([table]) => table);
}

/** Noms des tables réellement déclarées au schéma Prisma. */
function tablesDuSchema(schema: string): string[] {
  return modelesDuSchema(schema).map((modele) => modele.table);
}

/**
 * Écarts entre le périmètre de I8 et ce que le dépôt fait réellement.
 *
 * Deux motifs, et le second est celui qu'on oublie :
 *   1. une table du périmètre existe au schéma et ne porte AUCUN déclencheur ;
 *   2. une table sous arbitrage en porte un — le périmètre s'est élargi sans
 *      décision.
 */
export function ecartsPerimetreAudit(
  schema: string,
  declenchees: readonly string[],
  perimetre: readonly {
    entite: string;
    table: string;
    lot: string | null;
  }[] = PERIMETRE_I8,
): string[] {
  const ecarts: string[] = [];
  const existantes = tablesDuSchema(schema);

  for (const { entite, table } of perimetre) {
    if (!existantes.includes(table)) {
      continue;
    }
    if (!declenchees.includes(table)) {
      ecarts.push(
        `« ${table} » (${entite}) figure au périmètre d'audit de I8 et existe ` +
          "au schéma, mais aucune migration n'y pose le déclencheur " +
          `« ${NOM_DECLENCHEUR} ». Une table du périmètre créée sans son ` +
          "déclencheur laisse un trou silencieux : le journal reste vert et " +
          "cesse d'être complet. Le déclencheur se pose dans la migration qui " +
          "crée la table, jamais dans une migration de rattrapage écrite " +
          "quand quelqu'un s'en apercevra.",
      );
    }
  }

  // La clôture DANS L'AUTRE SENS, possible depuis D52 : I8 énumérant des
  // tables, tout déclencheur posé ailleurs est un élargissement décidé en
  // séance. La liste n'a plus besoin de nommer d'avance la table qu'on
  // craignait — c'est le périmètre entier qui fait autorité.
  const couvertes = perimetre.map((entree) => entree.table);
  for (const table of declenchees) {
    if (!couvertes.includes(table)) {
      ecarts.push(
        `« ${table} » a reçu le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle ne figure PAS au périmètre d'audit de I8. Élargir la " +
          "traçabilité est un arbitrage — la table s'ajoute d'abord à la " +
          "liste de I8, dans le CLAUDE.md, et jamais l'inverse.",
      );
    }
  }

  return ecarts;
}

describe("le périmètre du journal d'audit suit I8 (L0-10, D32)", () => {
  const fichiers = migrationsSql();
  const declenchees = tablesDeclenchees(fichiers);
  const schema = lireSchema();

  it("le gardien lit réellement des déclencheurs — sinon il garde le vide", () => {
    // Un gardien qui ne trouve aucun déclencheur passerait au vert en
    // n'exigeant rien de personne.
    expect(declenchees.length).toBeGreaterThanOrEqual(7);
    expect(declenchees).toContain("societe");
  });

  it("chaque table du périmètre existante au schéma porte son déclencheur", () => {
    expect(ecartsPerimetreAudit(schema, declenchees)).toEqual([]);
  });

  it("les entités encore sans table sont exactement celles des lots à venir", () => {
    // Sans cette vérification, une table du périmètre pourrait DISPARAÎTRE du
    // schéma — ou n'y être jamais rattachée — et le premier scénario resterait
    // vert en la sautant. Ce qui est « à venir » doit être une liste courte et
    // nommée, pas un reste.
    const existantes = tablesDuSchema(schema);
    const aVenir = PERIMETRE_I8.filter(
      (entree) => !existantes.includes(entree.table),
    );

    expect(aVenir.map((entree) => `${entree.table} (${entree.lot})`)).toEqual([
      "machine (L2-01)",
      "intervention (L2-07)",
      "contrat (lot 4)",
    ]);
  });

  it("ÉPREUVE : une table du périmètre créée sans déclencheur est refusée", () => {
    // La faute telle qu'elle se commettra réellement : le ticket L2-07 crée
    // `intervention`, et personne ne pense au journal. Le schéma est fabriqué,
    // mais la liste des déclencheurs est la VRAIE — c'est bien l'absence qui
    // est éprouvée, pas une mise en scène complète.
    const fabrique = `
      model Intervention {
        id         String @id @db.Uuid
        societe_id String @db.Uuid

        @@map("intervention")
      }
    `;

    const ecarts = ecartsPerimetreAudit(schema + fabrique, declenchees);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("intervention");
    expect(ecarts[0]).toContain("périmètre d'audit de I8");
  });

  it("ÉPREUVE : un élargissement silencieux du périmètre est refusé", () => {
    // Le cas inverse, et il est aussi grave. Depuis D52 il n'a plus besoin
    // d'être nommé d'avance : n'IMPORTE QUELLE table hors liste est refusée.
    // Deux sujets, pris chacun dans une catégorie différente de I1, pour que
    // le refus ne tienne pas à une particularité de l'une d'elles.
    for (const intruse of ["session", "devise"]) {
      const ecarts = ecartsPerimetreAudit(schema, [...declenchees, intruse]);

      expect(ecarts, intruse).toHaveLength(1);
      expect(ecarts[0]).toContain(intruse);
      expect(ecarts[0]).toContain("ne figure PAS au périmètre d'audit de I8");
    }
  });

  it("D52 : `utilisateur_societe` est RÉCLAMÉE, et non plus refusée", () => {
    // Le sens du gardien s'est inversé sur cette table, et il faut que le
    // renversement soit lisible dans le test lui-même : elle figure au
    // périmètre, elle existe au schéma, elle DOIT donc porter le déclencheur.
    expect(PERIMETRE_I8.map((entree) => entree.table)).toContain(
      "utilisateur_societe",
    );
    expect(declenchees).toContain("utilisateur_societe");

    // Et son absence est bien un écart, nommé : c'est l'épreuve du
    // renversement, pas seulement son constat.
    const sansElle = declenchees.filter(
      (table) => table !== "utilisateur_societe",
    );
    const ecarts = ecartsPerimetreAudit(schema, sansElle);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("utilisateur_societe");
    expect(ecarts[0]).toContain("habilitations (D52)");
  });

  it("les sept tables couvertes aujourd'hui sont exactement celles attendues", () => {
    // Le décompte, pour qu'un déclencheur posé ailleurs se voie. La liste est
    // recopiée : c'est la constitution confrontée aux migrations, pas les
    // migrations confrontées à elles-mêmes.
    expect([...declenchees].sort()).toEqual([
      "agence",
      "calendrier",
      "calendrier_ferie",
      "calendrier_plage",
      "societe",
      "utilisateur_client",
      "utilisateur_societe",
    ]);
  });

  it("ÉPREUVE : un déclencheur DÉPOSÉ ensuite ne compte plus (§9, forme 3)", () => {
    // C'est l'état final qui compte, pas le verbe qui l'installe. Une migration
    // de rattrapage qui déposerait le déclencheur sortirait la table du
    // périmètre sans qu'aucune ligne de CREATE ne disparaisse.
    const posee = {
      chemin: "prisma/migrations/1_pose/migration.sql",
      sql: 'CREATE TRIGGER "journal_audit" AFTER INSERT ON "societe" FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();',
    };
    const deposee = {
      chemin: "prisma/migrations/2_depose/migration.sql",
      sql: 'DROP TRIGGER "journal_audit" ON "societe";',
    };

    expect(tablesDeclenchees([posee])).toEqual(["societe"]);
    expect(tablesDeclenchees([posee, deposee])).toEqual([]);
  });

  it("ÉPREUVE : un déclencheur ENDORMI ne compte plus non plus (§9, forme 3)", () => {
    // `DISABLE TRIGGER` laisse le déclencheur en place et inerte : le plus
    // silencieux des trois, et celui qu'un gardien naïf ne verrait jamais. Les
    // trois formes — le nom, `ALL`, `USER` — sont éprouvées.
    const posee = {
      chemin: "prisma/migrations/1_pose/migration.sql",
      sql: 'CREATE TRIGGER "journal_audit" AFTER INSERT ON "societe" FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();',
    };

    for (const cible of ['"journal_audit"', "ALL", "USER"]) {
      const endormie = {
        chemin: "prisma/migrations/2_endort/migration.sql",
        sql: `ALTER TABLE "societe" DISABLE TRIGGER ${cible};`,
      };
      expect(tablesDeclenchees([posee, endormie]), cible).toEqual([]);
    }
  });

  it("ÉPREUVE : la POSE depuis un bloc DO est vue (§9, forme 2)", () => {
    // Les chaînes littérales restent dans le périmètre examiné : un
    // déclencheur posé par `EXECUTE` est bel et bien posé.
    const parBloc = {
      chemin: "prisma/migrations/1_bloc/migration.sql",
      sql: `DO $$ BEGIN
        EXECUTE 'CREATE TRIGGER "journal_audit" AFTER INSERT ON "intervention" FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"()';
      END $$;`,
    };

    expect(tablesDeclenchees([parBloc])).toEqual(["intervention"]);
  });

  it("ÉPREUVE : une pose CITÉE EN COMMENTAIRE ne compte pas (§9, forme 4)", () => {
    // Le risque propre à ce gardien-ci est d'être trop PERMISSIF : une phrase
    // qui cite la pose lui ferait croire à une couverture qui n'existe pas.
    const commentee = {
      chemin: "prisma/migrations/1_note/migration.sql",
      sql: '-- CREATE TRIGGER "journal_audit" AFTER INSERT ON "intervention" … viendra au lot 2.\nSELECT 1;',
    };

    expect(tablesDeclenchees([commentee])).toEqual([]);
  });

  it("le motif reconnaît les graphies qu'un correcteur écrirait (§9, forme 1)", () => {
    // Casse, guillemets, retour à la ligne, nom qualifié par le schéma : un
    // motif qui ne voit qu'une forme laisse passer les autres.
    for (const graphie of [
      'CREATE TRIGGER "journal_audit" AFTER INSERT ON "intervention" FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();',
      "create trigger journal_audit after insert or update on intervention for each row execute function journal_audit_tracer();",
      'CREATE TRIGGER "journal_audit"\n  AFTER INSERT OR UPDATE OR DELETE\n  ON   "public"."intervention"\n  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();',
    ]) {
      expect(
        tablesDeclenchees([{ chemin: "fabriquée.sql", sql: graphie }]),
        graphie,
      ).toEqual(["intervention"]);
    }
  });
});
