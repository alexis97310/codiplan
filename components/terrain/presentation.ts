import {
  dateCivile,
  instantDuJour,
  jourSuivant,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { jourEtDateAbregee } from "@/lib/interventions/presentation-partagee";

/**
 * CE QUE LA FICHE ET LA CARTE DU TERRAIN COMPOSENT, PARTAGÉ (9DI-TP-TER1-
 * JOURNEE-FICHE, QE-11).
 *
 * Une seule écriture de chaque critère, lue par les deux écrans — jamais
 * recomposée à part dans l'un ou l'autre (§9, 01/09).
 */

/**
 * `HH:MM`, dans le fuseau donné — jamais celui de l'appareil (L0-08).
 * Exportée : le bandeau « compteur en cours » (`bandeau-compteur.tsx`) en a
 * besoin pour l'heure de départ, hors de tout créneau.
 */
export function heureLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

/**
 * LE CRÉNEAU DE LA FICHE — « HH:MM – HH:MM », ou la date seule quand aucun
 * créneau n'est posé (une intervention datée sans heure existe : c'est la
 * file de planification transmise malgré tout).
 */
export function creneauDeLaFiche(
  ligne: {
    readonly date_planifiee: Date | null;
    readonly creneau_debut: Date | null;
    readonly creneau_fin: Date | null;
  },
  fuseau: Fuseau,
): string {
  if (ligne.creneau_debut === null) {
    return ligne.date_planifiee === null
      ? t("terrain.inconnu")
      : dateCivile(ligne.date_planifiee);
  }
  const debut = heureLocale(ligne.creneau_debut, fuseau);
  if (ligne.creneau_fin === null) {
    return debut;
  }
  return `${debut} – ${heureLocale(ligne.creneau_fin, fuseau)}`;
}

/**
 * LA PREMIÈRE LIGNE D'UNE PANNE SIGNALÉE — pour la carte de Ma journée, où
 * le texte complet déborderait. `null` dès que la description est vide ou
 * absente : une carte ne montre jamais un bloc muet.
 */
export function premiereLignePanne(description: string | null): string | null {
  if (description === null) {
    return null;
  }
  const premiere = description.split("\n")[0]?.trim() ?? "";
  return premiere.length === 0 ? null : premiere;
}

/**
 * LE CONTACT AFFICHÉ — son nom, et ses numéros (téléphone ET mobile s'ils
 * diffèrent, un seul s'ils sont égaux ou qu'un seul est renseigné, aucun
 * sinon). `null` dès qu'aucun contact n'est désigné : la fiche ne montre
 * alors rien, plutôt qu'un bloc vide.
 */
export type ContactAffiche = {
  readonly nom: string;
  readonly numeros: readonly string[];
};

export function contactAffiche(
  contact: {
    readonly nom: string;
    readonly telephone: string | null;
    readonly mobile: string | null;
  } | null,
): ContactAffiche | null {
  if (contact === null) {
    return null;
  }
  const numeros = [
    ...new Set(
      [contact.telephone, contact.mobile].filter(
        (valeur): valeur is string => valeur !== null,
      ),
    ),
  ];
  return { nom: contact.nom, numeros };
}

/**
 * « mercredi 30 septembre » — LE JOUR EN TOUTES LETTRES, SANS FUSEAU
 * (9F2-TERRAIN-JOURS-MAQUETTE, D210), jamais capitalisé en milieu de phrase
 * (à la différence de `jourEnToutesLettres`, `tableau-de-bord/presentation.ts`,
 * qui ouvre une phrase — deux emplois, deux casses, §9 01/09).
 */
export function libelleJourLong(jour: JourLocal): string {
  const cleJourSemaine = `jour.${jourSemaineIso(jour)}` as CleTraduction;
  const cleMois = `mois.${jour.mois}` as CleTraduction;
  return `${t(cleJourSemaine)} ${jour.jour} ${t(cleMois).toLowerCase()}`;
}

/** « Demain · mercredi 30 septembre » — le titre de la section Demain. */
export function libelleTitreDemain(aujourdHui: JourLocal): string {
  return `${t("terrain.demain")}${t("ponctuation.point_median")}${libelleJourLong(jourSuivant(aujourdHui))}`;
}

/** « Rien d'autre de transmis d'ici mercredi 7 octobre. » — section vide. */
export function libelleJoursSuivantsVide(aujourdHui: JourLocal): string {
  return `${t("terrain.jours_suivants.vide_prefixe")}${libelleJourLong(jourSuivant(aujourdHui, 7))}.`;
}

/** « mer. 30/09 · ven. 02/10 » — les jours distincts de « Les jours suivants ». */
export function libelleDatesSuite(dates: readonly JourLocal[]): string {
  return dates
    .map((jour) => jourEtDateAbregee(instantDuJour(jour), false))
    .join(t("ponctuation.point_median"));
}

/**
 * « Hors connexion — copie du 18/10/2026 08:15, lecture seule » (ou, au-
 * dessus d'une FICHE DE TRAVAIL, « …, saisies gardées sur ce téléphone »,
 * 9F4H6 point 4) — le bandeau réseau (point 5) ET l'en-tête de la
 * consultation sans réseau (point 4) composent le MÊME texte, jamais deux
 * formes du même fait (§9, 01/09).
 *
 * `fiche` distingue les deux : `false` au-dessus d'une LISTE qu'aucun geste
 * ne modifie (`/terrain`, la journée de la coquille), `true` au-dessus d'un
 * compteur/rapport/signature qu'on peut encore saisir hors réseau
 * (`/terrain/[id]`, la fiche de la coquille) — « lecture seule » y serait
 * faux.
 */
export function libelleCopieDu(
  genereLe: string,
  fuseau: Fuseau,
  fiche = false,
): string {
  const instant = new Date(genereLe);
  const local = versLocal(instant, fuseau);
  const date = `${String(local.jour).padStart(2, "0")}/${String(local.mois).padStart(2, "0")}/${local.annee}`;
  const suffixe = fiche
    ? t("terrain.bandeau.suffixe_travail")
    : t("terrain.bandeau.suffixe");
  return `${t("terrain.bandeau.prefixe")} ${date} ${heureLocale(instant, fuseau)}${suffixe}`;
}
