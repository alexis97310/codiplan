import { readFileSync } from "node:fs";

import { PrismaClient, type Prisma } from "@prisma/client";

import { verifierRoleApplicatif } from "../lib/db/garde-role";
import { avecSociete } from "../lib/db/rls";
import {
  ecartsPrivilegesConsolidation,
  rapportPrivileges,
  ROLE_CONSOLIDATION,
  SQL_PRIVILEGES_CONSOLIDATION,
  versPrivileges,
  type LignePrivilege,
  type PrivilegeAccorde,
} from "./lib/privileges-consolidation";
import {
  ecartsListeAppartenance,
  ecartsListeParc,
  ecartsPolitiques,
  rapportPolitiques,
  SQL_COLONNE_SOCIETE,
  SQL_POLITIQUES,
  type ColonneSociete,
  type PolitiqueObservee,
} from "./lib/politiques-rls";
import {
  ecartsRlsDeclaree,
  rapportRlsDeclaree,
  SQL_ETAT_RLS,
  type EtatRlsTable,
} from "./lib/rls-declaree";
import {
  ecartsDurcissementPartitions,
  ecartsPrivilegesJournal,
  rapportPartitionsJournal,
  rapportPrivilegesJournal,
  ROLE_APPLICATIF,
  SQL_PARTITIONS_JOURNAL,
  SQL_PRIVILEGES_JOURNAL,
  TABLE_JOURNAL_AUDIT,
  versPartitionsJournal,
  versPrivilegesJournal,
  type LignePartitionJournal,
  type LignePrivilegeJournal,
  type PartitionJournal,
  type PrivilegeJournal,
} from "./lib/privileges-journal";
import {
  FICHIER_INVENTAIRE,
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  decompteVide,
  ecartsAvecContexte,
  ecartsMesureVide,
  ecartsPopulation,
  tablesMuettes,
  ecartsSansContexte,
  ecartsTemoins,
  lireInventaire,
  type DecompteHorsCloisonnement,
  type DecompteParTable,
  type Inventaire,
  type LigneInventaire,
} from "./lib/inventaire";
import { sqlDecompteAPlat } from "./lib/tables-comptees";

/**
 * Étape 2 du contrôle post-migration : CLOISONNEMENT SUR LA BASE HÉBERGÉE
 * (workflow « DB migrate & seed »).
 *
 * Ce que cette étape établit, et que rien d'autre n'établissait. Les tests
 * `tests/isolation/` prouvent le cloisonnement sur un PostgreSQL local jetable
 * (voir docs/decisions/2026-08-20-tests-isolation-postgres-local.md) : ils
 * éprouvent les migrations, pas la base hébergée. Or ce qui protège les données
 * n'est pas la migration écrite, c'est la migration APPLIQUÉE, sous le rôle
 * réellement déposé dans la configuration du service. Une politique non
 * appliquée, un `FORCE` manquant, une URL applicative restée sur le rôle
 * propriétaire : la preuve locale n'en dit rien. Cette étape la complète en
 * jouant, contre l'hébergé, ce que les tests jouent en local.
 *
 * Elle s'exécute avec `DATABASE_URL` — l'URL APPLICATIVE, celle du rôle
 * `codiplan_app`, et jamais celle des migrations. Trois refus avant toute
 * observation :
 *   1. `DATABASE_URL` absente : rien à contrôler, l'étape échoue plutôt que de
 *      passer en silence ;
 *   2. `DATABASE_URL` identique à `MIGRATION_DATABASE_URL` : le contrôle se
 *      ferait sous le rôle de migration et ne prouverait rien ;
 *   3. rôle non soumis aux politiques — propriétaire, superutilisateur ou
 *      `BYPASSRLS` : `lib/db/garde-role.ts` le refuse, exactement comme il
 *      refuserait la connexion applicative au démarrage.
 *
 * Puis deux observations, confrontées à l'inventaire à plat de l'étape 1 :
 *   — sans contexte société : zéro ligne sur chaque table cloisonnée ;
 *   — sous le contexte de chaque société : exactement ses lignes, ni plus
 *     (fuite entre sociétés), ni moins (données propres devenues invisibles).
 *
 * Puis deux contrôles permanents de PRIVILÈGES, tous deux lus dans
 * `information_schema.role_table_grants` et non déclarés — le second est celui
 * du ticket L0-10.
 *
 * Le premier, exigé par D38 : le rôle de
 * consolidation `codiplan_reporting` ne détient AUCUN privilège autre que
 * `SELECT`. Il voit toutes les sociétés et peut se connecter — c'est une clé
 * passe-partout, et sa seule limite tient à ses droits. Cette limite est posée
 * une fois par une migration ; elle est vérifiée ici à chaque exécution, par
 * `information_schema.role_table_grants` et non par déclaration. Le jour où un
 * droit d'écriture apparaît, l'étape échoue.
 *
 * Le second, exigé par L0-10 : le rôle applicatif `codiplan_app` ne détient sur
 * `journal_audit` que `SELECT` et `INSERT`. Le journal d'audit est en AJOUT
 * SEUL (I8, D32) — l'histoire s'écrit, elle ne se réécrit pas —, et cette
 * propriété tient aux privilèges, à rien d'autre. Elle a besoin d'être
 * surveillée exactement comme celle de `codiplan_reporting`, et pour une raison
 * de plus : `ALTER DEFAULT PRIVILEGES` accorde d'avance `UPDATE` et `DELETE`
 * sur toute table nouvelle, si bien que le droit d'écriture n'est pas absent
 * par nature — il est RETIRÉ. Ce qu'une migration retire, une autre peut le
 * rendre.
 *
 * Le contrôle échoue aussi sur un privilège MANQUANT : le déclencheur d'audit
 * s'exécute en `SECURITY INVOKER`, donc avec les droits du rôle applicatif.
 * Sans `INSERT`, ce n'est pas le journal qui se dégrade — c'est toute écriture
 * métier qui échoue.
 *
 * Le troisième, et il corrige le second : le DURCISSEMENT DE CHAQUE PARTITION.
 * Le contrôle précédent interroge `table_name = 'journal_audit'` — LE PARENT,
 * et lui seul. Or « une garantie posée sur une table ne suit pas ses
 * partitions » (§9) : une partition créée par un autre chemin que
 * `journal_audit_partition_creer` — une migration future, une main humaine —
 * porte les privilèges par défaut et aucune RLS, et le contrôle passait au
 * vert. Mesuré sur le contrôle lui-même : partition créée nue, privilèges
 * `DELETE,INSERT,SELECT,UPDATE`, RLS absente, verdict VERT. Le contrôle
 * énumère donc désormais les partitions et exige de CHACUNE aucun privilège et
 * les DEUX drapeaux de RLS — `FORCE` seul laisse les politiques inappliquées,
 * mesuré également.
 *
 * `journal_audit` ne figure PAS parmi les tables comptées ci-dessus, et ce
 * n'est pas un oubli : l'inventaire compare le socle amorcé par le seed à ce
 * que le rôle applicatif en voit, tandis que le journal grossit à chaque
 * écriture et n'est lisible que par deux rôles (§5.2). Un décompte y serait
 * une comparaison entre deux chiffres qui n'ont aucune raison d'être égaux.
 * Son cloisonnement est éprouvé là où il peut l'être : `tests/isolation/`.
 *
 * **Et un contrôle d'ATTRIBUT, le seul du script, parce qu'il est le seul qui
 * puisse voir ce qu'il voit.** Tout le reste ci-dessus prouve par la LECTURE —
 * de vraies lignes, sous de vrais rôles —, et c'est la preuve la plus forte
 * qu'on puisse produire : elle ne peut pas rester verte sur une RLS éteinte.
 * Mais elle est structurellement AVEUGLE à `FORCE ROW LEVEL SECURITY`, qui ne
 * concerne que le PROPRIÉTAIRE des tables : une lecture faite sous
 * `codiplan_app`, non propriétaire, ne peut pas le voir. Mesuré sur un
 * propriétaire non superutilisateur — `FORCE` retiré, le rôle applicatif voit
 * toujours zéro ligne sans contexte, et le propriétaire voit les deux sociétés.
 * L'étape lit donc `pg_class` et exige les DEUX drapeaux sur les tables
 * cloisonnées, leur absence sur les référentiels de plateforme, et le classement
 * de toute table de `public` dans exactement une des trois listes.
 *
 * Les témoins hors cloisonnement (`devise`, `parite`, `jour_ferie`) restent
 * lisibles sans contexte (D4) : sans eux, une base vide ou une connexion muette
 * produirait les mêmes zéros qu'un cloisonnement parfait.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

/**
 * Décompte des tables cloisonnées visibles depuis le client fourni.
 *
 * **LES DEUX CÔTÉS DE LA COMPARAISON PORTAIENT LA MÊME CÉCITÉ** *(mesuré le
 * 09/09/2026)*. Cette fonction comptait HUIT tables, l'inventaire en groupait
 * sept, et la liste close en portait vingt et une : les quatorze autres
 * restaient à zéro **des deux côtés**, si bien que la confrontation comparait
 * zéro à zéro et concluait au vert. *Le seul contrôle qui regarde la base
 * hébergée ne prouvait rien sur `site`, `machine` ni `intervention`* — les
 * tables qui portent la forme « parc ».
 *
 * **Et réparer UN SEUL côté produit un rouge FAUX**, ce qui a été mesuré aussi :
 * l'inventaire réparé annonçait 4 sites, celui-ci en voyait 0, et le message
 * accusait la base — *« la société ne voit pas toutes ses propres lignes »* —
 * alors que le rôle applicatif n'avait tout simplement pas été interrogé. **Une
 * comparaison n'est réparée que des deux côtés à la fois.**
 *
 * **Le 10/09/2026, la liste des lectures DISPARAÎT** : la requête est
 * fabriquée depuis la population dérivée du schéma, comme celle de
 * l'inventaire. Il n'y a plus deux listes à tenir d'accord — il n'y en a plus
 * aucune. *Un compteur qu'on ne peut pas oublier vaut mieux qu'un compteur
 * dont l'oubli fait rougir le typage.*
 */
async function compterVisible(
  client: Prisma.TransactionClient,
): Promise<DecompteParTable> {
  const decompte = decompteVide();
  const lignes = await client.$queryRawUnsafe<
    Array<{ table: string; lignes: number }>
  >(sqlDecompteAPlat(TABLES_CLOISONNEES));
  for (const ligne of lignes) {
    decompte[ligne.table] = ligne.lignes;
  }
  return decompte;
}

/**
 * Décompte des témoins hors cloisonnement, lus sans contexte.
 *
 * Dérivés eux aussi : la liste `["devise", "parite", "jour_ferie"]` était
 * écrite ici, une troisième fois dans le dépôt.
 */
async function compterTemoins(
  client: PrismaClient,
): Promise<DecompteHorsCloisonnement> {
  const decompte: DecompteHorsCloisonnement = Object.fromEntries(
    TABLES_HORS_CLOISONNEMENT.map((table) => [table, 0]),
  );
  const lignes = await client.$queryRawUnsafe<
    Array<{ table: string; lignes: number }>
  >(sqlDecompteAPlat(TABLES_HORS_CLOISONNEMENT));
  for (const ligne of lignes) {
    decompte[ligne.table] = ligne.lignes;
  }
  return decompte;
}

/**
 * Identifiants des sociétés visibles sous un contexte donné.
 * Sous le contexte de X, la politique `id = app.societe_id` n'en laisse qu'un.
 */
async function societesVisibles(
  client: Prisma.TransactionClient,
): Promise<string[]> {
  const lignes = await client.societe.findMany({ select: { id: true } });
  return lignes.map((ligne) => ligne.id);
}

/** Contrôle du contexte d'une société : décomptes exacts et identité unique. */
async function controlerSociete(
  prisma: PrismaClient,
  ligne: LigneInventaire,
): Promise<string[]> {
  return avecSociete(prisma, ligne.societe_id, async (tx) => {
    const visible = await compterVisible(tx);
    // ZÉRO CONTRE ZÉRO N'EST PAS UN RÉSULTAT. Ce refus vient AVANT la
    // comparaison : sans lui, une mesure creuse ressemble trait pour trait à
    // un cloisonnement parfait — c'est ce qui a laissé la cécité durer.
    const ecarts = [
      ...ecartsMesureVide(
        ligne.decomptes,
        visible,
        `société ${ligne.code ?? "sans code"} (${ligne.societe_id})`,
      ),
      ...ecartsAvecContexte(ligne, visible),
    ];

    const visibles = await societesVisibles(tx);
    const inattendues = visibles.filter((id) => id !== ligne.societe_id);
    if (inattendues.length > 0) {
      ecarts.push(
        `société ${ligne.code ?? "sans code"} (${ligne.societe_id}) : la table ` +
          "« societe » laisse voir d'autres sociétés — " +
          `${inattendues.join(", ")}.`,
      );
    }

    return ecarts;
  });
}

/**
 * Privilèges réellement accordés au rôle de consolidation (D38).
 *
 * Lus sous le rôle de MIGRATION, et pas sous le rôle applicatif : la vue ne
 * montre que les droits dont le rôle connecté est bénéficiaire ou concédant, et
 * c'est le rôle de migration qui a posé les `GRANT`. Sous `codiplan_app`, la
 * requête rendrait zéro ligne — que `ecartsPrivilegesConsolidation` traite pour
 * ce qu'elle est : un contrôle aveugle, donc un échec.
 */
async function lirePrivilegesConsolidation(
  client: PrismaClient,
): Promise<PrivilegeAccorde[]> {
  const lignes = await client.$queryRawUnsafe<LignePrivilege[]>(
    SQL_PRIVILEGES_CONSOLIDATION,
    ROLE_CONSOLIDATION,
  );

  return versPrivileges(lignes);
}

/**
 * Privilèges réellement accordés au rôle applicatif sur le journal d'audit
 * (L0-10). Lus sous le rôle de MIGRATION, pour la même raison que ci-dessus :
 * la vue ne montre que les droits dont le rôle connecté est bénéficiaire ou
 * concédant, et c'est le rôle de migration qui a posé les `GRANT` et les
 * `REVOKE`.
 */
async function lirePrivilegesJournal(
  client: PrismaClient,
): Promise<PrivilegeJournal[]> {
  const lignes = await client.$queryRawUnsafe<LignePrivilegeJournal[]>(
    SQL_PRIVILEGES_JOURNAL,
    ROLE_APPLICATIF,
    TABLE_JOURNAL_AUDIT,
  );

  return versPrivilegesJournal(lignes);
}

/**
 * Durcissement réellement appliqué à chaque partition du journal (L0-10).
 * Lu sous le rôle de MIGRATION, pour la même raison que les deux contrôles
 * précédents : c'est lui qui a posé les `GRANT` et les `REVOKE`.
 */
async function lirePartitionsJournal(
  client: PrismaClient,
): Promise<PartitionJournal[]> {
  const lignes = await client.$queryRawUnsafe<LignePartitionJournal[]>(
    SQL_PARTITIONS_JOURNAL,
    ROLE_APPLICATIF,
  );

  return versPartitionsJournal(lignes);
}

/**
 * État déclaré de la RLS, table par table (correction de revue L0-10).
 * `pg_class` est lisible par tous ; on la lit sous le rôle de MIGRATION, comme
 * les deux contrôles d'attribut voisins, pour que tous les contrôles qui
 * observent la STRUCTURE le fassent depuis la même connexion.
 */
async function lireEtatRls(client: PrismaClient): Promise<EtatRlsTable[]> {
  return client.$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS);
}

/**
 * Les FORMES de politique, table par table (ticket R0-a, écart É9).
 *
 * `SQL_ETAT_RLS` ci-dessus dit que la sécurité est ACTIVÉE et FORCÉE ; il ne
 * dit rien de ce que les politiques LAISSENT PASSER. Une table peut porter les
 * deux drapeaux et une politique `USING (true)` : l'attribut est irréprochable
 * et le cloisonnement n'existe plus. Les deux contrôles sont indépendants dans
 * les deux sens, et il faut les deux.
 *
 * Lu sous le rôle de MIGRATION, comme les contrôles d'attribut voisins : tous
 * ceux qui observent la STRUCTURE le font depuis la même connexion.
 */
async function lireFormesPolitiques(client: PrismaClient): Promise<{
  colonnes: ColonneSociete[];
  politiques: PolitiqueObservee[];
}> {
  return {
    colonnes:
      await client.$queryRawUnsafe<ColonneSociete[]>(SQL_COLONNE_SOCIETE),
    politiques:
      await client.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES),
  };
}

function urlApplicative(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL est vide : le contrôle de cloisonnement exige l'URL " +
        "APPLICATIVE (rôle codiplan_app). Sans elle, rien n'est contrôlé — " +
        "l'étape échoue plutôt que de laisser croire que le cloisonnement " +
        "a été vérifié.",
    );
  }

  const migration = process.env.MIGRATION_DATABASE_URL;
  if (migration !== undefined && migration.trim() === url.trim()) {
    throw new Error(
      "DATABASE_URL est identique à MIGRATION_DATABASE_URL : le contrôle se " +
        "ferait sous le rôle de migration, qui contourne les politiques par " +
        "nature. Il ne prouverait rien. Déposer dans DATABASE_URL l'URL du " +
        "rôle applicatif codiplan_app.",
    );
  }

  return url;
}

/** Rapport de journal — ce qui a été observé, et sous quel rôle. */
function rapport(
  role: string,
  base: string,
  inventaire: Inventaire,
  sansContexte: DecompteParTable,
): string {
  return [
    "── Contrôle de cloisonnement (base hébergée) ──",
    `Base            : ${base}`,
    `Rôle applicatif : ${role} (soumis aux politiques)`,
    "",
    "Sans contexte société — zéro attendu partout",
    ...TABLES_CLOISONNEES.map(
      (table) => `  ${table.padEnd(20)} : ${sansContexte[table]}`,
    ),
    "",
    `Sous contexte — ${inventaire.societes.length} société(s) de l'inventaire`,
    ...inventaire.societes.map(
      (societe) =>
        `  ${(societe.code ?? "SANS CODE").padEnd(20)} : ` +
        TABLES_CLOISONNEES.map(
          (table) => `${table}=${societe.decomptes[table]}`,
        ).join(", "),
    ),
    "",
  ].join("\n");
}

// **Le rôle de MIGRATION n'est plus nécessaire ici, et l'exiger était devenu
// un vestige.** Les contrôles de privilèges lisaient
// `information_schema.role_table_grants`, aveugle à ce que le rôle connecté
// n'a ni reçu ni concédé : il fallait donc le rôle qui avait posé les `GRANT`.
// Ils lisent désormais `pg_class.relacl` par `aclexplode`, que n'importe quel
// rôle peut lire — mesuré, mêmes lignes. Une exigence dont la raison a disparu
// n'ajoute pas de sécurité : elle en retire, en faisant porter à une étape
// automatique une accréditation capable de tout écrire pour un travail qui ne
// fait que lire. Tout se joue sous le rôle APPLICATIF.
const url = urlApplicative();
const inventaire = lireInventaire(readFileSync(FICHIER_INVENTAIRE, "utf8"));
const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  // Le garde-fou applicatif lui-même : si le rôle échappe aux politiques, il
  // refuse — et le contrôle s'arrête ici, sans rien observer.
  const diagnostic = await verifierRoleApplicatif(prisma);

  // Hors transaction, donc sans `app.societe_id` : c'est bien l'absence de
  // contexte que l'on éprouve. `set_config(..., true)` étant local à la
  // transaction, aucune requête antérieure ne peut en avoir laissé un.
  const sansContexte = await compterVisible(prisma);
  const temoins = await compterTemoins(prisma);

  process.stdout.write(
    rapport(diagnostic.role, diagnostic.base, inventaire, sansContexte),
  );

  // D38 — les privilèges du rôle de consolidation, observés et non déclarés.
  const privileges = await lirePrivilegesConsolidation(prisma);
  process.stdout.write(rapportPrivileges(privileges));

  // L0-10 — l'ajout seul du journal d'audit, observé et non déclaré.
  const privilegesJournal = await lirePrivilegesJournal(prisma);
  process.stdout.write(rapportPrivilegesJournal(privilegesJournal));

  // L0-10 — et le durcissement de CHAQUE partition : le contrôle ci-dessus ne
  // regarde que le parent, qui ne dit rien de ses partitions (§9).
  const partitionsJournal = await lirePartitionsJournal(prisma);
  process.stdout.write(rapportPartitionsJournal(partitionsJournal));

  // L0-10 (revue) — l'état DÉCLARÉ de RLS : la seule preuve possible de FORCE,
  // que la lecture sous le rôle applicatif ne peut pas produire.
  const etatRls = await lireEtatRls(prisma);
  process.stdout.write(rapportRlsDeclaree(etatRls));

  // R0-a (É9) — et ce que ces politiques laissent passer : l'état déclaré ne
  // dit rien de la FORME, et c'est la forme qui cloisonne.
  const formes = await lireFormesPolitiques(prisma);
  process.stdout.write(rapportPolitiques(formes.colonnes, formes.politiques));

  const ecarts = [
    // La couverture d'abord : un contrôle dont la population laisse une table
    // du schéma dehors ne prouve rien d'elle, et son vert est une absence de
    // mesure. Il vaut mieux le dire que de le conclure.
    ...ecartsPopulation(),
    ...ecartsSansContexte(sansContexte),
    ...ecartsTemoins(inventaire.hors_cloisonnement, temoins),
    ...ecartsPrivilegesConsolidation(privileges),
    ...ecartsPrivilegesJournal(privilegesJournal),
    ...ecartsDurcissementPartitions(partitionsJournal),
    ...ecartsRlsDeclaree(etatRls),
    ...ecartsListeParc(),
    ...ecartsListeAppartenance(),
    ...ecartsPolitiques(formes.colonnes, formes.politiques),
  ];
  // ── CE QUE LA COMPARAISON A RÉELLEMENT ÉTABLI, ET CE QU'ELLE N'A PAS ÉTABLI
  //
  // Le rapport concluait « exactement les lignes de chaque société sous son
  // contexte » — phrase vraie de sept tables, présentée comme vraie de vingt
  // et une, pendant deux jours et vingt et une heures. Les tables dont les
  // DEUX côtés valent zéro sont désormais NOMMÉES et retranchées de ce que le
  // rapport affirme : elles n'ont rien prouvé, et un zéro légitime ressemble
  // trait pour trait à un zéro aveugle (§9, 06/09 et 30/08).
  const muettes = new Map<string, string[]>();
  for (const societe of inventaire.societes) {
    ecarts.push(...(await controlerSociete(prisma, societe)));
    const visible = await avecSociete(prisma, societe.societe_id, (tx) =>
      compterVisible(tx),
    );
    muettes.set(
      societe.code ?? societe.societe_id,
      tablesMuettes(societe.decomptes, visible),
    );
  }

  process.stdout.write(
    [
      "Portée réelle de la comparaison (population dérivée du schéma)",
      ...[...muettes.entries()].map(([code, tables]) =>
        tables.length === 0
          ? `  ${code} : ${TABLES_CLOISONNEES.length} table(s) mesurée(s), aucune muette`
          : `  ${code} : ${TABLES_CLOISONNEES.length - tables.length} mesurée(s), ` +
            `${tables.length} comparée(s) ZÉRO À ZÉRO — rien n'y est prouvé : ` +
            tables.join(", "),
      ),
      "",
    ].join("\n"),
  );

  if (ecarts.length > 0) {
    throw new Error(
      [
        "Cloisonnement en défaut sur la base hébergée :",
        ...ecarts.map((ecart) => `  — ${ecart}`),
        "",
        "Aucune de ces observations n'est tolérable : l'invariant I1 exige que " +
          "la base applique le cloisonnement en plus du filtre applicatif.",
      ].join("\n"),
    );
  }

  process.stdout.write(
    "Cloisonnement vérifié sur la base hébergée : aucune ligne sans contexte, " +
      "exactement les lignes de chaque société sous son contexte — sur les " +
      "tables que la portée ci-dessus dit MESURÉES, jamais sur les muettes —, " +
      `« ${ROLE_CONSOLIDATION} » en SELECT seul, ` +
      `« ${TABLE_JOURNAL_AUDIT} » en ajout seul pour « ${ROLE_APPLICATIF} », ` +
      `ses ${partitionsJournal.length} partitions toutes durcies, et les ` +
      `${etatRls.length} tables du schéma dans l'état RLS que I1 exige, et ` +
      `${formes.politiques.length} politiques toutes à la forme que I1 ` +
      "impose à leur table.\n",
  );
} finally {
  await prisma.$disconnect();
}
