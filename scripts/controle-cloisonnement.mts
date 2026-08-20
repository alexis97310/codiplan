import { readFileSync } from "node:fs";

import { PrismaClient, type Prisma } from "@prisma/client";

import { verifierRoleApplicatif } from "../lib/db/garde-role";
import { avecSociete } from "../lib/db/rls";
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

  const ecarts = [
    ...ecartsSansContexte(sansContexte),
    ...ecartsTemoins(inventaire.hors_cloisonnement, temoins),
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
      "exactement les lignes de chaque société sous son contexte.\n",
  );
} finally {
  await prisma.$disconnect();
}
