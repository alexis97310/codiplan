import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

/**
 * LE STATUT DE CHAQUE LIGNE D'HISTORIQUE — « Remplacé le ... » pour un
 * ancien taux (PA-11, audit du 28/09/2026).
 *
 * **Aucune lecture neuve de « quel taux s'applique ».** `enVigueurDepuis`
 * vient déjà de `tauxEnVigueur` (`lib/tarification/taux-horaire.ts`), la même
 * fonction que la fiche d'intervention ; cette fonction ne fait que DÉRIVER,
 * depuis l'ordre `date_effet desc` que la page lit déjà, la date à laquelle
 * chaque ligne plus ancienne a été remplacée — celle de la ligne qui la
 * précède dans la liste. Une ligne future (`date_effet` postérieure à
 * `enVigueurDepuis`) ne porte aucun statut : ce n'est ni « en vigueur », ni
 * « remplacée », et inventer un troisième statut n'est pas le lot (PA-11 —
 * « À partir du ... » — reste hors lot).
 */
export function statutDuTaux(
  lignes: readonly { readonly date_effet: Date }[],
  enVigueurDepuis: number | null,
): readonly (string | null)[] {
  return lignes.map((ligne, index) => {
    if (enVigueurDepuis === null) {
      return null;
    }
    if (ligne.date_effet.getTime() === enVigueurDepuis) {
      return t("taux_horaire.en_vigueur");
    }
    const precedente = lignes[index - 1];
    if (
      ligne.date_effet.getTime() > enVigueurDepuis ||
      precedente === undefined
    ) {
      return null;
    }
    return `${t("taux_horaire.remplace_le")} ${dateCivile(precedente.date_effet)}`;
  });
}
