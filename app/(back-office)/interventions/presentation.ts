import { type TypeIntervention } from "@prisma/client";

import {
  cleJour,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * CE QUE LE PLANNING AFFICHE — et qui n'est ni une règle métier, ni une couleur.
 *
 * **Les couleurs de statut ne sont PAS ici** : elles sont dans
 * `lib/theme/statuts.ts`, le seul endroit du dépôt où une couleur s'écrit en
 * clair (CLAUDE.md §6). Elles y ont été déplacées le jour où elles ont été
 * écrites ici — c'est le gardien qui l'a dit, pas la relecture.
 */

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` tant qu'il est nul
 * (I10).
 *
 * Le numéro est attribué par le serveur à la première synchronisation, et
 * PERSONNE ne l'attribue aujourd'hui : la référence est donc toujours locale
 * pour l'instant, et l'écran le dit plutôt que d'afficher un vide.
 */
export function referenceAffichee(ligne: {
  id: string;
  numero: number | null;
}): string {
  if (ligne.numero !== null) {
    return `INT-${String(ligne.numero).padStart(5, "0")}`;
  }
  return `Local-${ligne.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

/**
 * LE RETOUR VERS LE PLANNING REJOINT LE CRÉNEAU, jamais le haut de la semaine
 * (N-01).
 *
 * *Refaire le chemin à la main est le geste qu'on répète cinquante fois par
 * jour* — l'argument même qui a fait quitter `/planning/{id}` pour
 * `/interventions/{id}`. La vue JOUR est celle qui montre le créneau ; la
 * date qui l'ouvre est celle de l'intervention, jamais celle du serveur.
 *
 * `date_planifiee` est une colonne `@db.Date`, un jour civil stocké à minuit
 * UTC (comme `dateCivile` le lit) : aucun fuseau ne s'y applique, le lire
 * dans celui de l'agence le décalerait d'un cran sous UTC+11.
 *
 * Une intervention encore en file d'attente n'a pas de date : le planning
 * s'ouvre alors sans paramètre, sur sa semaine par défaut.
 */
export function retourPlanning(datePlanifiee: Date | null): string {
  if (datePlanifiee === null) {
    return "/planning";
  }
  const jour: JourLocal = {
    annee: datePlanifiee.getUTCFullYear(),
    mois: datePlanifiee.getUTCMonth() + 1,
    jour: datePlanifiee.getUTCDate(),
  };
  return `/planning?vue=jour&jour=${cleJour(jour)}`;
}

/**
 * ── CE QU'UN BLOC D'INTERVENTION DIT, ET CE QU'IL DISAIT ─────────────────────
 *
 * La maquette fait foi sur la disposition (D95), et elle écrit
 * **« 08:00 Garage Boulari » puis « Préventif — pont 2 col. »** : une HEURE, un
 * CLIENT, puis l'OBJET. Le bloc rendait une **référence interne**, le client
 * **et** le site — trois écarts d'un coup, et `creneau_debut` était lu depuis
 * toujours **sans jamais être affiché**.
 *
 * *L'heure est la seule information qu'un planificateur cherche dans une case
 * qu'il survole*, et c'était la seule qui manquait.
 *
 * **La référence sort du bloc**, et elle ne disparaît pas : la file d'attente et
 * la fiche la portent. *Une référence interne ne dit rien à qui regarde une
 * journée ; elle sert à en parler au téléphone.*
 */

/**
 * L'HEURE DU CRÉNEAU, dans le fuseau de l'AGENCE — jamais celui de l'appareil.
 *
 * Rend `null` quand le créneau n'est pas posé : une intervention datée sans
 * heure existe (c'est la file de planification), et *écrire « 00:00 » dirait
 * minuit là où il faut lire « pas encore d'heure »*.
 */
export function heureDuCreneau(
  ligne: { creneau_debut: Date | null },
  fuseau: Fuseau,
): string | null {
  if (ligne.creneau_debut === null) {
    return null;
  }
  const local = versLocal(ligne.creneau_debut, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

/**
 * LA PREMIÈRE LIGNE DU BLOC : l'heure et le client, dans cet ordre.
 *
 * Le SITE n'y est pas. La maquette ne le montre pas, et la raison se voit à
 * l'usage : *une cellule de grille fait cent-vingt pixels de large, et un client
 * suivi d'un site y tient sur trois lignes* — la densité double, et c'est la
 * longueur du contenu qui fait grandir les lignes, pas la feuille de style. Le
 * site reste sur la fiche, où on le cherche.
 */
export function enTeteDuBloc(
  ligne: { creneau_debut: Date | null; client: { raison_sociale: string } },
  fuseau: Fuseau,
): string {
  const heure = heureDuCreneau(ligne, fuseau);
  const client = ligne.client.raison_sociale;
  return heure === null ? client : `${heure} ${client}`;
}

/**
 * L'OBJET DU BLOC — la NATURE de l'intervention, et rien de plus aujourd'hui.
 *
 * La maquette écrit « Préventif — pont 2 col. » : une nature **et** le matériel
 * concerné. **Le matériel n'est pas rendu**, et c'est écrit plutôt que tu : il
 * vit dans `intervention_machine` (L2-08a), que `listerPlanning` ne charge pas,
 * et RG-INT-01 ne l'exige qu'au passage en statut de travail — *le dépannage à
 * l'aveugle est le cas ordinaire.* Une case vide se lirait comme une donnée
 * manquante là où il n'y a rien à afficher.
 */
export function objetDuBloc(ligne: { type: TypeIntervention }): string {
  return t(`type_intervention.${ligne.type}`);
}

/**
 * ── LES FILTRES DU REGISTRE, ET LEURS OPTIONS « TOUS/TOUTES » (AT-07) ───────
 *
 * La maquette annonce quatre filtres pour cet écran — « agence · type · statut
 * · période » — et le mot imposé « agence » (D5, D47) ne s'écrit PAS ici : il
 * se compose depuis `mot`/`motDansUnePhrase`, exactement comme le fait déjà
 * `libelleRattachement` de `sites/presentation.ts`.
 */

/** Le libellé du filtre « agence » — l'étiquette du `<select>`. */
export function libelleFiltreAgence(): string {
  return mot("agence");
}

/** L'option par défaut du filtre « agence » — aucune agence choisie. */
export function optionToutesLesAgences(): string {
  return `${t("interventions.filtre_toutes_prefixe")} ${motDansUnePhrase("agence", true)}`;
}
