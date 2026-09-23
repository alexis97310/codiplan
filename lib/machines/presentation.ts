import { t } from "@/lib/i18n/fr";
import type { DonneesMateriel } from "./depot";

/**
 * LE LIBELLÉ COMPLET D'UN MATÉRIEL — famille, marque, référence, numéro de
 * série (AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * *Mesuré le 23/09/2026 : « il manque la famille sur la page intervention »,
 * et une carte de planning ne disait aucun matériel.* Alexis nomme le format
 * exact : « Pont 2 colonnes Cascos 13442 S/N 10044 » — famille, marque,
 * référence, puis le numéro de série derrière son abréviation.
 *
 * Une seule composition pour les deux écrans qui en ont besoin (la fiche
 * intervention et la carte de planning) : deux lectures du même critère
 * divergeraient en silence (§9, 01/09).
 */
export function libelleMaterielComplet(materiel: DonneesMateriel): string {
  return `${materiel.familleLibelle} ${materiel.marque} ${materiel.reference} ${t("machine.numero_serie_abrege")} ${materiel.numeroSerie}`;
}
