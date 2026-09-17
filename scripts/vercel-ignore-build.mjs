#!/usr/bin/env node
// Étape « Ignored Build Step » de Vercel (réglage projet commandForIgnoringBuildStep).
// Tourne sur la machine de build, AVANT `pnpm install` : aucune dépendance ici,
// seul le Node du système est disponible.
//
// Convention Vercel : code de sortie 1 = le build continue, 0 = il est ignoré.
// Par défaut (branche non `claude/*`, erreur d'appel réseau) on continue le
// build — l'objectif est de réduire le bruit des commits intermédiaires sur
// les branches d'agent, jamais de risquer de faire taire une vraie relecture.
import { fileURLToPath } from "node:url";

const CONSTRUIRE = 1;
const IGNORER = 0;

export async function decider({
  branche,
  proprietaire,
  depot,
  recupererPullRequests,
}) {
  if (!branche || !branche.startsWith("claude/")) {
    return { code: CONSTRUIRE, motif: `branche hors périmètre : ${branche}` };
  }

  let pullRequests;
  try {
    pullRequests = await recupererPullRequests({
      proprietaire,
      depot,
      branche,
    });
  } catch (erreur) {
    return {
      code: CONSTRUIRE,
      motif: `échec de l'appel GitHub, on construit par défaut : ${erreur}`,
    };
  }

  const pr = pullRequests[0];
  if (!pr) {
    return {
      code: IGNORER,
      motif: `aucune pull request ouverte pour ${branche}`,
    };
  }
  if (pr.draft) {
    return {
      code: IGNORER,
      motif: `pull request #${pr.number} encore en brouillon`,
    };
  }
  return {
    code: CONSTRUIRE,
    motif: `pull request #${pr.number} prête à relire`,
  };
}

export async function recupererPullRequestsGitHub({
  proprietaire,
  depot,
  branche,
}) {
  const head = encodeURIComponent(`${proprietaire}:${branche}`);
  const url = `https://api.github.com/repos/${proprietaire}/${depot}/pulls?head=${head}&state=open`;
  const reponse = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!reponse.ok) {
    throw new Error(`GitHub a répondu ${reponse.status}`);
  }
  return reponse.json();
}

async function main() {
  const { code, motif } = await decider({
    branche: process.env.VERCEL_GIT_COMMIT_REF,
    proprietaire: process.env.VERCEL_GIT_REPO_OWNER,
    depot: process.env.VERCEL_GIT_REPO_SLUG,
    recupererPullRequests: recupererPullRequestsGitHub,
  });
  console.error(
    `[vercel-ignore-build] ${code === CONSTRUIRE ? "CONSTRUIRE" : "IGNORER"} — ${motif}`,
  );
  process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erreur) => {
    console.error(
      `[vercel-ignore-build] erreur inattendue, on construit par défaut : ${erreur}`,
    );
    process.exit(CONSTRUIRE);
  });
}
