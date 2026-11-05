import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * CE QUE L'ÉCRAN DES DEMANDES DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11).
 *
 * Même rangement que `app/(portail)/portail/presentation.ts` et
 * `app/(portail)/portail/contacts/presentation.ts`.
 */

/** « Les demandes que vous transmettez à votre agence et la suite qu'elle leur donne. » */
export function sousTitreDesDemandes(): string {
  return `${t("portail.demandes.sous_titre_avant")} ${motDansUnePhrase("agence")} ${t("portail.demandes.sous_titre_apres")}`;
}

/**
 * « DEM-2026-0029 », ou « Numéro provisoire » tant que le serveur ne l'a pas
 * attribué — même forme que `surtitreFiche`
 * (`app/(back-office)/demandes/presentation.ts`), écrite ici plutôt
 * qu'importée (§6, chaque domaine porte la sienne).
 */
export function identifiantDeLaDemande(
  numero: number | null,
  annee: number | null,
): string {
  return numero === null || annee === null
    ? t("demande.sans_numero")
    : `DEM-${annee}-${String(numero).padStart(4, "0")}`;
}

/** « JJ/MM/AAAA » LOCAL — même forme que `dateCourteLocale` (tableau de bord, L0-08). */
export function dateCourteLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}
