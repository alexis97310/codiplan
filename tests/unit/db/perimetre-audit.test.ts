import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXEMPTIONS_AUDIT,
  NOM_DECLENCHEUR,
  ecartsExemptions,
  perimetreAudit,
  tablesExemptees,
  tablesPremiereCategorieI1,
  type Exemption,
  type TableObservee,
} from "../../../scripts/lib/perimetre-audit";
import { migrationsSql } from "../outils/migrations-sql";
import { lireSchema, modelesDuSchema } from "../outils/schema-prisma";

/**
 * Gardien du PÉRIMÈTRE du journal d'audit (ticket L0-10, invariant I8,
 * arbitrages D32, D52, D53, **D55**).
 *
 * **Ce qu'il répare, et ce n'est pas une table.** Trois des tables de I8
 * n'existent pas encore — elles arrivent aux lots 2 et 4. Une liste écrite
 * aujourd'hui et des tables créées dans six mois, c'est exactement
 * l'enchaînement du 20/08 : **la liste est fermée un jour, une décision
 * ultérieure crée la table, et personne ne revient l'y rattacher.** Le journal
 * resterait vert, avec un périmètre devenu faux — et un journal qui ne trace
 * pas les interventions ressemble beaucoup trop à un journal qui fonctionne.
 *
 * **Le renversement, deuxième temps (D55).** Ce gardien partait du périmètre —
 * une liste d'ADMIS, tenue à la main — et exigeait que chaque table qui y
 * figure porte son déclencheur. Il part désormais du SCHÉMA : toute table de la
 * première catégorie de I1 est auditée, moins des exemptions justifiées. Une
 * table métier créée demain est réclamée par le gardien **sans que personne
 * n'ait rien ajouté nulle part** — l'exhaustivité est héritée du gardien de
 * D41, qui la tient déjà contre le schéma.
 *
 * Le défaut que cela ferme a été observé, pas imaginé : `client` (L1-01)
 * naissait hors périmètre, non parce qu'on l'avait décidé, mais parce que
 * personne n'avait ajouté la ligne.
 *
 * **La règle n'a qu'une maison** *(D53, conservé par D55)* :
 * `scripts/lib/perimetre-audit.ts`. Ce n'est plus la maison d'une liste — il
 * n'y en a plus — mais celle d'une règle et de ses exceptions. L'indépendance
 * du gardien tient à ce qu'elle a toujours tenu : la règle est confrontée aux
 * MIGRATIONS et au SCHÉMA, deux sources qu'elle ne contrôle pas.
 *
 * **Et il reste clos DES DEUX CÔTÉS.** Un déclencheur posé sur une table qui
 * n'est pas de la première catégorie de I1 — un référentiel de plateforme, une
 * table technique d'authentification — est refusé, tout comme un déclencheur
 * posé sur une table EXEMPTÉE : dans les deux cas, quelqu'un a élargi la
 * traçabilité sans passer par la règle.
 */

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

/**
 * Le schéma, réduit à ce dont le périmètre a besoin : le nom de chaque table et
 * l'obligation de sa colonne `societe_id`.
 *
 * **Le `?` compte**, et c'est la même lecture que le gardien d'exhaustivité de
 * D41 : un `societe_id String?` est la forme des référentiels surchargeables
 * (D4), pas celle d'une table métier. Un test plus bas confronte les deux
 * lectures sur le schéma réel — deux implémentations d'une même définition ne
 * doivent pas pouvoir diverger en silence.
 */
export function observeesDuSchema(schema: string): TableObservee[] {
  return modelesDuSchema(schema).map(({ table, champs }) => {
    const cloisonnement = champs.find((champ) => champ.nom === "societe_id");
    return {
      table,
      societeIdObligatoire:
        cloisonnement !== undefined && !cloisonnement.type.endsWith("?"),
    };
  });
}

/**
 * Écarts entre ce que D55 exige et ce que le dépôt fait réellement.
 *
 * Quatre motifs, et le premier est celui que l'inversion apporte :
 *   1. une table de la première catégorie de I1 existe et ne porte AUCUN
 *      déclencheur, sans figurer aux exemptions — c'est le cas de `client`
 *      avant D55, et il ne demandait aucune liste pour être détecté ;
 *   2. une table EXEMPTÉE porte quand même un déclencheur — l'exemption dit une
 *      chose et la migration une autre ;
 *   3. un déclencheur est posé hors de la première catégorie de I1 —
 *      référentiel de plateforme, table technique : élargir la traçabilité est
 *      un arbitrage ;
 *   4. les écarts de la liste d'exemptions elle-même (`ecartsExemptions`), seule
 *      chose qui reste tenue à la main.
 */
export function ecartsPerimetreAudit(
  schema: string,
  declenchees: readonly string[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
): string[] {
  const observees = observeesDuSchema(schema);
  const perimetre = perimetreAudit(observees, exemptions);
  const exemptees = tablesExemptees(exemptions);

  const ecarts: string[] = [...ecartsExemptions(observees, exemptions)];

  for (const table of perimetre) {
    if (!declenchees.includes(table)) {
      ecarts.push(
        `« ${table} » est une table métier cloisonnée (1ʳᵉ catégorie de I1) et ` +
          `ne porte pas le déclencheur « ${NOM_DECLENCHEUR} ». Depuis D55 le ` +
          "périmètre d'audit est INVERSÉ : une table métier est auditée par " +
          "défaut, et n'y échappe que par une exemption écrite et justifiée " +
          "dans scripts/lib/perimetre-audit.ts. Le déclencheur se pose dans la " +
          "migration qui crée la table, jamais dans une migration de " +
          "rattrapage écrite quand quelqu'un s'en apercevra.",
      );
    }
  }

  for (const table of declenchees) {
    if (exemptees.includes(table)) {
      ecarts.push(
        `« ${table} » porte le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle figure aux EXEMPTIONS. L'exemption dit une chose et la " +
          "migration une autre : soit l'exemption n'a plus lieu d'être et se " +
          "retire, soit le déclencheur est de trop.",
      );
      continue;
    }
    if (!perimetre.includes(table)) {
      ecarts.push(
        `« ${table} » a reçu le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle ne relève PAS de la première catégorie de I1 — c'est un " +
          "référentiel de plateforme, une table technique, ou elle n'existe " +
          "pas au schéma. Élargir la traçabilité au-delà des tables métier " +
          "cloisonnées est un arbitrage, jamais une décision de ticket.",
      );
    }
  }

  return ecarts;
}

describe("le périmètre d'audit est INVERSÉ (D55, I8, L0-10)", () => {
  const fichiers = migrationsSql();
  const declenchees = tablesDeclenchees(fichiers);
  const schema = lireSchema();
  const observees = observeesDuSchema(schema);
  const perimetre = perimetreAudit(observees);

  it("le gardien lit réellement des déclencheurs et des tables", () => {
    // Trois témoins. Un gardien qui ne trouverait ni déclencheur, ni table, ni
    // périmètre passerait au vert en n'exigeant rien de personne — et un
    // décompte nul ressemble toujours à un sans-faute (§9, 30/08).
    expect(declenchees.length).toBeGreaterThanOrEqual(8);
    expect(observees.length).toBeGreaterThanOrEqual(15);
    expect(perimetre.length).toBeGreaterThanOrEqual(8);
    expect(declenchees).toContain("societe");
  });

  it("chaque table métier cloisonnée porte son déclencheur", () => {
    expect(ecartsPerimetreAudit(schema, declenchees)).toEqual([]);
  });

  it("le périmètre est CALCULÉ : catégorie 1 moins exemptions", () => {
    // La propriété qui remplace l'ancienne liste. Elle se vérifie par identité,
    // pas par recopie : le périmètre EST la différence des deux ensembles.
    const categorie1 = tablesPremiereCategorieI1(observees);
    const exemptees = tablesExemptees();

    expect([...perimetre].sort()).toEqual(
      categorie1.filter((table) => !exemptees.includes(table)).sort(),
    );
    // Et l'exemption mord réellement : sans elle, le périmètre serait plus
    // grand d'exactement les tables exemptées.
    expect(perimetreAudit(observees, []).length).toBe(
      perimetre.length + exemptees.length,
    );
  });

  it("les huit tables auditées aujourd'hui sont exactement celles attendues", () => {
    // Le décompte, écrit en toutes lettres, pour qu'un déclencheur posé
    // ailleurs — ou disparu — se voie. C'est la constitution confrontée aux
    // migrations, pas les migrations confrontées à elles-mêmes.
    expect([...declenchees].sort()).toEqual([
      "agence",
      "calendrier",
      "calendrier_ferie",
      "calendrier_plage",
      "client",
      "societe",
      "utilisateur_client",
      "utilisateur_societe",
    ]);
  });

  it("ÉPREUVE : une table métier NOUVELLE est réclamée sans qu'on ait rien ajouté", () => {
    // **C'est la propriété que D55 apporte, et elle se mesure ici.** Avant
    // l'inversion, une table absente de la liste était hors périmètre en
    // silence — c'est ce qui est arrivé à `client` (L1-01). Le schéma est
    // fabriqué, la liste des déclencheurs est la VRAIE : c'est bien l'absence
    // qui est éprouvée, et AUCUNE liste n'a été touchée pour que le gardien la
    // réclame.
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
    expect(ecarts[0]).toContain("périmètre d'audit est INVERSÉ");
  });

  it("ÉPREUVE : une table NON cloisonnée n'est pas réclamée", () => {
    // Le pendant du précédent, et il n'est pas décoratif : un gardien qui
    // réclamerait un déclencheur sur tout ce qui existe échouerait sur
    // `session` ou `devise`, et on l'aurait « réparé » en rouvrant une liste.
    for (const modele of [
      'model Devise2 { code String @id\n libelle String\n @@map("famille_materiel") }',
      'model Jeton { id String @id @db.Uuid\n @@map("jeton_technique") }',
      'model Copie { id String @id @db.Uuid\n societe_id String?\n @@map("checklist_modele") }',
    ]) {
      expect(
        ecartsPerimetreAudit(schema + "\n" + modele, declenchees),
        modele,
      ).toEqual([]);
    }
  });

  it("ÉPREUVE : un élargissement silencieux du périmètre est refusé", () => {
    // Le cas inverse, et il est aussi grave. Deux sujets, pris chacun dans une
    // catégorie différente de I1, pour que le refus ne tienne pas à une
    // particularité de l'une d'elles.
    for (const intruse of ["session", "devise"]) {
      const ecarts = ecartsPerimetreAudit(schema, [...declenchees, intruse]);

      expect(ecarts, intruse).toHaveLength(1);
      expect(ecarts[0]).toContain(intruse);
      expect(ecarts[0]).toContain("ne relève PAS de la première catégorie");
    }
  });

  it("ÉPREUVE : un déclencheur posé sur une table EXEMPTÉE est refusé", () => {
    // L'exemption n'est pas une permission de faire les deux : elle dit que la
    // table n'est pas auditée. Un déclencheur qui s'y poserait quand même
    // signifierait que l'exemption n'a plus lieu d'être — et il faut alors la
    // retirer, pas la laisser mentir.
    for (const exemptee of tablesExemptees()) {
      const ecarts = ecartsPerimetreAudit(schema, [...declenchees, exemptee]);

      expect(ecarts, exemptee).toHaveLength(1);
      expect(ecarts[0]).toContain(exemptee);
      expect(ecarts[0]).toContain("figure aux EXEMPTIONS");
    }
  });

  it("ÉPREUVE : une exemption qui ne s'adosse à rien est refusée", () => {
    // Corollaire du 31/08 sur les sélections négatives : une exemption survit
    // au renommage de sa table, ne protège plus rien, et le premier fichier qui
    // reprendra ce nom en héritera sans que personne ne le lui ait accordé.
    const fantome: Exemption[] = [
      {
        table: "table_disparue",
        motif: "rejouable",
        justification: "reconstituable depuis une autre table auditée",
      },
    ];

    const ecarts = ecartsExemptions(observees, fantome);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("table_disparue");
    expect(ecarts[0]).toContain("ne s'applique à personne");
  });

  it("ÉPREUVE : une exemption sans justification écrite est refusée", () => {
    const muette: Exemption[] = [
      { table: "journal_audit", motif: "impossible", justification: "   " },
    ];

    const ecarts = ecartsExemptions(observees, muette);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("sans justification écrite");
  });

  it("les exemptions en vigueur sont justifiées, et se relisent", () => {
    // Le contenu de la seule chose encore tenue à la main. Une exemption est un
    // texte qu'un humain relit ; ce test exige qu'il y en ait un, pas qu'il soit
    // bon — cela, seule la revue le dit.
    expect(ecartsExemptions(observees)).toEqual([]);
    for (const exemption of EXEMPTIONS_AUDIT) {
      expect(exemption.justification.length, exemption.table).toBeGreaterThan(
        80,
      );
    }
    // `journal_audit` est exemptée pour IMPOSSIBILITÉ, et la justification cite
    // la mesure. Un motif « rejouable » posé ici serait faux : rien ne
    // reconstituerait le journal.
    expect(tablesExemptees()).toEqual(["journal_audit"]);
    expect(EXEMPTIONS_AUDIT[0]?.motif).toBe("impossible");
    expect(EXEMPTIONS_AUDIT[0]?.justification).toContain("stack depth");
  });

  it("D52 : `utilisateur_societe` est auditée, et son absence est un écart", () => {
    // Le cas qui a fondé D52 : la table des habilitations, dont la modification
    // est l'acte le plus lourd de conséquences du système. Depuis D55 elle n'a
    // plus besoin d'être nommée — elle porte `societe_id NOT NULL`, elle est
    // donc auditée. Le renversement se lit ici : elle est réclamée par la
    // RÈGLE, plus par une ligne de liste.
    expect(perimetre).toContain("utilisateur_societe");
    expect(declenchees).toContain("utilisateur_societe");

    const sansElle = declenchees.filter(
      (table) => table !== "utilisateur_societe",
    );
    const ecarts = ecartsPerimetreAudit(schema, sansElle);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("utilisateur_societe");
  });

  it("L1-01 : `client` est auditée, et c'est le cas qui a motivé D55", () => {
    expect(perimetre).toContain("client");
    expect(declenchees).toContain("client");
  });

  it("ÉPREUVE : un déclencheur DÉPOSÉ ensuite ne compte plus (§9, forme 3)", () => {
    // C'est l'état final qui compte, pas le verbe qui l'installe.
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
    const parBloc = {
      chemin: "prisma/migrations/1_bloc/migration.sql",
      sql: `DO $$ BEGIN
        EXECUTE 'CREATE TRIGGER "journal_audit" AFTER INSERT ON "intervention" FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"()';
      END $$;`,
    };

    expect(tablesDeclenchees([parBloc])).toEqual(["intervention"]);
  });

  it("ÉPREUVE : une pose CITÉE EN COMMENTAIRE ne compte pas (§9, forme 4)", () => {
    const commentee = {
      chemin: "prisma/migrations/1_note/migration.sql",
      sql: '-- CREATE TRIGGER "journal_audit" AFTER INSERT ON "intervention" … viendra au lot 2.\nSELECT 1;',
    };

    expect(tablesDeclenchees([commentee])).toEqual([]);
  });

  it("le motif reconnaît les graphies qu'un correcteur écrirait (§9, forme 1)", () => {
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

/**
 * D53, conservé par D55 — LA RÈGLE N'A QU'UNE MAISON, et c'est vérifié plutôt
 * que promis.
 *
 * Le périmètre est défini une fois, dans `scripts/lib/perimetre-audit.ts`.
 * L'invariant I8 du CLAUDE.md, la règle RG-DRO-04 du chapitre 10 et le README y
 * RENVOIENT ; aucun ne l'énumère. Depuis D55, il n'y a d'ailleurs plus de liste
 * à recopier — mais la tentation change de forme : on recopierait désormais la
 * liste CALCULÉE « pour la lisibilité », et elle deviendrait fausse à la
 * première table métier suivante, sans rougir.
 *
 * Le détecteur est éprouvé sur une recopie fabriquée — sans quoi « aucune
 * recopie trouvée » et « le détecteur ne sait pas en trouver » se ressemblent
 * trait pour trait (§9, la vacuité).
 */
const SOURCES_QUI_RENVOIENT = [
  { fichier: "CLAUDE.md", section: /### I8 — Traçabilité[\s\S]*?(?=\n### )/ },
  { fichier: "docs/cahier-des-charges.md", section: /^\| RG-DRO-04 \|.*$/m },
  {
    fichier: "README.md",
    section: /^## Journal d'audit[\s\S]*?(?=\n## )/m,
  },
] as const;

/**
 * Quelles tables du périmètre un texte nomme.
 *
 * **Le critère est un SEUIL, pas zéro, et il faut dire pourquoi.** Citer une
 * table pour porter un argument est légitime — I8 nomme `utilisateur_societe`
 * parce que c'est le cas qui a fondé D52, et `client` parce que c'est celui qui
 * a fondé D55. Ce qui ne l'est pas, c'est de réénumérer le périmètre. Une
 * recopie les nomme toutes ; un argument en nomme une ou deux.
 */
export function tablesEnumerees(texte: string, calcule: readonly string[]) {
  return calcule.filter((table) => new RegExp(`\\b${table}\\b`).test(texte));
}

describe("le périmètre n'est défini qu'à un seul endroit (D53, D55)", () => {
  const CHEMIN = "scripts/lib/perimetre-audit.ts";
  const calcule = perimetreAudit(observeesDuSchema(lireSchema()));
  const seuil = Math.ceil(calcule.length / 2);

  it("le périmètre est peuplé — sinon il n'y a rien à ne pas recopier", () => {
    expect(calcule.length).toBeGreaterThanOrEqual(8);
    expect(new Set(calcule).size).toBe(calcule.length);
    expect(NOM_DECLENCHEUR).toBe("journal_audit");
  });

  for (const { fichier, section } of SOURCES_QUI_RENVOIENT) {
    it(`${fichier} renvoie au périmètre et ne le recopie pas`, () => {
      const texte = readFileSync(join(process.cwd(), fichier), "utf8");
      const extrait = section.exec(texte)?.[0];

      // Témoin d'adossement : la section visée existe encore. Un motif qui ne
      // trouve rien ne prouve rien — il passerait au vert sur un fichier vide.
      expect(extrait, `section introuvable dans ${fichier}`).toBeTruthy();
      expect(extrait).toContain(CHEMIN);

      const enumerees = tablesEnumerees(extrait ?? "", calcule);
      expect(
        enumerees.length,
        `${fichier} réénumère le périmètre : ${enumerees.join(", ")}`,
      ).toBeLessThan(seuil);
    });
  }

  it("ÉPREUVE : une recopie réintroduite est détectée", () => {
    const recopie = `Le périmètre couvre ${calcule.join(", ")}.`;

    expect(tablesEnumerees(recopie, calcule)).toEqual(calcule);
    expect(tablesEnumerees(recopie, calcule).length).toBeGreaterThanOrEqual(
      seuil,
    );

    // Et une recopie PARTIELLE, exactement au seuil, est prise elle aussi.
    const partielle = `Couvertes : ${calcule.slice(0, seuil).join(", ")}.`;
    expect(tablesEnumerees(partielle, calcule).length).toBeGreaterThanOrEqual(
      seuil,
    );

    // Le renvoi, lui, ne nomme rien.
    expect(tablesEnumerees("Le périmètre vit dans " + CHEMIN, calcule)).toEqual(
      [],
    );
  });
});
