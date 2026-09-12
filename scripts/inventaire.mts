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
  type Inventaire,
  ecartsPopulation,
  type LigneInventaire,
} from "./lib/inventaire";
import {
  messageDecompteFiltre,
  prendreIdentiteExemptee,
} from "./lib/identite-exemptee";
import { CLOISONNEE_PAR_IDENTITE } from "./lib/politiques-rls";
import { sqlDecompteParSociete } from "./lib/tables-comptees";

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

/** Une ligne du décompte tel que la base le rend. */
type LigneDecompte = {
  table: string;
  societe_id: string | null;
  lignes: number;
};

/**
 * Décompte à plat de toutes les tables, sous l'identité déjà prise.
 *
 * ── LA POPULATION VIENT DU SCHÉMA, ET LA REQUÊTE AUSSI (10/09/2026) ────────
 *
 * **Mesuré le 09/09/2026 : cette fonction groupait SEPT tables quand la liste
 * close en portait vingt et une.** Les quatorze autres restaient à
 * `decompteVide()` — *zéro, pour toujours* — et le rapport les imprimait dans
 * la colonne des observations. Sur une base portant réellement 5 sites et 6
 * interventions, l'inventaire rendait `site : 0` et `intervention : 0`, et le
 * contrôle de cloisonnement, qui s'y confronte, comparait zéro à zéro.
 *
 * La réparation du 09/09 a écrit les quatorze compteurs manquants ; celle du
 * 10/09 les EFFACE tous. **La requête est fabriquée depuis la population
 * dérivée du schéma** : il n'existe plus d'endroit où une table puisse entrer
 * dans la liste sans entrer dans la mesure. Ce n'est plus un compteur à ne pas
 * oublier, c'est une opération qui n'existe pas.
 *
 * *Et vingt et un allers-retours deviennent UN* — le §9 (23/08) compte les
 * allers-retours plutôt qu'il ne mesure les durées, et 21 × 190 ms de latence
 * vers Sydney était le quart du délai de transaction.
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
    codes.set(societe.id, societe.code);
    pour(societe.id);
  }

  const lignes = await tx.$queryRawUnsafe<LigneDecompte[]>(
    sqlDecompteParSociete(TABLES_CLOISONNEES, CLOISONNEE_PAR_IDENTITE),
  );
  for (const ligne of lignes) {
    // Une ligne rattachée à une société inconnue est RAPPORTÉE, jamais
    // ignorée : `ecartsInventaire` la nomme, et les clés étrangères
    // l'interdisent aujourd'hui. Un `societe_id` nul ne peut venir que d'une
    // colonne nullable, qui n'a rien à faire dans cette population.
    if (ligne.societe_id === null) {
      continue;
    }
    pour(ligne.societe_id)[ligne.table] = ligne.lignes;
  }

  const temoinsLus = await tx.$queryRawUnsafe<LigneDecompte[]>(
    TABLES_HORS_CLOISONNEMENT.map(
      (table) =>
        `SELECT '${table}' AS "table", NULL::text AS "societe_id", count(*)::int AS "lignes" FROM "${table}"`,
    ).join("\n UNION ALL "),
  );
  const temoins: DecompteHorsCloisonnement = Object.fromEntries(
    TABLES_HORS_CLOISONNEMENT.map((table) => [table, 0]),
  );
  for (const ligne of temoinsLus) {
    temoins[ligne.table] = ligne.lignes;
  }

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
    ...TABLES_HORS_CLOISONNEMENT.map(
      (table) =>
        `  ${table.padEnd(20)} : ${inventaire.hors_cloisonnement[table]}`,
    ),
    "",
  );

  return lignes.join("\n");
}

// ── LA COUVERTURE SE CONTRÔLE AVANT LA MESURE ─────────────────────────────
//
// Une table du schéma que la population ne range nulle part ne serait pas
// comptée, et le contrôle de cloisonnement conclurait au vert sans rien
// prouver d'elle. Le refus est prononcé AVANT d'ouvrir la connexion : il ne
// dépend d'aucune base, et il n'a aucune raison d'attendre.
const ecartsDeCouverture = ecartsPopulation();
if (ecartsDeCouverture.length > 0) {
  throw new Error(
    [
      "Population de l'inventaire incomplète :",
      ...ecartsDeCouverture.map((e) => `  — ${e}`),
    ].join("\n"),
  );
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
