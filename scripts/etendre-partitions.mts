import { MOIS_D_AVANCE_EXIGES_PARTITIONS } from "@/lib/db/partitions";

import {
  clientPartitions,
  ligneEtat,
  lireEtatPartitions,
} from "./lib/partitions";

/**
 * EXTENSION de l'horizon des partitions du journal d'audit (ticket L0-10).
 *
 * Le remède du contrôle préventif de `pnpm audit:partitions`. **Un contrôle
 * daté sans remède versionné est un cul-de-sac** : c'est la troisième pièce
 * qu'exige la doctrine des données qui se périment (D46, complément 3 ;
 * CLAUDE.md §9), aux côtés de l'horizon posé à la création et du contrôle qui
 * le surveille.
 *
 * **Il n'écrit pas une ligne de DDL.** Il appelle
 * `journal_audit_partitions_etendre`, la fonction que pose la migration —
 * laquelle crée la partition ET la durcit d'un seul geste. Séparer les deux,
 * c'est garantir qu'un jour une partition naîtra sans son `REVOKE` ni sa RLS,
 * et une partition non durcie rouvre le trou mesuré au ticket : le rôle
 * applicatif y lirait, réécrirait et effacerait les lignes d'autres sociétés.
 * Le SQL brut vit donc dans la migration, comme le CLAUDE.md §2 l'exige.
 *
 * Idempotent : ne crée que ce qui manque, et le dit.
 */
const prisma = clientPartitions();

try {
  const avant = await lireEtatPartitions(prisma);
  process.stdout.write(
    ["── Extension des partitions ──────────────", ligneEtat(avant), ""].join(
      "\n",
    ),
  );

  const [resultat] = await prisma.$queryRawUnsafe<{ creees: number }[]>(
    'SELECT "journal_audit_partitions_etendre"($1::integer) AS creees',
    MOIS_D_AVANCE_EXIGES_PARTITIONS,
  );
  const creees = Number(resultat?.creees ?? 0);

  const apres = await lireEtatPartitions(prisma);
  process.stdout.write([ligneEtat(apres), ""].join("\n"));

  process.stdout.write(
    creees === 0
      ? "Aucune partition à créer : l'horizon était déjà tenu.\n"
      : `${creees} partition(s) créée(s) et durcie(s).\n`,
  );
} finally {
  await prisma.$disconnect();
}
