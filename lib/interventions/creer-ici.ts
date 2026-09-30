import { cleJour, lireCleJour, type JourLocal } from "@/lib/calendar/fuseau";

/**
 * « + CRÉER ICI » (PG-D5-CREER-ICI) — LA CASE VOYAGE DANS L'URL, JAMAIS DANS
 * UNE ÉCRITURE.
 *
 * Un clic sur une case vide du planning propose un lien vers
 * `/interventions/nouvelle`, avec le technicien, le jour et (en vue Jour)
 * l'heure de la case en paramètres `poser_*`. La création elle-même reste
 * PARCOURS-1 intacte (arbitrage d'Alexis du 23/09/2026) : ces paramètres ne
 * préremplissent JAMAIS `schemaCreation` — ils ne servent qu'à préremplir la
 * fenêtre de pose une fois l'intervention créée (`TrouverCreneau`, sur la
 * fiche).
 */

/** Ce qu'une case du planning porte, une fois lue depuis l'URL. */
export type CaseDePlanning = {
  readonly technicienId: string;
  readonly jour: JourLocal;
  /** `null` — pas d'heure connue (vue Semaine, ou vue Jour sans pas). */
  readonly minutes: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * L'URL DE CRÉATION DEPUIS UNE CASE — `poser_technicien`, `poser_date` et,
 * seulement si l'heure est connue, `poser_heure` (minutes locales depuis
 * minuit, la forme de `data-depot-heure`).
 */
export function hrefCreerIci(caseDePlanning: CaseDePlanning): string {
  const parametres = new URLSearchParams();
  parametres.set("poser_technicien", caseDePlanning.technicienId);
  parametres.set("poser_date", cleJour(caseDePlanning.jour));
  if (caseDePlanning.minutes !== null) {
    parametres.set("poser_heure", String(caseDePlanning.minutes));
  }
  return `/interventions/nouvelle?${parametres.toString()}`;
}

/**
 * LE JOUR `poser_date`, VALIDÉ CONTRE LE CALENDRIER RÉEL — `lireCleJour` ne
 * refuse que la FORME (`AAAA-MM-JJ`), jamais une date qui n'existe pas
 * (« 2026-02-31 » s'y lit sans erreur). Le passage par `Date.UTC` et sa
 * relecture EXACTE est ce qui refuse le 31 février : `Date.UTC` déborde
 * silencieusement sur le 3 mars, et cette relecture le détecte.
 */
function jourValide(cle: string): JourLocal | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cle)) {
    return null;
  }
  let jour: JourLocal;
  try {
    jour = lireCleJour(cle);
  } catch {
    return null;
  }
  const reconstruit = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
  const valide =
    reconstruit.getUTCFullYear() === jour.annee &&
    reconstruit.getUTCMonth() === jour.mois - 1 &&
    reconstruit.getUTCDate() === jour.jour;
  return valide ? jour : null;
}

/** L'entier de `poser_heure` — 0 à 1439 (minutes d'un jour), sinon `null`. */
function minutesValides(valeur: string | undefined): number | null {
  if (valeur === undefined || valeur.trim() === "") {
    return null;
  }
  if (!/^\d{1,4}$/.test(valeur.trim())) {
    return null;
  }
  const entier = Number.parseInt(valeur, 10);
  return entier >= 0 && entier <= 1439 ? entier : null;
}

/**
 * LA CASE, LUE DEPUIS LES PARAMÈTRES DE L'URL (`searchParams` ou un objet
 * converti) — `null` sans technicien UUID valide ou sans date réelle
 * (L1-02f, un paramètre d'URL vient de l'extérieur). Un tableau ou une
 * chaîne vide sont ignorés comme une valeur absente, jamais une erreur.
 */
export function caseDepuisParametres(
  parametres: Readonly<Record<string, string | readonly string[] | undefined>>,
): CaseDePlanning | null {
  const technicienId = parametres.poser_technicien;
  const date = parametres.poser_date;
  if (typeof technicienId !== "string" || !UUID_RE.test(technicienId)) {
    return null;
  }
  if (typeof date !== "string") {
    return null;
  }
  const jour = jourValide(date);
  if (jour === null) {
    return null;
  }
  const heure = parametres.poser_heure;
  return {
    technicienId,
    jour,
    minutes: minutesValides(typeof heure === "string" ? heure : undefined),
  };
}

/**
 * LES PAIRES `poser_*` D'UNE CASE — le pendant de `caseDepuisParametres`,
 * pour une redirection (`versLaFicheApresCreation`) ou un retour de
 * formulaire (`versLeFormulaire`). Sans case, AUCUN paramètre : la
 * redirection reste exactement `?cree=1`, comme avant ce ticket.
 */
export function parametresDeLaCase(
  caseDePlanning: CaseDePlanning | null,
): Readonly<Record<string, string>> {
  if (caseDePlanning === null) {
    return {};
  }
  const parametres: Record<string, string> = {
    poser_technicien: caseDePlanning.technicienId,
    poser_date: cleJour(caseDePlanning.jour),
  };
  if (caseDePlanning.minutes !== null) {
    parametres.poser_heure = String(caseDePlanning.minutes);
  }
  return parametres;
}
