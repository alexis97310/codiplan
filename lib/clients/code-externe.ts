import { t } from "@/lib/i18n";

/**
 * Le LIBELLÉ du code externe, paramétrable par société (D29, ticket L1-01).
 *
 * **Ce que D29 répare.** La colonne s'appelait `code_winpro` : nommer une
 * colonne d'après l'ERP d'un seul client, dans un produit destiné à la vente,
 * est un défaut de conception (CLAUDE.md §9, 19/08). La colonne est devenue
 * `code_externe` — neutre —, et le mot que l'utilisateur LIT est redevenu une
 * donnée : `societe.libelle_code_externe`, « Code Winpro » chez CODIMA, autre
 * chose ailleurs.
 *
 * **Pourquoi ce n'est pas une chaîne du dictionnaire.** Le dictionnaire porte
 * ce que le PRODUIT dit ; ce libellé-ci est ce qu'une SOCIÉTÉ dit. C'est
 * exactement la coupure déjà tenue par la charte (L0-09) : le nom d'une société
 * et ses couleurs sont des données, lues en base, jamais des constantes de
 * compilation. Le dictionnaire ne porte donc que le libellé GÉNÉRIQUE, celui
 * qu'on affiche à une société qui n'a pas dit le sien.
 *
 * **Et l'absence est un état légitime**, comme la charte absente de L0-09 : une
 * société qui vient d'être ouverte n'a pas encore nommé son ERP. Elle ne reçoit
 * pas un « Code Winpro » deviné — elle reçoit le libellé générique.
 */

/** Le libellé à afficher pour `client.code_externe` dans une société donnée. */
export function libelleCodeExterne(
  libelleSociete: string | null | undefined,
): string {
  const propre = libelleSociete?.trim() ?? "";
  return propre.length === 0 ? t("client.code_externe") : propre;
}
