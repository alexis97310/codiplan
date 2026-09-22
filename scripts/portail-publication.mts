#!/usr/bin/env tsx
/**
 * LE PORTAIL DE PUBLICATION (RELEASE-1) — le lanceur.
 *
 * ## Ce qu'il fait
 *
 * Invoqué par `vercel.json` (`ignoreCommand`, via `scripts/portail-publication.sh`)
 * à chaque commit poussé sur `main`. Il compare ce que ce commit attend
 * (`lib/db/migrations-attendues.ts`) à ce que la base de production porte
 * réellement, et rend un verdict qui décide si la construction continue.
 * Le calcul lui-même — `calculerVerdict` — vit dans `scripts/lib/portail-publication.ts`,
 * seul importé par les tests : ce fichier-ci n'est qu'un point d'entrée CLI.
 *
 * ## Ce qu'il ne fait JAMAIS
 *
 * Il n'applique AUCUNE migration, et ne touche à rien. Il lit, il écrit son
 * verdict dans la sortie de construction, il sort avec un code. Le geste qui
 * répare une base en retard reste le flux « DB migrate & seed », déclenché à
 * la main — décision d'Alexis du 23/09, règle 1.
 *
 * ## La lecture qu'il réutilise, et ne réécrit pas
 *
 * `scripts/migrations-appliquees.mts` sait déjà lire ce que la base porte —
 * c'est la même lecture que `db-migrate.yml` utilise pour son propre résumé
 * d'exécution. Ce lanceur l'invoque en sous-processus, exactement comme le
 * ferait un humain (`pnpm exec tsx scripts/migrations-appliquees.mts`), et ne
 * duplique ni sa requête SQL ni son interprétation de `_prisma_migrations`.
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  CODE_DE_SORTIE,
  VARIABLE_FORCAGE,
  calculerVerdict,
  publicationForcee,
  rapport,
  type SortieScriptMigrationsAppliquees,
} from "./lib/portail-publication";

/** Invoque réellement `scripts/migrations-appliquees.mts`. */
function invoquerScriptReel(
  env: Record<string, string | undefined>,
): SortieScriptMigrationsAppliquees {
  const resultat = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/migrations-appliquees.mts"],
    // `env` est typé largement pour que `calculerVerdict` s'injecte avec un
    // simple objet dans les tests ; en usage réel, c'est `process.env`.
    { env: env as NodeJS.ProcessEnv, encoding: "utf8" },
  );
  return {
    codeSortie: resultat.status,
    stdout: resultat.stdout ?? "",
    stderr: resultat.stderr ?? "",
  };
}

const invoqueeDirectement =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoqueeDirectement) {
  if (publicationForcee(process.env)) {
    process.stdout.write(
      `## Portail de publication (RELEASE-1)\n\n` +
        `**publication forcée** — \`${VARIABLE_FORCAGE}=oui\` : la construction ` +
        `continue sans vérifier l'état des migrations en production.\n`,
    );
    process.exit(CODE_DE_SORTIE.publier);
  }

  const verdict = calculerVerdict(process.env, invoquerScriptReel);
  process.stdout.write(rapport(verdict));
  process.exit(CODE_DE_SORTIE[verdict.decision]);
}
