import { libelleCodeExterne } from "@/lib/clients/code-externe";
import type { SitesDUnClient } from "@/lib/clients/depot";
import { t } from "@/lib/i18n/fr";

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

/** Combien de lieux d'intervention sont nommés à côté du compte, au plus. */
const COMMUNES_MONTREES = 3;

/**
 * LA COLONNE « LIEUX D'INTERVENTION » — un compte, puis les communes.
 *
 * *« Elle dit où l'on intervient chez ce client, et c'est la question qu'on se
 * pose en ouvrant la liste. »*
 *
 * **Zéro lieu s'ÉCRIT plutôt que de laisser une case vide** : une case vide se
 * lit « on n'a pas rempli », un « aucun lieu » se lit « il n'y en a pas », et
 * les deux ne se corrigent pas au même endroit (D88).
 *
 * **Les communes sont BORNÉES et la troncature se voit** : une fiche qui en
 * porte trente ferait une ligne de tableau haute comme la page, et une liste
 * coupée sans marque ferait croire qu'il n'y en a que trois.
 */
export function resumeDesSites(sites: SitesDUnClient | undefined): string {
  if (sites === undefined || sites.nombre === 0) {
    return t("clients.sites_aucun");
  }
  const unite =
    sites.nombre === 1 ? t("clients.sites_un") : t("clients.sites_plusieurs");
  const compte = `${sites.nombre} ${unite}`;
  if (sites.communes.length === 0) {
    return compte;
  }
  const montrees = sites.communes.slice(0, COMMUNES_MONTREES).join(", ");
  const reste =
    sites.communes.length > COMMUNES_MONTREES
      ? t("clients.sites_et_autres")
      : "";
  return `${compte}${t("ponctuation.separateur")}${montrees}${reste}`;
}
