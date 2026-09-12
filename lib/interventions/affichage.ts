import { cleJour, type JourLocal } from "@/lib/calendar/fuseau";

/**
 * CE QUE LE PLANNING AFFICHE — UNE SEULE FOIS, POUR TOUS SES CONSOMMATEURS.
 *
 * ## LE DÉFAUT QUE CE MODULE EMPÊCHE DE REVENIR
 *
 * L'écran du planning a **deux consommateurs du même jeu de lignes** : la vue
 * — grille de semaine ou colonne de journée — et le **panneau de charge**. Ils
 * ne lisaient pas le même jeu : le panneau recevait la liste BRUTE, la vue une
 * liste filtrée. *Le panneau comptait donc la FILE D'ATTENTE* — les lignes sans
 * date, que `listerPlanning` ramène exprès — *et, en vue jour, les six jours de
 * la semaine.*
 *
 * **Deux chiffres côte à côte, calculés sur deux populations, et rien ne disait
 * lequel croire** (§9, 01/09). C'est la pire forme de la divergence : le
 * lecteur voit les deux et n'a aucun moyen de trancher.
 *
 * La réparation du 11/09 filtrait **une fois** dans l'écran, et c'était juste.
 * Ce qu'elle n'avait pas est **ce qui empêche de rediviser** : la règle vivait
 * dans une variable locale d'un composant de 900 lignes, et le prochain
 * consommateur pouvait recevoir autre chose sans qu'aucun test ne rougisse.
 *
 * ## CE MODULE NE LIT NI BASE NI HORLOGE
 *
 * Il reçoit les lignes et le jour affiché. *L'instant courant est un
 * paramètre*, comme partout ailleurs dans ce dépôt : une fonction qui lit
 * l'horloge rend un test vert parce que l'heure a bougé (D85).
 *
 * ## CE QU'IL NE DÉCIDE PAS
 *
 * **Ni l'ordre, ni le regroupement par agence ou par technicien.** Ce sont des
 * questions de mise en page, que `construireGrille` et `construireJournee`
 * tranchent chacun pour sa forme. Ce module dit **QUELLES lignes**, et rien de
 * plus.
 */

/** Le minimum qu'une ligne doit porter pour être placée — ou écartée. */
export type Datable = {
  readonly date_planifiee: Date | null;
};

/** Les deux vues du planning. Le nom vient du paramètre d'URL. */
export type VuePlanning = "jour" | "semaine";

/**
 * Le jour civil d'une date de planification.
 *
 * **Lu en UTC, sans fuseau, et c'est voulu** : `date_planifiee` est un
 * `@db.Date` — un JOUR, pas un instant. *La rapporter à un fuseau la décalerait
 * d'un cran sous UTC+11*, ce que `lib/interventions/trajet.ts` écrit déjà pour
 * la même colonne.
 */
export function jourDeLaDate(date: Date): JourLocal {
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/**
 * LES LIGNES QUE LE PLANNING MONTRE, et que TOUS ses consommateurs reçoivent.
 *
 * La file d'attente — `date_planifiee` nulle — en est exclue **dans les deux
 * vues** : elle a son propre panneau, et la compter dans la charge d'un
 * technicien ferait porter à quelqu'un des heures que personne ne lui a
 * données.
 */
export function lignesAffichees<T extends Datable>(
  lignes: readonly T[],
  vue: VuePlanning,
  jourAffiche: JourLocal,
): readonly T[] {
  const posees = lignes.filter((ligne) => ligne.date_planifiee !== null);
  if (vue === "semaine") {
    return posees;
  }
  const cible = cleJour(jourAffiche);
  return posees.filter(
    (ligne) =>
      ligne.date_planifiee !== null &&
      cleJour(jourDeLaDate(ligne.date_planifiee)) === cible,
  );
}

/**
 * LA FILE D'ATTENTE — l'exact complément de ce qui précède.
 *
 * Elle est rendue par **ce module et non par l'écran**, pour une raison
 * mesurable : *deux moitiés qui se prétendent complémentaires et qui sont
 * écrites à deux endroits cessent de l'être au premier changement.* Un scénario
 * vérifie ici que les deux ensembles **partitionnent** les lignes reçues.
 */
export function fileDAttente<T extends Datable>(
  lignes: readonly T[],
): readonly T[] {
  return lignes.filter((ligne) => ligne.date_planifiee === null);
}
