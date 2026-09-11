import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

import {
  SQL_HISTORIQUE_MIGRATIONS,
  rapportHistorique,
  verdictDeResolution,
  type LigneMigration,
} from "./lib/resolution-migration";

/**
 * `pnpm db:resoudre` — DÉBLOQUER UNE BASE dont une migration a échoué.
 *
 * Porté par le flux GitHub **« DB resolve — débloquer une migration en
 * échec »**, et déclenché À LA MAIN uniquement. C'est le seul chemin qui reste
 * quand la chaîne de connexion ne vit que dans les secrets du dépôt : *une
 * procédure qui suppose un terminal portant le secret n'est pas une procédure,
 * c'est un souhait.*
 *
 * Ce script OBSERVE, puis agit si — et seulement si — l'observation l'autorise.
 * La règle est dans `scripts/lib/resolution-migration.ts` ; elle ne connaît
 * aucune base et s'éprouve sur des états fabriqués.
 *
 * **IL N'APPLIQUE AUCUNE MIGRATION**, et c'est une décision. Enchaîner
 * `resolve` puis `deploy` ferait rejouer, dans la foulée, la migration qui
 * vient d'échouer — et si rien n'a été corrigé entre-temps, elle échouerait à
 * l'identique et rebloquerait la base. *Un verbe par flux* : celui-ci
 * déverrouille, « DB migrate & seed » applique.
 *
 * **IL N'ÉCRIT AUCUNE DONNÉE MÉTIER.** La seule écriture est celle de
 * `prisma migrate resolve --rolled-back`, dans `_prisma_migrations`.
 */

const MIGRATION = process.env.MIGRATION_A_RESOUDRE ?? "";

if (MIGRATION.trim().length === 0) {
  process.stderr.write(
    "MIGRATION_A_RESOUDRE n'est pas fournie. Le nom saisi EST la " +
      "confirmation : sans lui, rien n'est écrit.\n",
  );
  process.exit(2);
}

const prisma = new PrismaClient();

try {
  const lignes = await prisma.$queryRawUnsafe<LigneMigration[]>(
    SQL_HISTORIQUE_MIGRATIONS,
  );

  process.stdout.write(`${rapportHistorique(lignes)}\n\n`);

  const verdict = verdictDeResolution(lignes, MIGRATION.trim());

  if (!verdict.resoluble) {
    process.stderr.write(`REFUSÉ — rien n'a été écrit.\n${verdict.motif}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `« ${verdict.migration.migration_name} » est en échec et n'a appliqué ` +
      "AUCUNE étape : la base ne porte rien d'elle. Elle est déclarée annulée, " +
      "puis rejouable.\n\n",
  );

  // On passe par la CLI Prisma plutôt que par un `UPDATE` écrit ici :
  // `_prisma_migrations` est la comptabilité de Prisma, et une seconde
  // implémentation de son écriture divergerait en silence (§9, 01/09).
  execFileSync(
    "pnpm",
    ["exec", "prisma", "migrate", "resolve", "--rolled-back", MIGRATION.trim()],
    { stdio: "inherit" },
  );

  const apres = await prisma.$queryRawUnsafe<LigneMigration[]>(
    SQL_HISTORIQUE_MIGRATIONS,
  );
  process.stdout.write(`\n${rapportHistorique(apres)}\n`);

  const resteEnEchec = apres.some(
    (l) => l.finished_at === null && l.rolled_back_at === null,
  );
  if (resteEnEchec) {
    // TÉMOIN : l'écriture a-t-elle réellement eu lieu ? *Un vert qui ne mesure
    // pas ce qu'il croit est la panne dominante de ce dépôt* (§9, 30/08).
    throw new Error(
      "Une migration est TOUJOURS en échec après la résolution. " +
        "La base reste bloquée — ne pas lancer « DB migrate & seed ».",
    );
  }

  process.stdout.write(
    "\nLa base est débloquée. GESTE SUIVANT, et il n'est pas automatique :\n" +
      "  lancer « DB migrate & seed » sur la MÊME cible, reinitialiser_demo décoché.\n" +
      "Sans lui, les migrations en retard le restent.\n",
  );
} finally {
  await prisma.$disconnect();
}
