import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * CE QUE L'ÉCRAN DES CONTACTS DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11).
 *
 * Même rangement que `app/(portail)/portail/presentation.ts` : la ponctuation
 * de liaison est du texte qu'un humain lit, donc jamais écrite entre deux
 * accolades dans une page.
 */

/** « Les personnes que votre agence peut joindre pour vos interventions… » */
export function sousTitreDesContacts(): string {
  return `${t("portail.contacts.sous_titre_avant")} ${motDansUnePhrase("agence")} ${t("portail.contacts.sous_titre_apres")}`;
}
