/**
 * Lecture des arguments d'une ligne de commande, partagée par les gestes
 * d'exploitation (`scripts/*.mts`).
 *
 * Une fonction de cinq lignes, et pourtant un module : elle était écrite dans
 * le script d'amorçage, et le geste de tarif en avait besoin. Une seconde
 * copie aurait été « une liste close recopiée pour la lisibilité » (§9,
 * 01/09) — la forme la plus banale de la divergence silencieuse.
 */

/** Lit `--clef valeur` dans une ligne de commande ; `null` si la clef est absente. */
export function argument(argv: readonly string[], clef: string): string | null {
  const rang = argv.indexOf(`--${clef}`);
  if (rang === -1) {
    return null;
  }
  return argv[rang + 1] ?? null;
}
