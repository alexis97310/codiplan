import { enDuree } from "@/lib/calendar/duree";
import { t } from "@/lib/i18n/fr";

import { decompte } from "../../presentation";

/**
 * UNE DURÉE, HEURES PUIS MINUTES ENTRE PARENTHÈSES — MAIS SEULEMENT À PARTIR
 * DE L'HEURE (correctif PA-24, audit du 28/09/2026).
 *
 * *Mesuré fautif sur `main` :* « 30 min (30 minutes) » sous l'heure — les
 * deux formes disent exactement la même chose, une seule en minutes.
 * `enDuree` EST déjà la durée en minutes sous l'heure (« 30 min ») ; la
 * parenthèse n'ajoute quelque chose que lorsqu'elle convertit un nombre
 * d'heures vers ses minutes, à partir de 60.
 */
export function duree(minutes: number): string {
  if (minutes < 60) {
    return enDuree(minutes);
  }
  return `${enDuree(minutes)} (${decompte(minutes, t("trajets.minute_une"), t("trajets.minutes"))})`;
}
