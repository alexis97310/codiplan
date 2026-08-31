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
  decompteVide,
  ecartsAvecContexte,
  ecartsSansContexte,
  ecartsTemoins,
  lireInventaire,
  type DecompteHorsCloisonnement,
  type DecompteParTable,
  type Inventaire,
  type LigneInventaire,
} from "./lib/inventaire";

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
 * Les témoins hors cloisonnement (`devise`, `parite`, `utilisateur`) restent
 * lisibles sans contexte (D4) : sans eux, une base vide ou une connexion muette
 * produirait les mêmes zéros qu'un cloisonnement parfait.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

/** Décompte des tables cloisonnées visibles depuis le client fourni. */
async function compterVisible(
  client: Prisma.TransactionClient,
): Promise<DecompteParTable> {
  const decompte = decompteVide();
  decompte.societe = await client.societe.count();
  decompte.agence = await client.agence.count();
  decompte.calendrier = await client.calendrier.count();
  decompte.calendrier_plage = await client.calendrierPlage.count();
  decompte.calendrier_ferie = await client.calendrierFerie.count();
  decompte.utilisateur_societe = await client.utilisateurSociete.count();
  decompte.utilisateur_client = await client.utilisateurClient.count();
  return decompte;
}

/** Décompte des témoins hors cloisonnement, lus sans contexte. */
async function compterTemoins(
  client: PrismaClient,
): Promise<DecompteHorsCloisonnement> {
  return {
    devise: await client.devise.count(),
    parite: await client.parite.count(),
    jour_ferie: await client.jourFerie.count(),
    utilisateur: await client.utilisateur.count(),
  };
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
    const ecarts = ecartsAvecContexte(ligne, await compterVisible(tx));

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
 * URL du rôle de migration — celui qui a posé les `GRANT`, et le seul sous
 * lequel le contrôle des privilèges de consolidation voie quelque chose.
 */
function urlMigration(): string {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "MIGRATION_DATABASE_URL est vide : le contrôle permanent des privilèges " +
        `de « ${ROLE_CONSOLIDATION} » (D38) ne peut pas être joué. Sous le ` +
        "rôle applicatif, information_schema.role_table_grants est aveugle et " +
        "rendrait zéro ligne — un vide qui ressemble trop à la conformité.",
    );
  }
  return url;
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

const url = urlApplicative();
const migration = urlMigration();
const inventaire = lireInventaire(readFileSync(FICHIER_INVENTAIRE, "utf8"));
const prisma = new PrismaClient({ datasources: { db: { url } } });
const prismaMigration = new PrismaClient({
  datasources: { db: { url: migration } },
});

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
  const privileges = await lirePrivilegesConsolidation(prismaMigration);
  process.stdout.write(rapportPrivileges(privileges));

  // L0-10 — l'ajout seul du journal d'audit, observé et non déclaré.
  const privilegesJournal = await lirePrivilegesJournal(prismaMigration);
  process.stdout.write(rapportPrivilegesJournal(privilegesJournal));

  // L0-10 — et le durcissement de CHAQUE partition : le contrôle ci-dessus ne
  // regarde que le parent, qui ne dit rien de ses partitions (§9).
  const partitionsJournal = await lirePartitionsJournal(prismaMigration);
  process.stdout.write(rapportPartitionsJournal(partitionsJournal));

  // L0-10 (revue) — l'état DÉCLARÉ de RLS : la seule preuve possible de FORCE,
  // que la lecture sous le rôle applicatif ne peut pas produire.
  const etatRls = await lireEtatRls(prismaMigration);
  process.stdout.write(rapportRlsDeclaree(etatRls));

  const ecarts = [
    ...ecartsSansContexte(sansContexte),
    ...ecartsTemoins(inventaire.hors_cloisonnement, temoins),
    ...ecartsPrivilegesConsolidation(privileges),
    ...ecartsPrivilegesJournal(privilegesJournal),
    ...ecartsDurcissementPartitions(partitionsJournal),
    ...ecartsRlsDeclaree(etatRls),
  ];
  for (const societe of inventaire.societes) {
    ecarts.push(...(await controlerSociete(prisma, societe)));
  }

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
      "exactement les lignes de chaque société sous son contexte, " +
      `« ${ROLE_CONSOLIDATION} » en SELECT seul, ` +
      `« ${TABLE_JOURNAL_AUDIT} » en ajout seul pour « ${ROLE_APPLICATIF} », ` +
      `ses ${partitionsJournal.length} partitions toutes durcies, et les ` +
      `${etatRls.length} tables du schéma dans l'état RLS que I1 exige.\n`,
  );
} finally {
  await prisma.$disconnect();
  await prismaMigration.$disconnect();
}
