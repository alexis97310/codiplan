import { ecartsHorizon, ecartsTerritoireManquant } from "@/lib/calendar";

import {
  agencesSansTerritoire,
  clientHorizon,
  ligneEtat,
  lireAgences,
  lireHorizons,
} from "./lib/feries";

/**
 * CONTRÔLE de l'horizon des jours fériés — porte de `pnpm verify:full`
 * (ticket L0-08 ; D46, complément 3).
 *
 * **Ce qu'il empêche.** Les jours fériés sont datés. Une table alimentée
 * aujourd'hui cessera silencieusement de connaître les fériés dans deux ans, et
 * le planning proposera des créneaux un 1ᵉʳ mai sans rien signaler. Aucun test
 * ordinaire ne le verrait : la table ne sera pas vide, elle sera PÉRIMÉE — et
 * un décompte non nul ressemble beaucoup trop à des données justes.
 *
 * **La règle.** Tout territoire présent dans la table `agence` doit disposer
 * d'au moins douze mois de jours fériés devant lui. Le message d'échec nomme le
 * territoire et la dernière date connue.
 *
 * **Deux échecs de plus, et ils comptent autant.** Une agence sans territoire
 * est signalée : la colonne est nullable faute de défaut légitime, et ce
 * contrôle est ce qui fait que le vide n'y dure pas. Et zéro territoire fait
 * échouer aussi — une base vide produit le même silence qu'une base à jour, ce
 * qui n'est pas la même chose. C'est la doctrine des gardiens du lot 0
 * appliquée au temps.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce rapport est une sortie de journal délibérée.
 */
const prisma = clientHorizon();

try {
  const agences = await lireAgences(prisma);
  const etats = await lireHorizons(prisma, agences);

  process.stdout.write(
    [
      "── Horizon des jours fériés ──────────────",
      ...etats.map(ligneEtat),
      "",
    ].join("\n"),
  );

  const ecarts = [
    ...ecartsTerritoireManquant(agencesSansTerritoire(agences)),
    ...ecartsHorizon(etats),
  ];

  if (ecarts.length > 0) {
    throw new Error(
      [
        "Horizon des jours fériés insuffisant :",
        ...ecarts.map((ecart) => `  — ${ecart}`),
      ].join("\n"),
    );
  }

  process.stdout.write(
    `${etats.length} territoire(s) contrôlé(s) — au moins douze mois d'avance ` +
      "partout.\n",
  );
} finally {
  await prisma.$disconnect();
}
