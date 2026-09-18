import { type Annuaire } from "@/lib/auth/annuaire";
import { cleJour, type JourLocal } from "@/lib/calendar/fuseau";
import { jourSemaineIso, joursDeLaSemaine } from "@/lib/calendar/semaine";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { quiTravaille } from "@/lib/interventions/personnes";

/**
 * CE QUE LE CALENDRIER ET LES TROIS KPI DE `absences()` COMPOSENT (D125, lot
 * A4) — module sans JSX, même raison que `tableau-de-bord/presentation.ts` :
 * le gardien des chaînes visibles (L0-11) lirait un gabarit JSX qui assemble
 * deux clés du dictionnaire comme du texte en dur.
 *
 * ## `absences()` DESSINE UNE SEMAINE, PAS UN MOIS
 *
 * Le ticket parle d'un « calendrier mensuel à sept colonnes » ; la maquette,
 * elle, ne dessine QU'UNE semaine — `["Lun 14","Mar 15",…,"Dim 20"]`, sept
 * cellules — sous un titre de mois et des boutons ‹ / Aujourd'hui / › qui
 * en suggèrent la navigation. C'est la disposition MESURÉE qui fait foi
 * (D125), pas la formule du ticket : ce module compose donc les SEPT jours
 * de la semaine ISO courante, jamais une grille de cinq ou six semaines que
 * `absences()` ne dessine à aucun endroit.
 *
 * ## AUCUNE « NATURE » — la pastille dit une PERSONNE, jamais un TYPE
 *
 * La maquette écrit « J. Lefèvre · Congé » et « P. Poigoune · Formation ».
 * `absence` (R3-14) ne porte NI nature NI motif — *« ce n'est pas un oubli,
 * c'est une décision : la nature d'une indisponibilité regarde la médecine du
 * travail, pas le planning »* (`absences.sous_titre`). Une pastille invente
 * donc PERSONNE + `absences.pastille_bloque`, jamais un « Congé » ou une
 * « Formation » qu'aucune colonne ne porte (D125, « une donnée que le dépôt
 * ne sait pas produire »).
 */

/** Le minimum qu'un blocage porte pour être placé sur une semaine. */
export type BlocagePourCalendrier = {
  readonly id: string;
  readonly utilisateur_id: string;
  readonly du: Date;
  readonly au: Date;
};

/** Le minimum qu'une personne déclarable porte pour désigner une agence. */
export type DeclarablePourRupture = {
  readonly utilisateurId: string;
  readonly agenceId: string;
};

const MOIS_MIN = 1;

/** `jour` en date CIVILE UTC minuit — la même forme que `du`/`au` (@db.Date). */
export function versDateCivile(jour: JourLocal): Date {
  return new Date(Date.UTC(jour.annee, jour.mois - MOIS_MIN, jour.jour));
}

/** Le blocage couvre-t-il ce jour civil ? Bornes INCLUSIVES, comme `absenceCouvrant`. */
function couvre(blocage: BlocagePourCalendrier, jour: JourLocal): boolean {
  const date = versDateCivile(jour).getTime();
  return blocage.du.getTime() <= date && date <= blocage.au.getTime();
}

/** Les sept jours de la semaine ISO courante, lundi en tête. */
export function semaineAffichee(aujourdHui: JourLocal): readonly JourLocal[] {
  return joursDeLaSemaine(aujourdHui);
}

/** « Lun 15 » — l'en-tête d'une colonne, la même forme que `/planning`. */
export function enTeteDeJour(jour: JourLocal): string {
  const cle = `jour.court.${jourSemaineIso(jour)}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.jour}`.trim();
}

/** « Septembre 2026 » — le titre de la carte, celui du PREMIER jour affiché. */
export function libelleMoisAnnee(jour: JourLocal): string {
  const cle = `mois.${jour.mois}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.annee}`.trim();
}

/** Une pastille — une PERSONNE, jamais un type d'absence (voir la note de tête). */
export type PastilleAbsence = {
  readonly utilisateurId: string;
  readonly nom: string;
};

/** Les pastilles d'un jour donné, dans l'ordre des blocages lus. */
export function pastillesDuJour(
  jour: JourLocal,
  blocages: readonly BlocagePourCalendrier[],
  annuaire: Annuaire,
): readonly PastilleAbsence[] {
  return blocages
    .filter((blocage) => couvre(blocage, jour))
    .map((blocage) => ({
      utilisateurId: blocage.utilisateur_id,
      nom: quiTravaille(blocage.utilisateur_id, annuaire),
    }));
}

/**
 * COMBIEN DE BLOCAGES, ET COMBIEN DE PERSONNES, CHEVAUCHENT LE MOIS DE `jour`.
 *
 * *Un blocage qui déborde du mois compte quand même* — la maquette dit
 * « Absences ce mois », pas « débutées ce mois » : un congé du 28 août au
 * 3 septembre couvre bien des jours de septembre.
 */
export function absencesDuMois(
  blocages: readonly BlocagePourCalendrier[],
  jour: JourLocal,
): { readonly compte: number; readonly personnes: number } {
  const debut = versDateCivile({ annee: jour.annee, mois: jour.mois, jour: 1 });
  const finExclusive = versDateCivile({
    annee: jour.mois === 12 ? jour.annee + 1 : jour.annee,
    mois: jour.mois === 12 ? 1 : jour.mois + 1,
    jour: 1,
  });
  const duMois = blocages.filter(
    (blocage) =>
      blocage.du.getTime() < finExclusive.getTime() &&
      blocage.au.getTime() >= debut.getTime(),
  );
  return {
    compte: duMois.length,
    personnes: new Set(duMois.map((b) => b.utilisateur_id)).size,
  };
}

/**
 * LES AGENCES SANS AUCUN TECHNICIEN DISPONIBLE AUJOURD'HUI.
 *
 * **Ce n'est PAS `rupturesDeService`.** Cette dernière juge un ÉVÉNEMENT — les
 * interventions qu'une pose vient de rendre à la file, au moment où elle les
 * rend — et ne se relit pas plus tard (`lib/absences/depot.ts`, la note sur
 * `ResultatBlocage.ruptures`). La question posée ici est différente : *« en
 * l'état actuel des blocages, cette agence a-t-elle seulement quelqu'un de
 * disponible aujourd'hui ? »* — une lecture du jour, pas la relecture d'un
 * geste passé. Les deux ne se contredisent pas : l'une alerte au moment où le
 * service casse, l'autre l'observe en continu (§9, 01/09 — même critère,
 * lu à deux moments, jamais recalculé à la place de l'original).
 *
 * Une agence sans AUCUN technicien déclarable (`effectif = 0`) n'est pas
 * comptée : c'est un référentiel incomplet, pas une rupture du jour.
 */
export type AgenceEnRupture = { readonly agenceId: string };

export function agencesSansTechnicienDisponible(
  declarables: readonly DeclarablePourRupture[],
  blocages: readonly BlocagePourCalendrier[],
  aujourdHui: JourLocal,
): readonly AgenceEnRupture[] {
  const absentsAujourdHui = new Set(
    blocages
      .filter((blocage) => couvre(blocage, aujourdHui))
      .map((blocage) => blocage.utilisateur_id),
  );
  const parAgence = new Map<string, DeclarablePourRupture[]>();
  for (const declarable of declarables) {
    const deja = parAgence.get(declarable.agenceId) ?? [];
    deja.push(declarable);
    parAgence.set(declarable.agenceId, deja);
  }
  const rompues: AgenceEnRupture[] = [];
  for (const [agenceId, techniciens] of parAgence) {
    if (
      techniciens.length > 0 &&
      techniciens.every((tech) => absentsAujourdHui.has(tech.utilisateurId))
    ) {
      rompues.push({ agenceId });
    }
  }
  return rompues;
}

/**
 * LE DÉTAIL DU KPI « RUPTURE DE SERVICE » QUAND IL VAUT ZÉRO.
 *
 * Le mot imposé « agence » (D5, D47) ne s'écrit jamais en dur dans une phrase
 * du dictionnaire : il se compose ici depuis `motDansUnePhrase`, comme
 * `optionToutesLesAgences` le fait déjà pour le filtre du registre VGP.
 */
export function libelleRuptureAucune(): string {
  return `${t("absences.kpi_rupture_aucune_prefixe")} ${motDansUnePhrase("agence")} ${t("absences.kpi_rupture_aucune_suffixe")}`;
}

/** Le lien de navigation d'une semaine — le même principe que `/planning`. */
export function hrefSemaine(lundi: JourLocal): string {
  return `/absences?semaine=${cleJour(lundi)}`;
}
