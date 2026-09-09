import { writeFileSync } from "node:fs";

import { PrismaClient, type Prisma } from "@prisma/client";

import {
  FICHIER_INVENTAIRE,
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  decompteVide,
  ecartsInventaire,
  totaliser,
  type DecompteHorsCloisonnement,
  type DecompteParTable,
  type IdentiteInventaire,
  type Inventaire,
  type LigneInventaire,
  type TableCloisonnee,
} from "./lib/inventaire";

/**
 * Étape 1 du contrôle post-migration : INVENTAIRE À PLAT (workflow
 * « DB migrate & seed »).
 *
 * Ce que cette étape établit : ce que la base contient réellement, société par
 * société, SANS que les politiques de cloisonnement puissent fausser le
 * décompte. C'est l'inventaire de référence ; l'étape 2 s'y confronte pour
 * prouver le cloisonnement. Les deux ne peuvent pas être confondues : un
 * décompte pris à travers les politiques ne prouve rien sur les politiques, et
 * ne dit rien des lignes qu'elles cachent.
 *
 * Pourquoi une identité exemptée est nécessaire. La migration
 * `20260820130000_force_rls_role_applicatif` pose `FORCE ROW LEVEL SECURITY`
 * sur les quatre tables cloisonnées : leur PROPRIÉTAIRE y est soumis lui aussi.
 * Le rôle de `MIGRATION_DATABASE_URL`, si privilégié soit-il, ne lit donc pas à
 * plat du seul fait qu'il est propriétaire. Deux cas :
 *   — il porte `SUPERUSER` ou `BYPASSRLS` : il lit à plat tel quel ;
 *   — il est membre d'un rôle qui les porte (sur un hébergeur infogéré, c'est
 *     le cas courant) : un `SET LOCAL ROLE` le prend, le temps de la
 *     transaction, sans rien modifier en base.
 * À défaut, l'étape ÉCHOUE. Elle ne publie pas un décompte filtré : un
 * inventaire faux est pire qu'un inventaire absent.
 *
 * `SET LOCAL row_security = off` est le filet : sous ce réglage, PostgreSQL
 * REFUSE toute lecture qui serait filtrée par une politique, au lieu de la
 * filtrer en silence. Le décompte publié est donc, par construction, non filtré.
 *
 * Purement lecture. Aucun `ALTER TABLE`, aucune levée de `FORCE`, aucune
 * écriture : les invariants ne sont assouplis à aucun moment, pas même le temps
 * d'une transaction.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce rapport est une sortie de journal délibérée.
 */

/** Tables cloisonnées portant une colonne `societe_id` (toutes sauf `societe`). */
type TableFille = Exclude<TableCloisonnee, "societe">;

/** Forme commune des trois regroupements Prisma par `societe_id`. */
type GroupeSociete = { societe_id: string; _count: { _all: number } };

/** Tables comptées hors cloisonnement, dans l'ordre du rapport. */
const TABLES_TEMOINS = ["devise", "parite", "jour_ferie"] as const;

type ContexteRole = { role: string; base: string; exempte: boolean };

function messageAucuneIdentiteExemptee(
  contexte: ContexteRole,
  exemptesSansLecture: readonly string[],
): string {
  const cause =
    exemptesSansLecture.length > 0
      ? "Des rôles exemptés lui sont bien accessibles — " +
        `${exemptesSansLecture.join(", ")} — mais aucun n'a le droit de LIRE ` +
        "les tables : l'exemption de politique ne remplace pas un GRANT SELECT."
      : "Aucun rôle exempté (SUPERUSER ou BYPASSRLS) ne lui est accessible.";

  return (
    `Inventaire impossible : le rôle « ${contexte.role} » sur la base ` +
    `« ${contexte.base} » est soumis aux politiques de cloisonnement.\n` +
    `${cause}\n` +
    "Les quatre tables cloisonnées portent FORCE ROW LEVEL SECURITY : leur " +
    "propriétaire y est soumis comme les autres. Un décompte pris malgré tout " +
    "serait filtré, donc faux — cette étape refuse de le publier.\n" +
    "Remède : alimenter MIGRATION_DATABASE_URL avec un rôle exempté des " +
    "politiques ET habilité à lire les tables, ou membre d'un tel rôle. Voir " +
    "docs/decisions/2026-08-20-inventaire-et-controle-de-cloisonnement.md."
  );
}

function messageDecompteFiltre(identite: IdentiteInventaire): string {
  return (
    `Inventaire impossible : PostgreSQL a refusé une lecture non filtrée sous ` +
    `l'identité « ${identite.identite_exemptee} » (rôle connecté ` +
    `« ${identite.role_connecte} », base « ${identite.base} »).\n` +
    "C'est le filet `row_security = off` qui a joué : cette identité est " +
    "finalement soumise à au moins une politique, le décompte aurait donc été " +
    "filtré. Aucun inventaire n'est publié."
  );
}

/**
 * Prend, pour la durée de la transaction, une identité exemptée des politiques.
 * Lève si aucune n'est accessible.
 */
async function prendreIdentiteExemptee(
  tx: Prisma.TransactionClient,
): Promise<IdentiteInventaire> {
  const contextes = await tx.$queryRawUnsafe<ContexteRole[]>(`
    SELECT
      current_user::text AS "role",
      current_database()::text AS "base",
      (r."rolsuper" OR r."rolbypassrls") AS "exempte"
    FROM pg_catalog.pg_roles r
    WHERE r."rolname" = current_user
  `);

  const contexte = contextes[0];
  if (contexte === undefined) {
    throw new Error(
      "Impossible de déterminer le rôle de connexion : la base n'a renvoyé " +
        "aucune ligne pour `current_user`.",
    );
  }

  if (contexte.exempte) {
    return {
      role_connecte: contexte.role,
      identite_exemptee: contexte.role,
      base: contexte.base,
    };
  }

  // `pg_has_role(..., 'MEMBER')` retient aussi les appartenances NOINHERIT :
  // un `SET ROLE` suffit à les prendre, l'héritage n'est pas requis. Les
  // attributs de rôle (SUPERUSER, BYPASSRLS) ne s'héritent PAS par
  // appartenance — seul `SET ROLE` les met en jeu, d'où cette bascule.
  //
  // Un candidat doit AUSSI pouvoir lire : l'exemption de politique et le droit
  // SELECT sont deux choses distinctes, et un rôle BYPASSRLS qui ne possède pas
  // les tables n'a aucun droit dessus par défaut. Retenir un tel rôle
  // échangerait un décompte filtré contre un « permission denied » — un progrès
  // nul. Les noms de tables viennent des listes littérales du module partagé.
  const tables = [...TABLES_CLOISONNEES, ...TABLES_HORS_CLOISONNEMENT]
    .map((table) => `('${table}')`)
    .join(", ");

  const candidats = await tx.$queryRawUnsafe<
    Array<{ role: string; lit_tout: boolean }>
  >(`
    SELECT
      r."rolname"::text AS "role",
      NOT EXISTS (
        SELECT 1
        FROM (VALUES ${tables}) AS t("nom")
        WHERE NOT pg_catalog.has_table_privilege(
          r."oid", format('public.%I', t."nom"), 'SELECT'
        )
      ) AS "lit_tout"
    FROM pg_catalog.pg_roles r
    WHERE (r."rolsuper" OR r."rolbypassrls")
      AND r."rolname" <> current_user
      AND pg_catalog.pg_has_role(current_user, r."oid", 'MEMBER')
    ORDER BY r."rolsuper" DESC, r."rolname"
  `);

  const candidat = candidats.find((role) => role.lit_tout);
  if (candidat === undefined) {
    throw new Error(
      messageAucuneIdentiteExemptee(
        contexte,
        candidats.map((role) => role.role),
      ),
    );
  }

  // Nom issu du catalogue système, jamais d'une entrée extérieure ; échappé
  // malgré tout, `SET ROLE` n'acceptant pas de paramètre lié.
  const nom = candidat.role.replace(/"/g, '""');
  await tx.$executeRawUnsafe(`SET LOCAL ROLE "${nom}"`);

  return {
    role_connecte: contexte.role,
    identite_exemptee: candidat.role,
    base: contexte.base,
  };
}

/**
 * Décompte à plat de toutes les tables, sous l'identité déjà prise.
 *
 * Les décomptes passent par Prisma, jamais par du SQL brut (CLAUDE.md §2) :
 * seules la bascule d'identité et l'interrogation du catalogue des rôles, qui
 * n'ont pas d'équivalent ORM, restent en `$queryRawUnsafe`.
 */
async function compterAPlat(tx: Prisma.TransactionClient): Promise<{
  societes: LigneInventaire[];
  temoins: DecompteHorsCloisonnement;
}> {
  const decomptes = new Map<string, DecompteParTable>();
  const codes = new Map<string, string>();

  const pour = (societeId: string): DecompteParTable => {
    let decompte = decomptes.get(societeId);
    if (decompte === undefined) {
      decompte = decompteVide();
      decomptes.set(societeId, decompte);
    }
    return decompte;
  };

  const societes = await tx.societe.findMany({
    select: { id: true, code: true },
  });
  for (const societe of societes) {
    pour(societe.id).societe += 1;
    codes.set(societe.id, societe.code);
  }

  // Chaque regroupement est affecté à une variable AVANT d'être enregistré :
  // Prisma infère le type de `groupBy` depuis le contexte d'appel, et une
  // annotation posée sur le résultat brouillerait celui de ses arguments.
  const enregistrer = (
    table: TableFille,
    groupes: readonly GroupeSociete[],
  ): void => {
    for (const groupe of groupes) {
      pour(groupe.societe_id)[table] = groupe._count._all;
    }
  };

  // ── LA LISTE DES COMPTEURS EST DÉRIVÉE, PLUS TENUE À LA MAIN ────────────
  //
  // **Mesuré le 09/09/2026, et le résultat est brutal.** Cette fonction
  // groupait SEPT tables quand `TABLES_CLOISONNEES` en compte vingt-deux. Les
  // quinze autres restaient à la valeur de `decompteVide()` — **zéro, pour
  // toujours** — et le rapport les imprimait comme des observations. Sur une
  // base locale portant réellement 5 sites et 6 interventions, l'inventaire
  // rendait `site : 0` et `intervention : 0`.
  //
  // **Et le contrôle de cloisonnement se confronte à CET inventaire** : il
  // comparait donc zéro à zéro et concluait au vert. *Le seul contrôle qui
  // regarde la base hébergée ne prouvait RIEN sur `site`, `machine` et
  // `intervention` — les trois tables qui portent la forme « parc ».* C'est la
  // vacuité du §9 (30/08) dans un contrôle d'exploitation : la règle était
  // juste, l'observation était creuse.
  //
  // C'est aussi la maladie du §9 (20/08) : *une liste close se re-vérifie à
  // chaque table créée, sinon elle devient fausse.* Chaque ticket ajoutait sa
  // table à `TABLES_CLOISONNEES` — donc à la ligne imprimée — et personne ne
  // revenait écrire son compteur.
  //
  // **La charge est renversée, comme pour D41 et D55 :** `Record<TableFille,
  // …>` est EXHAUSTIF par construction. Une table ajoutée à la liste close ne
  // compile plus tant que son compteur n'est pas écrit — le gardien n'est pas
  // un test, c'est le typage, et il sonne le jour de la création.
  // Chaque regroupement est affecté à une variable AVANT d'être enregistré :
  // Prisma infère le type de `groupBy` depuis le CONTEXTE d'appel, et une
  // annotation posée sur le résultat brouillerait celui de ses arguments.
  // *Mesuré en tentant de les ranger dans des fonctions annotées : vingt
  // erreurs de typage d'un coup.*
  const parClient = await tx.client.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parSite = await tx.site.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parContact = await tx.contact.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parAgence = await tx.agence.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parCalendrier = await tx.calendrier.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parCalendrierPlage = await tx.calendrierPlage.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parCalendrierFerie = await tx.calendrierFerie.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parUtilisateurSociete = await tx.utilisateurSociete.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parUtilisateurClient = await tx.utilisateurClient.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parUtilisateurClientSite = await tx.utilisateurClientSite.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parHabilitation = await tx.habilitation.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parTechnicienHabilitation = await tx.technicienHabilitation.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parSiteHabilitationRequise = await tx.siteHabilitationRequise.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parFamilleMateriel = await tx.familleMateriel.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parModeleMateriel = await tx.modeleMateriel.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parTauxHoraire = await tx.tauxHoraire.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parMachine = await tx.machine.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parForfait = await tx.forfait.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parIntervention = await tx.intervention.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });
  const parTechnicienCalendrier = await tx.technicienCalendrier.groupBy({
    by: ["societe_id"],
    _count: { _all: true },
  });

  // EXHAUSTIF PAR CONSTRUCTION : `Record<TableFille, …>` ne compile pas tant
  // qu'une table de la liste close n'a pas son regroupement. Le gardien n'est
  // pas un test, c'est le TYPAGE — et il sonne le jour de la création.
  const groupes: Record<TableFille, GroupeSociete[]> = {
    client: parClient,
    site: parSite,
    contact: parContact,
    agence: parAgence,
    calendrier: parCalendrier,
    calendrier_plage: parCalendrierPlage,
    calendrier_ferie: parCalendrierFerie,
    utilisateur_societe: parUtilisateurSociete,
    utilisateur_client: parUtilisateurClient,
    utilisateur_client_site: parUtilisateurClientSite,
    habilitation: parHabilitation,
    technicien_habilitation: parTechnicienHabilitation,
    site_habilitation_requise: parSiteHabilitationRequise,
    famille_materiel: parFamilleMateriel,
    modele_materiel: parModeleMateriel,
    taux_horaire: parTauxHoraire,
    machine: parMachine,
    forfait: parForfait,
    intervention: parIntervention,
    technicien_calendrier: parTechnicienCalendrier,
  };

  for (const table of TABLES_CLOISONNEES) {
    if (table !== "societe") {
      enregistrer(table, groupes[table]);
    }
  }
  const temoins: DecompteHorsCloisonnement = {
    devise: await tx.devise.count(),
    parite: await tx.parite.count(),
    jour_ferie: await tx.jourFerie.count(),
  };

  const inventaire = [...decomptes.entries()]
    .map(([societeId, decompte]) => ({
      societe_id: societeId,
      code: codes.get(societeId) ?? null,
      decomptes: decompte,
    }))
    .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));

  return { societes: inventaire, temoins };
}

/** Rapport de journal — l'inventaire, société par société. */
function rapport(inventaire: Inventaire): string {
  const lignes = [
    "── Inventaire à plat ─────────────────────",
    `Base            : ${inventaire.identite.base}`,
    `Rôle connecté   : ${inventaire.identite.role_connecte}`,
    `Lecture sous    : ${inventaire.identite.identite_exemptee} (exempté des politiques)`,
    "",
  ];

  for (const societe of inventaire.societes) {
    lignes.push(
      `Société ${societe.code ?? "SANS CODE"} — ${societe.societe_id}`,
    );
    for (const table of TABLES_CLOISONNEES) {
      lignes.push(`  ${table.padEnd(20)} : ${societe.decomptes[table]}`);
    }
  }

  lignes.push(
    "",
    "Total toutes sociétés",
    ...TABLES_CLOISONNEES.map(
      (table) => `  ${table.padEnd(20)} : ${inventaire.total[table]}`,
    ),
    "",
    "Hors cloisonnement",
    ...TABLES_TEMOINS.map(
      (table) =>
        `  ${table.padEnd(20)} : ${inventaire.hors_cloisonnement[table]}`,
    ),
    "",
  );

  return lignes.join("\n");
}

const prisma = new PrismaClient();

try {
  const inventaire = await prisma.$transaction(
    async (tx) => {
      const identite = await prendreIdentiteExemptee(tx);

      // Filet : sous ce réglage, PostgreSQL lève au lieu de filtrer. Posé
      // APRÈS la bascule d'identité, il vaut pour toutes les lectures qui
      // suivent, et pour elles seules — `SET LOCAL` retombe au COMMIT.
      await tx.$executeRawUnsafe("SET LOCAL row_security = off");

      let compte;
      try {
        compte = await compterAPlat(tx);
      } catch (erreur) {
        if (/row.?level security|row security/i.test(String(erreur))) {
          throw new Error(messageDecompteFiltre(identite), { cause: erreur });
        }
        throw erreur;
      }

      return {
        identite,
        societes: compte.societes,
        total: totaliser(compte.societes),
        hors_cloisonnement: compte.temoins,
      } satisfies Inventaire;
    },
    { timeout: 30_000 },
  );

  process.stdout.write(rapport(inventaire));

  const ecarts = ecartsInventaire(inventaire);
  if (ecarts.length > 0) {
    throw new Error(
      ["Inventaire incohérent :", ...ecarts.map((e) => `  — ${e}`)].join("\n"),
    );
  }

  writeFileSync(
    FICHIER_INVENTAIRE,
    `${JSON.stringify(inventaire, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `Inventaire écrit dans ${FICHIER_INVENTAIRE} — l'étape de contrôle du ` +
      "cloisonnement s'y confrontera.\n",
  );
} finally {
  await prisma.$disconnect();
}
