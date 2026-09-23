import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * CE QU'UNE CARTE DE PLANNING DIT EN PLUS DE L'HEURE ET DU CLIENT (PLANNING-2).
 *
 * *Mesuré le 23/09/2026 en production : une carte se lisait « SIDAPS /
 * Curatif », sans heure saisie — deux interventions du même jour chez le même
 * client étaient indiscernables, et rien ne disait le SITE ni la DURÉE.*
 *
 * Séparé de `page.tsx` pour que ces deux fonctions PURES s'éprouvent seules
 * (`tests/unit/planning/carte.test.ts`), sans lever de contexte cloisonné.
 */

/** Le libellé du site — même convention que `lieuDeLaLigne` (page.tsx). */
export function siteDeLaCarte(site: { readonly libelle: string }): string {
  return `${mot("site")} ${site.libelle}`;
}

/**
 * LA DURÉE D'UNE CARTE — « 1 h 30 », jamais un zéro.
 *
 * **`null` pour une durée inconnue ou nulle** — l'écran ne l'affiche alors pas
 * du tout : un zéro écrit se lirait comme une mesure, et il n'y en a pas à
 * faire (l'alerte « sans durée saisie » existe déjà dans le panneau de charge,
 * cette carte ne la duplique pas).
 */
export function dureeCarteAffichee(minutes: number): string | null {
  if (minutes <= 0) {
    return null;
  }
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) {
    return `${reste} ${t("terrain.minutes")}`;
  }
  return `${heures} ${t("terrain.heures")} ${String(reste).padStart(2, "0")}`;
}
