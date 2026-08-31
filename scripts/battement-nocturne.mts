import { maintenant } from "@/lib/calendar";

import {
  ecartsBattement,
  rapportBattement,
  type ObservationBattement,
} from "./lib/battement";

/**
 * `pnpm battement` — la vérification nocturne tourne-t-elle ENCORE ?
 * (ticket R0-a, écart É12 de la revue R0.)
 *
 * La règle est dans `scripts/lib/battement.ts`, éprouvée sur des états
 * fabriqués par `tests/unit/battement.test.ts`. Ce script fournit
 * l'OBSERVATION, et rien d'autre — même partage que l'horizon des fériés et
 * celui des partitions.
 *
 * **Il ne s'exécute pas dans la vérification nocturne, et c'est tout son
 * objet.** Un contrôle qui ne tourne que lorsque la planification tourne ne
 * peut pas constater qu'elle a cessé. Il tourne donc sur l'activité humaine —
 * proposition de fusion, poussée sur `main` — que la désactivation d'un flux
 * planifié ne touche pas.
 *
 * Deux variables, toutes deux fournies par GitHub Actions :
 *   — `GITHUB_REPOSITORY` (« proprietaire/depot ») ;
 *   — `GITHUB_TOKEN`, avec le droit `actions: read`.
 * Hors d'Actions, les poser à la main. Sans elles le script ÉCHOUE : sur un
 * dépôt privé, une requête non authentifiée rend 404, et un 404 traité comme
 * « rien à signaler » serait exactement la panne que ce contrôle surveille.
 */

/** Le flux surveillé : celui qui porte `verify:full` la nuit. */
const FLUX = "ci.yml";

const API = "https://api.github.com";

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur.trim().length === 0) {
    throw new Error(
      `${nom} est vide : le battement ne peut pas interroger l'API des ` +
        "Actions. Sur un dépôt privé, une requête non authentifiée rend 404 — " +
        "et un 404 pris pour « rien à signaler » est exactement la panne que " +
        "ce contrôle surveille. Le script échoue donc plutôt que de conclure.",
    );
  }
  return valeur.trim();
}

async function lireJson<T>(chemin: string, jeton: string): Promise<T> {
  const reponse = await fetch(`${API}${chemin}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${jeton}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!reponse.ok) {
    throw new Error(
      `L'API des Actions a répondu ${reponse.status} sur ${chemin}. Le ` +
        "battement n'a rien observé, et ne conclut donc pas au vert. Le jeton " +
        "porte-t-il le droit `actions: read` ?",
    );
  }
  return (await reponse.json()) as T;
}

type ReponseFlux = { state: string };
type ReponseExecutions = {
  total_count: number;
  workflow_runs: Array<{ run_started_at?: string; created_at: string }>;
};

async function observer(): Promise<ObservationBattement> {
  const depot = requis("GITHUB_REPOSITORY");
  const jeton = requis("GITHUB_TOKEN");

  const flux = await lireJson<ReponseFlux>(
    `/repos/${depot}/actions/workflows/${FLUX}`,
    jeton,
  );

  // `event=schedule` : les exécutions manuelles et celles des poussées ne
  // disent RIEN de la planification — c'est elle, et elle seule, qu'on surveille.
  const executions = await lireJson<ReponseExecutions>(
    `/repos/${depot}/actions/workflows/${FLUX}/runs` +
      "?event=schedule&per_page=1",
    jeton,
  );

  const derniere = executions.workflow_runs[0];

  return {
    flux: FLUX,
    etat: flux.state,
    executionsPlanifiees: executions.total_count,
    dernierePlanifiee: derniere?.run_started_at ?? derniere?.created_at ?? null,
    // L'instant présent passe par `lib/calendar`, seul endroit du dépôt où la
    // date courante se lit — et il faut nommer un fuseau (L0-08). Ici c'est
    // `UTC`, parce que la comparaison porte sur des INSTANTS : GitHub horodate
    // ses exécutions en UTC, et l'âge d'une nuit ne dépend d'aucun calendrier
    // local. Le gardien a refusé la première rédaction, qui lisait l'horloge
    // sans dire où — il avait raison, et la règle vaut aussi pour un script.
    maintenant: maintenant("UTC").instant.toISOString(),
  };
}

const observation = await observer();
process.stdout.write(rapportBattement(observation));

const ecarts = ecartsBattement(observation);
if (ecarts.length > 0) {
  throw new Error(
    [
      "La vérification nocturne ne bat plus :",
      ...ecarts.map((ecart) => `  — ${ecart}`),
      "",
      "Ce contrôle est le DÉTECTIF de l'alarme elle-même. L'ouverture " +
        "automatique d'une issue dit qu'une nuit a rougi ; elle ne peut pas " +
        "dire que les nuits ont CESSÉ, puisqu'une planification arrêtée ne " +
        "produit aucun échec. Voir le §9 du CLAUDE.md — « le silence a " +
        "exactement la forme du succès ».",
    ].join("\n"),
  );
}

process.stdout.write(
  `La vérification nocturne bat : flux « ${FLUX} » actif, ` +
    `${observation.executionsPlanifiees} exécution(s) planifiée(s), la ` +
    `dernière le ${observation.dernierePlanifiee}.\n`,
);
