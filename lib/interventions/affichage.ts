import {
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { joursDeLaSemaine, SAMEDI } from "@/lib/calendar/semaine";
import { estZoneConnue, type ZoneGeographique } from "@/lib/sites/zones";

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

/**
 * LES QUATRE VUES DU PLANNING (9CI-PG-G12-DEUX-SEMAINES-MOIS, D145 — les
 * écarts à la maquette complète, D125, acceptés en bloc par QG-2). Le nom
 * vient du paramètre d'URL. « deux_semaines » et « mois » s'ajoutent à
 * « jour » et « semaine » ; aucune des deux ne retire rien à ce qui existait
 * (D128).
 */
export type VuePlanning = "jour" | "semaine" | "deux_semaines" | "mois";

/**
 * LA VUE LUE DEPUIS `?vue=` — une liste FERMÉE, comme `ongletFileDepuisParametre`
 * juste plus bas : toute valeur hors des quatre retombe sur « semaine » plutôt
 * que de faire échouer la page (L1-02f, un paramètre d'URL vient de
 * l'extérieur).
 */
export function vueDepuisParametre(
  valeur: string | readonly string[] | undefined,
): VuePlanning {
  return valeur === "jour" || valeur === "deux_semaines" || valeur === "mois"
    ? valeur
    : "semaine";
}

/**
 * TOUS LES JOURS DU MOIS CIVIL DE `jour` — 28 à 31, dimanches compris
 * (spécification §3.8). `jour.jour` n'a pas besoin d'être le 1er : seuls
 * `annee` et `mois` comptent.
 */
function joursDuMois(jour: JourLocal): readonly JourLocal[] {
  const nombreDeJours = new Date(
    Date.UTC(jour.annee, jour.mois, 0),
  ).getUTCDate();
  return Array.from({ length: nombreDeJours }, (_, index) => ({
    annee: jour.annee,
    mois: jour.mois,
    jour: index + 1,
  }));
}

/**
 * LES JOURS QU'UNE VUE MONTRE, POUR TOUS SES CONSOMMATEURS (D145).
 *
 * « jour » : un seul jour. « semaine » : six jours, du lundi au samedi — la
 * fenêtre existante, inchangée (Ducos ouvre le samedi, RG-PLA-01). « deux
 * semaines » : la même fenêtre, deux fois de suite, sans les deux dimanches —
 * spécification §3.7, décision d'Alexis du 27/09 (12 jours, pas 14). « mois » :
 * le mois civil entier, dimanches compris — spécification §3.8.
 */
export function joursDeLaVue(
  vue: VuePlanning,
  jour: JourLocal,
): readonly JourLocal[] {
  if (vue === "jour") {
    return [jour];
  }
  if (vue === "mois") {
    return joursDuMois(jour);
  }
  const premiereSemaine = joursDeLaSemaine(jour).slice(0, SAMEDI);
  if (vue === "deux_semaines") {
    const semaineSuivante = joursDeLaSemaine(jourSuivant(jour, 7)).slice(
      0,
      SAMEDI,
    );
    return [...premiereSemaine, ...semaineSuivante];
  }
  return premiereSemaine;
}

/**
 * LE NOM DU PARAMÈTRE DE PÉRIODE D'UNE VUE, ET SA VALEUR — UNE SEULE FOIS
 * (§9, 01/09), au lieu du ternaire `vue === "jour" ? "jour" : "semaine"` répété
 * à quatre endroits de l'écran avant ce ticket.
 *
 * « jour » et « mois » se réfèrent à un JOUR (`?jour=`, le 1er du mois pour
 * « mois ») ; « semaine » et « deux_semaines » se réfèrent au LUNDI de la
 * fenêtre affichée (`?semaine=`).
 */
export function parametrePeriode(
  vue: VuePlanning,
  jourAffiche: JourLocal,
  premierJourDeLaFenetre: JourLocal,
): { readonly nom: "jour" | "semaine"; readonly valeur: JourLocal } {
  return vue === "jour" || vue === "mois"
    ? { nom: "jour", valeur: jourAffiche }
    : { nom: "semaine", valeur: premierJourDeLaFenetre };
}

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
  if (vue !== "jour") {
    // « semaine », « deux_semaines » et « mois » montrent toutes les posées
    // de leur fenêtre — seule « jour » isole un jour précis, ci-dessous.
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

/** Le minimum qu'une ligne doit porter pour être filtrée par zone. */
export type Zonable = {
  readonly site: { readonly zone_geo: string | null };
};

/**
 * LE FILTRE « ZONE » DE LA COLONNE « À TRAITER » (MO-18, décision écrite
 * d'Alexis) — sur TOUS les onglets, par la zone du SITE de l'intervention.
 *
 * `null` (« Toutes les zones ») rend les lignes inchangées. Une intervention
 * dont le site n'a pas de zone (`zone_geo` nul) n'apparaît alors que sous
 * « Toutes les zones » : elle ne correspond à aucune zone précise.
 */
export function parZone<T extends Zonable>(
  lignes: readonly T[],
  zone: ZoneGeographique | null,
): readonly T[] {
  if (zone === null) {
    return lignes;
  }
  return lignes.filter((ligne) => ligne.site.zone_geo === zone);
}

/** Les quatre onglets de la colonne « À traiter » (PG-C2-FILE-ONGLETS). */
export type OngletFile =
  "a_planifier" | "en_retard" | "sans_duree" | "suspendues";

/**
 * L'ONGLET LU DEPUIS `?onglet=` — une liste FERMÉE, comme `vue` : toute autre
 * valeur (absente, inconnue, forgée) retombe sur `"a_planifier"` plutôt que de
 * faire échouer la page (L1-02f, un paramètre d'URL vient de l'extérieur).
 */
export function ongletFileDepuisParametre(
  valeur: string | readonly string[] | undefined,
): OngletFile {
  return valeur === "en_retard" ||
    valeur === "sans_duree" ||
    valeur === "suspendues"
    ? valeur
    : "a_planifier";
}

/**
 * LA ZONE LUE DEPUIS `?zone=` (MO-18) — `estZoneConnue` referme la même liste
 * que `ZONES_GEOGRAPHIQUES` (D23) ; une valeur hors liste est ignorée
 * (`null`, « Toutes les zones ») plutôt que de faire échouer la page.
 */
export function zoneFileDepuisParametre(
  valeur: string | readonly string[] | undefined,
): ZoneGeographique | null {
  return typeof valeur === "string" && estZoneConnue(valeur)
    ? (valeur as ZoneGeographique)
    : null;
}

/**
 * UNE VALEUR DE `?xxx=` PARMI UNE LISTE FERMÉE STATIQUE (PG-C6-FILTRES-
 * AUJOURDHUI) — `nature`, `priorité` et `statut` de la barre de filtres du
 * planning, chacun validé contre sa propre liste (`TYPES_INTERVENTION`,
 * `PRIORITES`, `STATUTS_INTERVENTION`, `lib/interventions/saisie.ts`) : une
 * valeur hors liste est ignorée (`null`) plutôt que de faire échouer la page
 * (L1-02f).
 */
export function valeurConnueDepuisParametre<T extends string>(
  valeur: string | readonly string[] | undefined,
  valeursConnues: readonly T[],
): T | null {
  return typeof valeur === "string" &&
    (valeursConnues as readonly string[]).includes(valeur)
    ? (valeur as T)
    : null;
}

/**
 * UN IDENTIFIANT DE `?xxx=` PARMI UNE LISTE CONNUE À L'EXÉCUTION (PG-C6-
 * FILTRES-AUJOURDHUI) — `agence`, `technicien` et `client` de la même barre :
 * la liste FERMÉE, ici, n'est connue qu'après une lecture en base (les
 * agences, techniciens ou clients de la société), jamais un tableau écrit en
 * dur. Même discipline que `valeurConnueDepuisParametre` : une valeur qui ne
 * désigne rien de connu est ignorée.
 */
export function idConnuDepuisParametre(
  valeur: string | readonly string[] | undefined,
  idsConnus: readonly string[],
): string | null {
  return typeof valeur === "string" && idsConnus.includes(valeur)
    ? valeur
    : null;
}

/**
 * L'ANCIENNETÉ D'UNE CARTE DE LA COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS),
 * en JOURS CIVILS écoulés depuis `cree_le` — jamais en heures : une carte
 * créée à 23h50 et relue à 00h10 a UN jour d'ancienneté, pas zéro heure
 * arrondie. `cree_le` est un instant (`timestamptz`), à la différence de
 * `date_planifiee` : il se lit donc sous UN fuseau, comme partout ailleurs
 * (I7, L0-08) — celui de la société, la même échelle que « aujourd'hui » sur
 * cet écran.
 */
export function ancienneteEnJours(
  creeLe: Date,
  fuseau: Fuseau,
  aujourdhuiLocal: JourLocal,
): number {
  const jourCreation = jourDe(versLocal(creeLe, fuseau));
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round(
      (instantDuJour(aujourdhuiLocal).getTime() -
        instantDuJour(jourCreation).getTime()) /
        MS_PAR_JOUR,
    ),
  );
}
