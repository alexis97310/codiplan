import { randomBytes } from "node:crypto";

import { urlApplicative, VARIABLE_BASE_E2E } from "./base";

/**
 * LES VARIABLES QUE LA BIBLIOTHÈQUE D'AUTHENTIFICATION LIT, POSÉES AVANT ELLE.
 *
 * **Ce module n'existe que pour son ORDRE.** Les imports d'un module ES
 * s'évaluent dans l'ordre où ils sont écrits, et avant toute instruction du
 * corps : poser ces variables dans le corps de `global.ts` les poserait APRÈS
 * l'évaluation de `./scene`, donc après celle de la configuration
 * d'authentification. *Le harnais mesurerait alors l'environnement d'avant, et
 * rien ne le dirait.*
 *
 * Le secret est **tiré au sort à chaque exécution**, jamais écrit dans le dépôt
 * ni dans un fichier (I9, §9 du protocole de session).
 */
if (process.env[VARIABLE_BASE_E2E] !== undefined) {
  process.env.DATABASE_URL = urlApplicative();
  process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("hex");
}

export const ENVIRONNEMENT_POSE = true;
