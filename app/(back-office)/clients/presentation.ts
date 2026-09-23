import { libelleCodeExterne } from "@/lib/clients/code-externe";
import type { SitesDUnClient } from "@/lib/clients/depot";
import { t } from "@/lib/i18n/fr";

import { ouTiret } from "../presentation";

/**
 * CE QUE LES ÉCRANS « CLIENTS » COMPOSENT (14/09/2026).
 *
 * Module sans JSX, pour la raison de `sites/presentation.ts` : le gardien des
 * chaînes visibles (L0-11) scanne un fichier qui porte du JSX **en entier**, et
 * un gabarit qui assemble deux clés du dictionnaire y passerait pour du texte
 * en dur. *Le gardien a raison de ne pas savoir — c'est la DESTINATION d'un
 * texte qui décide, et il ne peut pas la lire.*
 */

/**
 * « Sans Code Winpro » — le titre du seul compteur de la liste.
 *
 * **Le mot « Winpro » n'est écrit nulle part** : le libellé du code de
 * rapprochement est une DONNÉE de la société (D29), lue en base, et le
 * dictionnaire ne porte que le libellé générique pour celle qui n'a pas nommé
 * son ERP. *Nommer une colonne — ou un compteur — d'après l'outil d'un seul
 * client est le défaut du 19/08 ; le produit est destiné à la vente.*
 */
export function titreSansCode(
  libelleSociete: string | null | undefined,
): string {
  return `${t("clients.sans_code_titre")} ${libelleCodeExterne(libelleSociete)}`;
}

/**
 * LA PREMIÈRE LIGNE DE LA CARTE — le code de rapprochement, puis la commune
 * (D123, N-08) : le pendant de « CLI-000184 · Nouméa » sur `entity-card`, au
 * POINT MÉDIAN mesuré sur cette carte — jamais le tiret cadratin générique
 * de `ponctuation.separateur` (voir sa propre note dans `lib/i18n/fr.ts`).
 *
 * **Un code ABSENT ne laisse jamais un séparateur orphelin.** *Mesuré à
 * l'écran le 18/09/2026* : `codeEtCommune(null, {communes:["Koné"], …})`
 * rendait `— · Koné` — le tiret de `ouTiret(null)` suivi du point médian,
 * qui se lit comme une panne d'affichage plutôt que comme une absence. La
 * commune, quand elle existe, se suffit alors à elle-même ; le tiret ne
 * paraît que si LES DEUX manquent — c'est la seule ligne qui aurait sinon
 * disparu complètement.
 *
 * **Une seule commune**, jamais la liste : `sitesParClient` les rend déjà
 * TRIÉES, et la bande de compteurs de la carte dit combien de lieux existent
 * — cette ligne-ci ne fait que SITUER le client, pas les compter une seconde
 * fois (D123 : deux projections d'une même donnée, jamais deux écritures du
 * même compte).
 */
export function codeEtCommune(
  codeExterne: string | null,
  sites: SitesDUnClient | undefined,
): string {
  const commune = sites?.communes[0];
  if (codeExterne === null) {
    return commune ?? ouTiret(null);
  }
  return commune === undefined
    ? codeExterne
    : `${codeExterne}${t("ponctuation.point_median")}${commune}`;
}

/**
 * LA SECONDE LIGNE DE LA CARTE — le commercial référent, labellisé (D123).
 *
 * **`null` plutôt qu'une ligne « — »** : un référent absent est fréquent
 * (D29 le dit déjà du code de rapprochement), et une carte n'a pas de
 * colonne à tenir alignée comme un tableau — l'absence s'omet, elle ne
 * s'écrit pas en tiret (contrairement à `ouTiret`, réservé à une VALEUR dans
 * une ligne qui existe déjà).
 */
export function referentClient(
  commercialReferent: string | null,
): string | null {
  if (commercialReferent === null) {
    return null;
  }
  return `${t("client.commercial_referent")}${t("ponctuation.separateur")}${commercialReferent}`;
}

/** Le compteur de lieux d'intervention de la bande `entity-meta` (D123). */
export function compteurSites(sites: SitesDUnClient | undefined): {
  readonly valeur: number;
  readonly libelle: string;
} {
  const nombre = sites?.nombre ?? 0;
  return {
    valeur: nombre,
    libelle:
      nombre === 1 ? t("clients.sites_un") : t("clients.sites_plusieurs"),
  };
}

/**
 * LE COMPTEUR D'ÉQUIPEMENTS DE LA CARTE (LISTES-1, 23/09/2026) — *« page
 * clients : même remarques que pour la liste sites »*, et la liste des sites
 * demandait le nombre d'équipements enregistrés. Compte TOUT équipement,
 * quel que soit son statut — la même notion, au mot près, que celle qui
 * filtre la liste par défaut (`equipementsParClient`, `lib/clients/depot.ts`).
 */
export function compteurEquipements(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("clients.equipements_un")
        : t("clients.equipements_plusieurs"),
  };
}
