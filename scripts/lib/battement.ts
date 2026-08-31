/**
 * LE BATTEMENT DE CŒUR DE LA VÉRIFICATION NOCTURNE — logique pure
 * (ticket R0-a, écart É12 de la revue R0).
 *
 * **Ce qu'il répare, et ce n'est pas un échec.** Le dépôt s'est doté d'une
 * alarme : une *issue* s'ouvre automatiquement quand `verify:full` échoue la
 * nuit. Elle répond à « une nuit a-t-elle rougi ? » — et à cette question
 * seulement. Elle est **structurellement aveugle** à la panne la plus probable
 * d'une alarme, qui n'est pas de sonner à tort mais de **se taire** : une
 * planification désactivée ne produit aucune exécution, donc aucun échec, donc
 * aucune issue. **Le silence a exactement la forme du succès.**
 *
 * C'est le couple préventif/détectif des partitions du journal (§9, 30/08),
 * appliqué à l'alarme elle-même — sauf qu'ici les rôles s'inversent : l'issue
 * automatique est le *détectif* (elle prouve après coup qu'une nuit a rougi),
 * et ce module est ce qui surveille **l'existence du détectif**.
 *
 * ## Deux signaux, et le second seul ne suffit pas
 *
 *   1. **L'ÉTAT DU FLUX.** L'API rend `state` : `active`, `disabled_manually`,
 *      ou `disabled_inactivity`. Le dernier est la règle des 60 jours de
 *      GitHub, et c'est un signal DIRECT — il nomme la cause au lieu de la
 *      faire deviner.
 *   2. **L'ÂGE DE LA DERNIÈRE NUIT.** Un flux peut rester `active` et cesser de
 *      produire — quota épuisé, cron cassé par une modification, panne
 *      prolongée. L'état ne le dirait pas ; l'âge, si.
 *
 * ## Pourquoi il ne s'exécute PAS dans la vérification nocturne
 *
 * C'est le point de conception, et il est le seul qui compte : **un contrôle
 * qui ne tourne que lorsque la planification tourne ne peut pas constater
 * qu'elle a cessé.** Il s'exécute donc sur l'activité HUMAINE — une proposition
 * de fusion, une poussée sur `main` —, qui est le seul déclencheur qu'une
 * désactivation ne touche pas.
 *
 * **Et voici sa limite, dite plutôt que tue** (§9, forme 6) : si personne ne
 * pousse rien, il ne s'exécute pas davantage. Il ne garantit donc pas une
 * détection dans les N heures ; il garantit qu'**au premier retour de
 * quelqu'un** — le moment précis où l'on croirait les nuits vertes depuis des
 * semaines — l'écran soit rouge. C'est la garantie qu'on peut tenir, et il vaut
 * mieux l'écrire que laisser croire l'autre.
 */

/**
 * Âge maximal toléré pour la dernière exécution planifiée, en heures.
 *
 * La planification est QUOTIDIENNE (`0 15 * * *`). Trente-six heures laissent
 * passer une exécution retardée par une file d'attente — GitHub ne garantit pas
 * l'heure exacte d'un `schedule` — sans laisser passer une nuit entière
 * manquée. C'est un seuil technique de garde-fou, du même ordre que les douze
 * mois d'horizon des partitions, et non une valeur métier.
 */
export const HEURES_MAX_SANS_NUIT = 36;

/** État du flux tel que l'API des Actions le rend. */
export type EtatFlux =
  "active" | "disabled_manually" | "disabled_inactivity" | (string & {});

/** Ce que le battement observe, avant tout verdict. */
export type ObservationBattement = {
  /** Nom du fichier de flux surveillé, pour les messages. */
  flux: string;
  /** `state` rendu par l'API. */
  etat: EtatFlux;
  /**
   * Nombre d'exécutions PLANIFIÉES que l'API a rendues — le TÉMOIN. Zéro
   * signifie que le contrôle n'a rien vu, jamais que tout va bien.
   */
  executionsPlanifiees: number;
  /** Horodatage ISO de la dernière exécution planifiée, ou `null`. */
  dernierePlanifiee: string | null;
  /** L'instant de l'observation, en ISO — passé, jamais lu ici. */
  maintenant: string;
};

/** Heures écoulées entre deux horodatages ISO, ou `null` si l'un est illisible. */
export function heuresEcoulees(depuis: string, jusqua: string): number | null {
  const debut = Date.parse(depuis);
  const fin = Date.parse(jusqua);
  if (Number.isNaN(debut) || Number.isNaN(fin)) {
    return null;
  }
  return (fin - debut) / 3_600_000;
}

/**
 * Écarts du battement — une liste vide est le seul état acceptable.
 *
 * Quatre motifs, et le premier est le témoin :
 *   1. **aucune exécution planifiée observée** — la requête a-t-elle visé le
 *      bon flux, le bon dépôt, avec un jeton qui voit quelque chose ? Un
 *      décompte nul ressemble beaucoup trop à un sans-faute ;
 *   2. **le flux n'est pas actif** — et `disabled_inactivity` est nommé à part,
 *      parce que c'est la règle des 60 jours et qu'elle a une cause connue ;
 *   3. **aucune date de dernière exécution** alors que des exécutions sont
 *      comptées — l'observation se contredit, on ne la croit pas ;
 *   4. **la dernière nuit est trop ancienne** — le flux est actif et ne produit
 *      plus.
 */
export function ecartsBattement(
  observation: ObservationBattement,
  heuresMax: number = HEURES_MAX_SANS_NUIT,
): string[] {
  const ecarts: string[] = [];

  if (observation.executionsPlanifiees === 0) {
    return [
      `aucune exécution PLANIFIÉE de « ${observation.flux} » n'a été ` +
        "observée. Le battement n'a donc rien établi : soit le flux n'a " +
        "jamais tourné sur planification, soit le jeton ne voit pas " +
        "l'historique des exécutions (droit `actions: read`), soit le dépôt " +
        "interrogé n'est pas le bon. Un contrôle qui n'a rien vu n'a rien " +
        "prouvé — et ici, ne rien voir est exactement ce à quoi ressemble la " +
        "panne qu'on surveille.",
    ];
  }

  if (observation.etat === "disabled_inactivity") {
    ecarts.push(
      `le flux « ${observation.flux} » a été DÉSACTIVÉ PAR GITHUB pour ` +
        "inactivité du dépôt. C'est la règle des 60 jours — elle ne vise que " +
        "les dépôts PUBLICS : ou bien le dépôt vient de le devenir, ou bien " +
        "la règle a changé. Aucune vérification nocturne ne tourne plus, " +
        "aucun échec n'est donc rapporté, et le silence a exactement la forme " +
        "du succès. Réactiver le flux dans l'onglet Actions.",
    );
  } else if (observation.etat !== "active") {
    ecarts.push(
      `le flux « ${observation.flux} » n'est pas actif (état « ` +
        `${observation.etat} »). Tant qu'il ne l'est pas, la vérification ` +
        "nocturne ne tourne pas et n'a aucune raison de rapporter quoi que " +
        "ce soit.",
    );
  }

  if (observation.dernierePlanifiee === null) {
    ecarts.push(
      `${observation.executionsPlanifiees} exécution(s) planifiée(s) de ` +
        `« ${observation.flux} » sont comptées mais aucune ne porte de date. ` +
        "L'observation se contredit : on ne la croit pas plutôt que de la " +
        "traiter comme un succès.",
    );
    return ecarts;
  }

  const age = heuresEcoulees(
    observation.dernierePlanifiee,
    observation.maintenant,
  );
  if (age === null) {
    ecarts.push(
      "les horodatages du battement sont illisibles " +
        `(« ${observation.dernierePlanifiee} », « ${observation.maintenant} ») : ` +
        "le contrôle ne peut pas conclure, et ne conclut donc pas au vert.",
    );
    return ecarts;
  }

  if (age > heuresMax) {
    ecarts.push(
      `la dernière exécution PLANIFIÉE de « ${observation.flux} » remonte à ` +
        `${Math.floor(age)} heures (${observation.dernierePlanifiee}), pour ` +
        `un maximum toléré de ${heuresMax}. La planification est QUOTIDIENNE : ` +
        "elle a donc cessé de produire. Une planification qui ne tourne plus " +
        "ne produit AUCUN échec, donc aucune alarme — c'est précisément ce " +
        "que ce contrôle-ci existe pour voir, et c'est la seule panne que " +
        "l'ouverture automatique d'une issue ne peut pas détecter.",
    );
  }

  return ecarts;
}

/** Rapport de journal — ce qui a été observé, avant tout verdict. */
export function rapportBattement(observation: ObservationBattement): string {
  const age =
    observation.dernierePlanifiee === null
      ? null
      : heuresEcoulees(observation.dernierePlanifiee, observation.maintenant);

  return [
    `Battement de la vérification nocturne — « ${observation.flux} »`,
    `  état du flux            : ${observation.etat}`,
    `  exécutions planifiées   : ${observation.executionsPlanifiees} (témoin)`,
    `  dernière nuit           : ${observation.dernierePlanifiee ?? "(aucune)"}` +
      (age === null ? "" : `, il y a ${Math.floor(age)} h`),
    "",
  ].join("\n");
}
