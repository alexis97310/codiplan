import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

import { type InterventionDuPortail } from "./depot";

/**
 * CE QUE L'ÉCRAN DES INTERVENTIONS DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX
 * (L0-11) — même rangement que `../presentation.ts` et
 * `../demandes/presentation.ts` : chaque domaine porte la sienne (§6).
 */

const TIRET = "—";

/** « INT-2026-0123 », ou « Numéro provisoire » tant que le serveur ne l'a pas attribué (I10). */
export function identifiantDeLIntervention(
  numero: number | null,
  annee: number | null,
): string {
  return numero === null || annee === null
    ? t("intervention.sans_numero")
    : `INT-${annee}-${String(numero).padStart(4, "0")}`;
}

/** « L'état de vos interventions, telles que votre agence les suit. » */
export function sousTitreDesInterventions(): string {
  return `${t("portail.interventions.sous_titre_avant")} ${motDansUnePhrase("agence")} ${t("portail.interventions.sous_titre_apres")}`;
}

/** « 03/04/2026 », ou « Date à confirmer » tant qu'aucune date n'est posée. */
export function dateDeLIntervention(
  intervention: InterventionDuPortail,
): string {
  return intervention.datePlanifiee === null
    ? t("portail.interventions.sans_date")
    : dateCivile(intervention.datePlanifiee);
}

/** « <référence> », repris au surtitre de la fiche — MÊME texte qu'à la liste. */
export function titreDeLaFicheIntervention(
  intervention: InterventionDuPortail,
): string {
  return `${t("intervention.titre")} ${identifiantDeLIntervention(intervention.numero, intervention.annee)}`;
}

/** « Site : Atelier principal », à partir de la carte des sites déjà lus (`parcDuClient`). */
export function siteDeLIntervention(
  siteId: string,
  libelleParId: ReadonlyMap<string, string>,
): string {
  return `${mot("site")} ${t("ponctuation.deux_points")} ${libelleParId.get(siteId) ?? TIRET}`;
}
