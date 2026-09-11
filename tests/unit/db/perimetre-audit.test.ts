import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXEMPTIONS_AUDIT,
  HORS_DOMAINE_AUDIT,
  NOM_DECLENCHEUR,
  ecartsDeclencheurs,
  ecartsExemptions,
  ecartsListeHorsDomaine,
  perimetreAudit,
  tablesExemptees,
  tablesHorsDomaine,
  tablesPremiereCategorieI1,
  type Exemption,
} from "../../../scripts/lib/perimetre-audit";
import { migrationsSql, sansCommentairesSql } from "../outils/migrations-sql";
import { lireSchema, observeesDuSchema } from "../outils/schema-prisma";

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
 * **La lecture a déménagé dans `scripts/lib/schema-prisma.ts` le 10/09/2026**,
 * pour que les SCRIPTS d'exploitation puissent en partir eux aussi — c'est
 * l'impossibilité de le faire qui a produit la cécité de l'inventaire. Le `?`
 * compte, et c'est la même lecture que le gardien d'exhaustivité de D41 : un
 * `societe_id String?` est la forme des référentiels surchargeables (D4), pas
 * celle d'une table métier. Un test plus bas confronte les deux lectures sur le
 * schéma réel — deux implémentations d'une même définition ne doivent pas
 * pouvoir diverger en silence.
 */

/**
 * Écarts entre ce que D55 exige et ce que les MIGRATIONS font réellement.
 *
 * **Ce n'est plus qu'une adaptation de source.** La logique vit dans
 * `scripts/lib/perimetre-audit.ts`, appelée telle quelle : ce gardien-ci lui
 * passe le schéma Prisma et les migrations, la veille de la base hébergée
 * (`scripts/veille-hebergee.mts`) lui passe `pg_attribute` et `pg_trigger`.
 *
 * En écrire une seconde implémentation aurait été exactement l'espèce nommée au
 * §9 du CLAUDE.md le jour même — deux lectures d'un même critère, chacune verte,
 * qui divergent sans qu'aucune ne prétende être l'autre. Le corollaire disait :
 * « soit on la remplace par un appel à la première, ce qui est presque toujours
 * possible et presque toujours meilleur ». C'était possible ; c'est fait.
 */
export function ecartsPerimetreAudit(
  schema: string,
  declenchees: readonly string[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
  horsDomaine: readonly string[] = HORS_DOMAINE_AUDIT,
): string[] {
  return ecartsDeclencheurs(
    observeesDuSchema(schema),
    declenchees,
    exemptions,
    horsDomaine,
  );
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
    const horsDomaine = tablesHorsDomaine();

    expect([...perimetre].sort()).toEqual(
      categorie1
        .filter(
          (table) => !horsDomaine.includes(table) && !exemptees.includes(table),
        )
        .sort(),
    );
    // Et les DEUX soustractions mordent réellement : sans elles, le périmètre
    // serait plus grand d'exactement ce qu'elles retirent. Sans cette mesure,
    // une frontière devenue inerte passerait inaperçue.
    expect(perimetreAudit(observees, [], []).length).toBe(
      perimetre.length + exemptees.length + horsDomaine.length,
    );
  });

  it("les vingt-huit tables auditées aujourd'hui sont exactement celles attendues", () => {
    // Le décompte, écrit en toutes lettres, pour qu'un déclencheur posé
    // ailleurs — ou disparu — se voie. C'est la constitution confrontée aux
    // migrations, pas les migrations confrontées à elles-mêmes.
    //
    // **`site` s'y ajoute au ticket L1-02, et la façon dont elle s'y est
    // ajoutée est ce que D55 promettait.** Aucune liste du dépôt n'a été
    // touchée pour l'y faire entrer : c'est CE scénario qui a rougi en la
    // nommant, parce que la migration pose le déclencheur et que le périmètre
    // se calcule depuis le schéma. Mettre à jour l'attendu d'une assertion
    // n'est pas tenir une liste d'admis — l'ancienne liste décidait du
    // périmètre, celle-ci ne fait que le constater, et elle rougit dans les
    // DEUX sens.
    //
    // **`famille_materiel` et `modele_materiel` s'y ajoutent au ticket L1-05, et
    // par le même chemin.** Elles étaient destinées à la DEUXIÈME catégorie de
    // I1 — référentiels de plateforme, hors périmètre d'audit ; l'amendement à
    // D4 en fait des tables métier cloisonnées, et elles sont donc entrées au
    // périmètre sans qu'on ait touché la moindre liste d'admis.
    //
    // **`machine` s'y ajoute au ticket L2-01, et c'est la QUATRIÈME fois que ce
    // scénario réclame une table de lui-même.** Une fiche machine est saisie
    // par un humain, souvent sur le terrain et hors ligne : « qui a changé
    // cela, quand, depuis quelle valeur » est exactement la question qu'un
    // litige pose.
    //
    // **`intervention` s'y ajoute au lot 2, et c'est la CINQUIÈME fois.** Elle
    // est de surcroît la table où l'audit paie le plus : le journal des
    // DÉPLACEMENTS demandé par l'exploitation — qui, quand, d'où vers où —
    // n'est pas une table de plus à écrire, c'est `journal_audit` faisant son
    // travail, avec les valeurs avant et après.
    //
    // **`technicien_calendrier` s'y ajoute avec le paramétrage par agence**, et
    // par le même chemin. Elle le mérite : « depuis quand ce technicien est-il
    // à mi-temps » est une question de paie autant que de planning.
    //
    // **`import_lot` et `import_lot_ligne` s'y ajoutent au ticket L1-08e, et
    // c'est la SIXIÈME fois que ce scénario réclame une table de lui-même.**
    // Elles le méritent doublement : *« qui a appliqué cet import, et
    // qu'est-ce qui a été écrasé »* est exactement la question que
    // l'annulation partielle de I6 devra trancher ligne à ligne.
    expect([...declenchees].sort()).toEqual([
      "agence",
      "calendrier",
      "calendrier_ferie",
      "calendrier_plage",
      "client",
      "contact",
      // `demande` s'y ajoute au ticket L2-06, et c'est la SEPTIÈME fois que ce
      // scénario réclame une table de lui-même. Elle le mérite pour une raison
      // que les six précédentes n'avaient pas : *elle est écrite par un compte
      // de CLIENT* (chapitre 9, P5), et « qui a déposé cela, quand, et qui l'a
      // close sans suite » est la question même d'un litige de service.
      "demande",
      "document",
      "document_recu",
      "famille_materiel",
      "forfait",
      "habilitation",
      "import_lot",
      "import_lot_ligne",
      "intervention",
      // `intervention_machine` s'y ajoute au ticket L2-08a, et par le même
      // chemin : elle est de la première catégorie de I1, donc auditée à sa
      // naissance. « Quelle machine a été retirée de cette visite, et par qui »
      // est une question de litige autant qu'une question de planning.
      "intervention_machine",
      "machine",
      "modele_materiel",
      "site",
      "site_habilitation_requise",
      "societe",
      "taux_horaire",
      // `technicien` s'y ajoute au ticket L3-01a, et par le même chemin. Elle
      // le mérite plus que sa voisine : *« depuis quand ce technicien
      // dépend-il de Koné »* décide de ce qui a été facturé en majoration
      // (D12), et c'est une question de facture autant que de planning.
      "technicien",
      "technicien_calendrier",
      "technicien_habilitation",
      "utilisateur_client",
      "utilisateur_client_site",
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
    //
    // **LA TABLE FABRIQUÉE A CHANGÉ le 09/09/2026, et le changement est le
    // signe que l'épreuve servait.** C'était `intervention` ; le lot 2 l'a
    // créée, avec son déclencheur, réclamé par ce gardien même. Garder
    // `intervention` pour cible aurait fait cesser l'épreuve de rejouer une
    // VIOLATION — elle aurait mesuré un cas devenu conforme, en restant verte
    // (§9, 11/09). La cible est désormais `contrat` : le chapitre 11 la porte,
    // elle n'existe pas au schéma, et elle sera métier et cloisonnée.
    const fabrique = `
      model Contrat {
        id         String @id @db.Uuid
        societe_id String @db.Uuid

        @@map("contrat")
      }
    `;

    const ecarts = ecartsPerimetreAudit(schema + fabrique, declenchees);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("contrat");
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
    // La liste d'exemptions étant vide, l'épreuve se joue sur une exemption
    // FABRIQUÉE — sinon la boucle ne tournerait sur rien et le scénario serait
    // creux (§9, la vacuité). L'exemption n'est pas une permission de faire les
    // deux : elle dit que la table n'est pas auditée.
    const fabriquee: Exemption[] = [
      {
        table: "agence",
        motif: "rejouable",
        justification:
          "exemption fabriquée pour l'épreuve — reconstituable depuis une " +
          "autre table auditée",
      },
    ];

    const ecarts = ecartsPerimetreAudit(schema, declenchees, fabriquee);
    const sienne = ecarts.filter((ecart) => ecart.includes("« agence »"));

    expect(sienne).toHaveLength(1);
    expect(sienne[0]).toContain("figure aux EXEMPTIONS");
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
      { table: "agence", motif: "rejouable", justification: "   " },
    ];

    const ecarts = ecartsExemptions(observees, muette);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("sans justification écrite");
  });

  it("la liste d'exemptions est VIDE, et c'est un état, pas un oubli", () => {
    // Toute table métier cloisonnée du dépôt est auditée. Une liste vide qui
    // reste vide est un meilleur signal qu'une liste à une entrée qu'on cesse
    // de regarder : le jour où elle cessera de l'être, la relecture aura une
    // raison d'avoir lieu.
    expect(EXEMPTIONS_AUDIT).toEqual([]);
    expect(ecartsExemptions(observees)).toEqual([]);
  });

  it("`journal_audit` est HORS DU DOMAINE, et non exemptée", () => {
    // La distinction n'est pas de vocabulaire. Une exemption se plaide table
    // par table, et « impossibilité » serait un argument réutilisable — pour du
    // volume, une récursion indirecte, un verrou. La frontière, elle, ne vise
    // qu'un objet, et le §9 la nommait avant que la question ne se pose.
    expect(tablesHorsDomaine()).toEqual(["journal_audit"]);
    expect(tablesExemptees()).not.toContain("journal_audit");
    expect(perimetre).not.toContain("journal_audit");

    // Et elle relève bien de la première catégorie : sans cela, la retirer du
    // domaine ne retirerait rien, et ce test serait creux.
    expect(tablesPremiereCategorieI1(observees)).toContain("journal_audit");
  });

  it("ÉPREUVE : le motif `impossible` n'existe plus", () => {
    // Le geste par lequel un périmètre inversé redevient une liste d'admis :
    // on rouvre un second motif, mesure à l'appui, et il a raison sur la forme.
    const rouverte: Exemption[] = [
      {
        table: "client",
        motif: "impossible" as unknown as Exemption["motif"],
        justification:
          "le déclencheur ferait déborder la pile, mesuré, promis, juré",
      },
    ];

    const ecarts = ecartsExemptions(observees, rouverte);
    expect(ecarts.some((ecart) => ecart.includes("qui n'existe pas"))).toBe(
      true,
    );
    expect(ecarts.join("\n")).toContain("rejouable");
  });

  it("ÉPREUVE : la frontière refuse une ADDITION", () => {
    // Faire du §9 un argument réutilisable rouvrirait par la prose la porte que
    // D55 a fermée.
    const ecarts = ecartsListeHorsDomaine(["journal_audit", "journal_acces"]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("journal_acces");
    expect(ecarts[0]).toContain("arbitrage");
  });

  it("ÉPREUVE : la frontière refuse un RETRAIT", () => {
    // Le sens inverse : le gardien réclamerait alors un déclencheur sur le
    // journal, dont il est mesuré qu'il fait déborder la pile.
    const ecarts = ecartsListeHorsDomaine([]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("journal_audit");
    expect(ecarts[0]).toContain("ne figure plus hors du domaine");
  });

  it("ÉPREUVE : un déclencheur posé sur le journal lui-même est refusé", () => {
    const ecarts = ecartsPerimetreAudit(schema, [
      ...declenchees,
      "journal_audit",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("HORS DU DOMAINE");
    expect(ecarts[0]).toContain("§9");
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
