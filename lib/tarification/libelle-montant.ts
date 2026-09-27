import { t } from "@/lib/i18n/fr";
import { montant, type Devise } from "@/lib/money";
import { formatMoney } from "@/lib/money/format";

/**
 * LE LIBELLÉ DU CHAMP « MONTANT », SELON LA DEVISE (audit GR du 26/09, M2).
 *
 * Les deux formulaires de saisie d'un montant — forfait, taux horaire —
 * disaient « Montant, en unités mineures » quelle que soit la devise : juste
 * en XPF, où l'unité mineure EST l'unité (I3), et faux en apparence pour une
 * devise à décimales, où « unités mineures » ne dit ni combien ni comment.
 *
 * **La saisie ne change pas** : un entier d'unités mineures, toujours (I3).
 * Seul le libellé s'adapte, et l'exemple chiffré d'une devise à décimales
 * sort de `formatMoney` — le point de passage unique (I3) — plutôt que d'être
 * écrit ici.
 */
const MONTANT_EXEMPLE = 1250;

export function libelleDuMontant(devise: Devise): string {
  if (devise.decimales === 0) {
    return `${t("tarification.montant_prefixe")}${devise.code}${t("tarification.montant_suffixe")}`;
  }
  return `${t("tarification.montant_exemple_centimes")}${formatMoney(montant(MONTANT_EXEMPLE, devise.code), devise)}`;
}
