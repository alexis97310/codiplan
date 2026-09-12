import { verdictDesMigrations, type TentativeMigration } from "@/lib/db/sante";

/**
 * D'OÙ VIENT UN ÉCART — la phrase que la veille MESURE au lieu de l'affirmer
 * (ticket R1-01, incident du 10/09/2026, rejoué le 12/09/2026).
 *
 * ## Ce que ce module retire, et pourquoi il a fallu un module pour cela
 *
 * Le gabarit de l'issue ouverte par une veille rouge écrivait, en toutes
 * lettres et à chaque alarme :
 *
 * > *« Ces écarts ne viennent d'aucune migration — ce sont des gestes passés à
 * > la main. »*
 *
 * **C'était une phrase fixe, pas une mesure.** La veille observe la base et
 * rien d'autre : elle ne comparait JAMAIS `_prisma_migrations` au répertoire
 * `prisma/migrations/` du dépôt, et ne pouvait donc pas savoir d'où venait un
 * écart. *Mesuré le 10/09/2026 sur l'exécution `34493977325` : l'unique écart
 * rapporté — `utilisateur_client` sans la forme « rattachement » — était
 * EXACTEMENT le contenu d'une migration jamais appliquée, et le ticket a envoyé
 * chercher un geste manuel qui n'existait pas. Il a coûté une journée.*
 *
 * *Une cause imprimée quoi qu'il arrive est une opinion que le dispositif
 * répète en votre nom* (§9, 10/09). Et elle est dans un GABARIT, c'est-à-dire à
 * l'endroit où elle se réémet à chaque alarme, longtemps après que son auteur a
 * oublié l'avoir écrite.
 *
 * ## LA MESURE N'EST PAS RÉÉCRITE ICI
 *
 * `verdictDesMigrations` répond déjà à « la base porte-t-elle ce que le dépôt
 * attend ? », avec ses trois états et son ordre de priorité — et elle est la
 * SEULE lecture de ce critère depuis la panne du 11/09. Ce module l'appelle ; il
 * n'en écrit pas une variante. *Deux implémentations d'un même critère
 * divergent en silence, parce qu'aucune des deux ne prétend être l'autre*
 * (§9, 01/09).
 *
 * Ce que ce module ajoute est **la phrase**, et elle seule : ce qu'un lecteur
 * d'alarme doit faire AVANT de conclure.
 */

/** Ce que la veille a mesuré du retard de la base sur le dépôt. */
export type Provenance = {
  /** `true` : la base porte tout ce que le dépôt attend. */
  readonly aJour: boolean;
  /** La phrase à imprimer — jamais une cause qu'on n'a pas mesurée. */
  readonly phrase: string;
};

/**
 * LA PHRASE, DÉDUITE DE LA MESURE.
 *
 * Deux verdicts, et le second est tout le ticket :
 *
 * | mesure | ce que la phrase dit |
 * |---|---|
 * | aucune migration en retard | le geste manuel est la seule explication restante |
 * | N en retard | **appliquer « DB migrate & seed » AVANT de conclure** |
 *
 * *Le geste manuel n'est affirmé que lorsque le décompte est nul* — c'est le
 * critère d'acceptation de R1-01, mot pour mot. Dans l'autre cas la phrase ne
 * conclut RIEN : elle nomme ce qui reste à faire pour que la question ait un
 * sens.
 */
export function provenanceDesEcarts(
  tentatives: readonly TentativeMigration[],
): Provenance {
  const verdict = verdictDesMigrations(tentatives);

  if (verdict.aJour) {
    return {
      aJour: true,
      phrase:
        "La base porte TOUTES les migrations que le dépôt attend (mesuré sur " +
        "`_prisma_migrations`). Aucune migration en retard ne peut donc " +
        "expliquer ces écarts : il reste un geste passé à la main sur la base.",
    };
  }

  // L'ÉCHEC est nommé avant l'absence, et l'ordre n'est pas arbitraire : une
  // migration en échec empêche d'appliquer celles qui manquent. C'est
  // `verdictDesMigrations` qui porte cette priorité ; on la rend lisible, on ne
  // la recalcule pas.
  const geste = verdict.echec
    ? "la déclarer annulée (flux « DB resolve »), puis appliquer « DB migrate " +
      "& seed »"
    : "appliquer « DB migrate & seed »";

  return {
    aJour: false,
    phrase:
      `${verdict.nombre} migration(s) en retard, à partir de ` +
      `\`${verdict.nom}\` — ${geste} AVANT de conclure. ` +
      "**Ces écarts peuvent n'être que le contenu manquant de ces " +
      "migrations**, et non une main posée sur la base : la veille observe " +
      "la base, elle ne peut pas distinguer les deux tant que le retard n'est " +
      "pas comblé.",
  };
}

/**
 * La phrase quand la veille N'A RIEN PU MESURER — elle n'a pas joint la base,
 * ou son observation n'est pas allée au bout.
 *
 * Elle existe parce que l'alarme doit imprimer quelque chose dans tous les cas,
 * et qu'une provenance vide se lirait comme « rien en retard ». *Le silence a
 * exactement la forme du succès* (§9, 31/08).
 */
export const PROVENANCE_NON_MESUREE =
  "Le retard des migrations n'a PAS été mesuré : la veille n'est pas allée au " +
  "bout de son observation. Rien ici ne dit d'où viendrait un écart — ni s'il " +
  "y en a un.";
