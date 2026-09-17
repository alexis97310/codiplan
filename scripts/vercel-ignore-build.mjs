#!/usr/bin/env node
// Étape « Ignored Build Step » de Vercel (réglage projet commandForIgnoringBuildStep).
// Tourne sur la machine de build, AVANT `pnpm install` : aucune dépendance ici,
// seul le Node du système est disponible.
//
// Décision d'Alexis (17/09/2026) : Vercel ne sert plus qu'à UNE URL vivante.
// SEULE la branche main construit ; toute autre branche — claude/*, humaine,
// peu importe — est ignorée. `git.deploymentEnabled` (vercel.json) ne
// convient pas : il ne sait qu'éteindre des branches nommées à l'avance,
// jamais poser un défaut fermé pour tout le reste — et les branches d'agent
// sont nommées au hasard à chaque session. Convention Vercel : code de
// sortie 1 = le build continue, 0 = il est ignoré.
import { fileURLToPath } from "node:url";

const CONSTRUIRE = 1;
const IGNORER = 0;

export function decider({ branche }) {
  if (branche === "main") {
    return { code: CONSTRUIRE, motif: "branche main" };
  }
  return { code: IGNORER, motif: `branche hors périmètre : ${branche}` };
}

function main() {
  const { code, motif } = decider({
    branche: process.env.VERCEL_GIT_COMMIT_REF,
  });
  console.error(
    `[vercel-ignore-build] ${code === CONSTRUIRE ? "CONSTRUIRE" : "IGNORER"} — ${motif}`,
  );
  process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
