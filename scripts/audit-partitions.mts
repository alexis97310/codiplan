import {
  ecartsHorizonPartitions,
  ecartsPartitionDefaut,
  MOIS_D_AVANCE_EXIGES_PARTITIONS,
} from "@/lib/db/partitions";

import {
  clientPartitions,
  ligneEtat,
  lireEtatPartitions,
} from "./lib/partitions";

/**
 * DEUX CONTRÔLES sur les partitions du journal d'audit — porte de
 * `pnpm verify:full` (ticket L0-10).
 *
 * **Ils ne disent pas la même chose, et c'est tout l'intérêt d'en avoir deux.**
 *
 *   — Le **PRÉVENTIF** dit qu'il reste assez de partitions devant. Il protège
 *     du problème : tant qu'il est vert, aucune écriture ne peut manquer sa
 *     partition.
 *   — Le **DÉTECTIF** dit que la partition par défaut est vide. Il prouve que
 *     le problème ne s'est pas produit — ce que le préventif ne peut pas faire,
 *     puisqu'il ne parle que de l'avenir. Si une partition a manqué, l'écriture
 *     a RÉUSSI quand même : la ligne rangée par défaut est la seule trace qui
 *     en subsiste.
 *
 * Les deux s'exécutent TOUJOURS, et le rapport les nomme séparément. Faire
 * échouer le premier avant d'avoir joué le second cacherait précisément
 * l'information la plus rare : ce qui s'est déjà produit.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce rapport est une sortie de journal délibérée.
 */
const prisma = clientPartitions();

try {
  const etat = await lireEtatPartitions(prisma);

  process.stdout.write(
    ["── Partitions du journal d'audit ─────────", ligneEtat(etat), ""].join(
      "\n",
    ),
  );

  const preventif = ecartsHorizonPartitions(etat);
  const detectif = ecartsPartitionDefaut(etat);

  process.stdout.write(
    [
      `  préventif (horizon ≥ ${MOIS_D_AVANCE_EXIGES_PARTITIONS} mois) : ` +
        (preventif.length === 0 ? "vert" : "ROUGE"),
      `  détectif  (partition par défaut vide)  : ` +
        (detectif.length === 0 ? "vert" : "ROUGE"),
      "",
    ].join("\n"),
  );

  if (preventif.length > 0 || detectif.length > 0) {
    throw new Error(
      [
        "Partitions du journal d'audit en défaut :",
        ...preventif.map((ecart) => `  — [préventif] ${ecart}`),
        ...detectif.map((ecart) => `  — [détectif] ${ecart}`),
      ].join("\n"),
    );
  }

  process.stdout.write(
    "Partitions vérifiées : l'horizon tient, et rien n'est jamais tombé dans " +
      "la partition par défaut.\n",
  );
} finally {
  await prisma.$disconnect();
}
