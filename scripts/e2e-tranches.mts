#!/usr/bin/env tsx
/**
 * `pnpm test:e2e` (9L49Z) — le lanceur.
 *
 * Le calcul (quand trancher, combien, le code de sortie agrégé) vit dans
 * `scripts/lib/e2e-tranches.ts`, seul importé par
 * `tests/unit/e2e-tranches.test.ts`. Ce fichier-ci n'est qu'un point
 * d'entrée CLI : il spawn réellement `playwright test`, en séquence, chaque
 * tranche dans un PROCESSUS NEUF (`spawnSync`, jamais le même enfant réutilisé)
 * — c'est précisément ce qui remet le tas V8 à zéro entre deux tranches.
 */
import { spawnSync } from "node:child_process";

import {
  codeDeSortieAgrege,
  modeDexecution,
  argumentDeTranche,
} from "./lib/e2e-tranches";

function jouer(args: readonly string[]): number | null {
  const resultat = spawnSync("pnpm", ["exec", "playwright", "test", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  return resultat.status;
}

const mode = modeDexecution(process.argv.slice(2));

if (mode.type === "direct") {
  process.exit(jouer(mode.args) ?? 1);
}

const codes: (number | null)[] = [];
for (let indice = 1; indice <= mode.total; indice += 1) {
  const tranche = argumentDeTranche(indice, mode.total);
  process.stdout.write(`\n── tranche ${tranche} ──────────────────────\n\n`);
  const code = jouer([tranche]);
  process.stdout.write(`\n── tranche ${tranche} : code de sortie ${code} ──\n`);
  codes.push(code);
}

process.exit(codeDeSortieAgrege(codes));
