import { type Capacite } from "./habilitations";

import { estCleTraduction, t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * LE LIBELLÉ D'UNE CAPACITÉ DE LA MATRICE (9I9-MON-COMPTE, point 2 —
 * « ses habilitations en lecture »).
 *
 * **Trois capacités ne portent PAS un libellé complet au dictionnaire** :
 * `administrer_agences`, `gerer_client_site`, `consulter_clients_sites`
 * nomment « agence » ou « site », des mots imposés qui ne s'écrivent qu'aux
 * clés `vocabulaire.*` (CLAUDE.md §3, D5, D47,
 * `tests/unit/i18n/vocabulaire-impose.test.ts`). Leur préfixe seul vit au
 * dictionnaire ; le mot se compose ICI, au rendu, avec `motDansUnePhrase` —
 * jamais recopié.
 */
const PREFIXES_SPECIAUX: Partial<Record<Capacite, () => string>> = {
  administrer_agences: () =>
    `${t("capacite.administrer_agences_prefixe")} ${motDansUnePhrase("agence", true)}`,
  gerer_client_site: () =>
    `${t("capacite.gerer_client_site_prefixe")} ${motDansUnePhrase("site")}`,
  consulter_clients_sites: () =>
    `${t("capacite.consulter_clients_sites_prefixe")} ${motDansUnePhrase("site", true)}`,
};

/**
 * Rend le libellé de la capacité, ou la clé elle-même si le dictionnaire ne
 * la porte pas encore — jamais une exception : une capacité ajoutée à la
 * matrice sans son libellé doit rester visible plutôt que de faire planter
 * l'écran, et c'est le gardien `tests/unit/auth/presentation-capacites.
 * test.ts` qui garantit que ce cas n'arrive jamais en pratique.
 */
export function libelleCapacite(capacite: Capacite): string {
  const special = PREFIXES_SPECIAUX[capacite];
  if (special !== undefined) {
    return special();
  }
  const cle = `capacite.${capacite}`;
  return estCleTraduction(cle) ? t(cle) : cle;
}
