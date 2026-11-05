import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

import type { MachineDuPortail, SiteDuPortail } from "@/lib/portail/depot";

import { libelleDuSite } from "../presentation";

/**
 * CE QUE LA FICHE MACHINE DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11) —
 * même raison que `../presentation.ts`, dont ce module réutilise
 * `libelleDuSite` plutôt que de la recomposer.
 */

const TIRET = "—";
const DEUX_POINTS = ":";

/** « Numéro de série 123456 » — LE MÊME texte que la carte de la liste. */
export function titreDeLaFicheMachine(machine: MachineDuPortail): string {
  return `${t("portail.machine.serie")} ${machine.numeroSerie}`;
}

/** « Site : Atelier principal — Nouméa ». */
export function siteDeLaFiche(site: SiteDuPortail): string {
  return `${mot("site")} ${DEUX_POINTS} ${libelleDuSite(site)}`;
}

/** « État : En panne ». */
export function etatDeLaFiche(machine: MachineDuPortail): string {
  return `${t("portail.machine.statut")} ${DEUX_POINTS} ${t(`statut_machine.${machine.statut}`)}`;
}

/** « Mise en service : 03/04/2023 », ou « — » quand la date n'est pas connue. */
export function miseEnServiceDeLaFiche(machine: MachineDuPortail): string {
  const date =
    machine.dateMiseEnService === null
      ? TIRET
      : dateCivile(machine.dateMiseEnService);
  return `${t("portail.machine.mise_en_service")} ${DEUX_POINTS} ${date}`;
}

/** « Client : <raison sociale> », absente quand la raison sociale ne l'est pas. */
export function clientDeLaFiche(raisonSociale: string | null): string | null {
  return raisonSociale === null
    ? null
    : `${t("portail.client")} ${DEUX_POINTS} ${raisonSociale}`;
}
