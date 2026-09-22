import { ecartsHorizon } from "@/lib/calendar";

import {
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
 * **Zéro territoire fait échouer aussi** — une base vide produit le même
 * silence qu'une base à jour, ce qui n'est pas la même chose. C'est la doctrine
 * des gardiens du lot 0 appliquée au temps.
 *
 * **Et zéro territoire n'est plus un zéro FILTRÉ** (FERIES-1, 22/09/2026) :
 * `agence` est cloisonnée et forcée, et ce contrôle la lisait sans identité
 * exemptée — sous un rôle hébergé non superutilisateur, il aurait vu zéro et
 * rougi « aucun territoire » sur une base qui en portait. `lireAgences` prend
 * désormais l'identité exemptée, ou refuse en le disant : les deux rouges —
 * base vide, base illisible — ne se ressemblent plus.
 *
 * **Ce contrôle ne signale plus les agences sans territoire** : il n'en existe
 * plus. `agence.territoire` est NOT NULL depuis L0-09a (D48), et la garantie a
 * changé de nature — d'un rapport nocturne à une contrainte de base.
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

  const ecarts = ecartsHorizon(etats);

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
