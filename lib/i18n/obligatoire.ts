import { t } from "@/lib/i18n/fr";

/**
 * Un libellé de champ, marqué obligatoire — Site, Nature, la panne signalée,
 * ou un champ de la fiche machine (GR16i, 27/09/2026 : DÉCISION D'ALEXIS —
 * « (obligatoire) » partout, jamais un astérisque, même forme que la
 * création d'intervention). Déplacée ici depuis
 * `app/(back-office)/interventions/presentation.ts`, sans changer son texte
 * ni sa sortie, pour servir aussi la fiche machine.
 */
export function libelleChampObligatoire(libelleChamp: string): string {
  return `${libelleChamp} ${t("intervention.creation.obligatoire_suffixe")}`;
}
