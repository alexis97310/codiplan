import { t } from "@/lib/i18n/fr";

/**
 * « libellé — code » (AGENCE-CODE-1).
 *
 * Le CODE est la clé unique par société (`@@unique([societe_id, code])`) ;
 * le LIBELLÉ ne l'est délibérément pas — deux établissements peuvent porter
 * le même nom d'usage. Mesuré le 22/09/2026 en production : deux agences
 * « DUCOS » y coexistent, et aucun écran ne montrait jamais le code — rien
 * ne les distinguait. Cette composition est la SEULE lecture du couple
 * libellé/code, partagée par tous les écrans où l'on CHOISIT une agence
 * (`components/agences/options.tsx`) et par la liste des établissements
 * (`app/(back-office)/parametres/agences/composants.tsx`) : un même critère
 * lu à deux endroits ne doit jamais devenir deux lectures qui divergent.
 *
 * Le tiret vient de `ponctuation.separateur` — la clé qui « n'appartient à
 * aucun écran », déjà employée par `sites/presentation.ts` pour le même
 * couple étiquette/valeur — jamais un caractère écrit ici.
 */
export function libelleAgenceAvecCode(libelle: string, code: string): string {
  return `${libelle}${t("ponctuation.separateur")}${code}`;
}
