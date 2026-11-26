/**
 * `pnpm test:e2e` EN TRANCHES (9L49Z) — le calcul, pur.
 *
 * ## Pourquoi
 *
 * `9L47` a mesuré que, sous `CI=1` (`workers: 1`, `playwright.config.ts`),
 * le tas V8 du worker Playwright monte sans jamais redescendre avant la fin
 * de la suite (~1,4 Mo de tas utilisé par épreuve, sur le sous-ensemble le
 * plus chargé en captures) — jusqu'au `SIGABRT` constaté en production, près
 * de la 2100e épreuve sur ~2219. `9L48` a trouvé une cause partielle
 * (`ResponseExtraInfoTracker` de `playwright-core`) mais prouvé qu'elle
 * n'explique pas, seule, la courbe entière : la cause dominante reste non
 * identifiée. En attendant, `--shard=i/N` de Playwright — qui démarre un
 * worker NEUF à chaque tranche, donc une mémoire remise à zéro — est le
 * contournement sûr, explicitement demandé par ce ticket.
 *
 * ## Le choix de N
 *
 * `NOMBRE_DE_TRANCHES = 4` : ~555 épreuves par tranche sur les 2219 de la
 * suite, loin (facteur ~3,8) du point où les incidents passés ont été
 * constatés (~2100e épreuve sur ~2217). Un N plus grand multiplierait sans
 * besoin le nombre de reconstructions `next build` du serveur de test (une
 * par tranche, voir `playwright.config.ts`) pour un gain de marge qui ne
 * change rien à la décision : la suite entière, à ce rythme de croissance,
 * resterait sous le plafond même avec deux tranches seulement.
 */
export const NOMBRE_DE_TRANCHES = 4;

/** Tranche demandée, dans la forme attendue par `playwright test --shard`. */
export function argumentDeTranche(indice: number, total: number): string {
  return `--shard=${indice}/${total}`;
}

/**
 * CE QUE `pnpm test:e2e` DOIT FAIRE, selon ses arguments.
 *
 * Toute la documentation du dépôt (passations, `docs/captures/README.md`)
 * invoque `pnpm test:e2e <fichier ou motif>` pour jouer UN scénario ciblé —
 * ce chemin reste un passage direct à Playwright, inchangé. C'est seulement
 * `pnpm test:e2e` SANS ARGUMENT — la forme que joue `verify:full` — qui
 * déclenche le découpage en tranches : une suite ciblée, par construction,
 * n'approche jamais le volume qui fait grossir le tas.
 */
export type ModeDexecution =
  | { readonly type: "direct"; readonly args: readonly string[] }
  | { readonly type: "tranches"; readonly total: number };

export function modeDexecution(argv: readonly string[]): ModeDexecution {
  if (argv.length > 0) {
    return { type: "direct", args: argv };
  }
  return { type: "tranches", total: NOMBRE_DE_TRANCHES };
}

/**
 * LE CODE DE SORTIE AGRÉGÉ — non nul si UNE tranche échoue (point 2 du
 * ticket). `spawnSync` rend `null`, jamais `0`, quand le processus a été tué
 * par un signal plutôt que de sortir de lui-même — un `SIGABRT` qui
 * survivrait malgré le découpage ne doit pas se lire comme un succès.
 */
export function codeDeSortieAgrege(codes: readonly (number | null)[]): number {
  return codes.every((code) => code === 0) ? 0 : 1;
}
