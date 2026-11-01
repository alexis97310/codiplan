import {
  comparerJours,
  dateCivile,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import type { DatesMachine, DonneesMateriel } from "./depot";

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
export function libelleMaterielComplet(
  materiel: Pick<
    DonneesMateriel,
    "familleLibelle" | "marque" | "reference" | "numeroSerie"
  >,
): string {
  return `${materiel.familleLibelle} ${materiel.marque} ${materiel.reference} ${t("machine.numero_serie_abrege")} ${materiel.numeroSerie}`;
}

/**
 * L'ÉTAT DE GARANTIE D'UNE MACHINE, JUGÉ À UN JOUR DE RÉFÉRENCE (9I8C) —
 * tuile Machine de la fiche intervention, du bon, et fiche terrain.
 *
 * `garantieFin` est une colonne `@db.Date` : un jour civil, et seul un jour
 * civil se compare à un autre sans dérive de fuseau (même lecture que
 * `lib/interventions/retard.ts`). `jourReference` est donc déjà résolu par
 * l'appelant, qui seul connaît le fuseau de l'agence — cette fonction, pure,
 * ne lit jamais l'horloge (gardien `tests/unit/calendar/
 * sans-date-courante-implicite.test.ts`).
 */
export type EtatGarantieMachine =
  | { readonly etat: "non_renseignee" }
  | { readonly etat: "sous_garantie"; readonly garantieFin: Date }
  | { readonly etat: "hors_garantie"; readonly garantieFin: Date };

export function etatGarantieMachine(
  garantieFin: Date | null,
  jourReference: JourLocal,
): EtatGarantieMachine {
  if (garantieFin === null) {
    return { etat: "non_renseignee" };
  }
  const jourGarantie: JourLocal = {
    annee: garantieFin.getUTCFullYear(),
    mois: garantieFin.getUTCMonth() + 1,
    jour: garantieFin.getUTCDate(),
  };
  return comparerJours(jourGarantie, jourReference) >= 0
    ? { etat: "sous_garantie", garantieFin }
    : { etat: "hors_garantie", garantieFin };
}

export function libelleEtatGarantieMachine(etat: EtatGarantieMachine): string {
  switch (etat.etat) {
    case "non_renseignee":
      return t("machine.garantie.non_renseignee");
    case "sous_garantie":
      return `${t("machine.garantie.sous_garantie_jusquau")} ${dateCivile(etat.garantieFin)}`;
    case "hors_garantie":
      return `${t("machine.garantie.hors_garantie_depuis")} ${dateCivile(etat.garantieFin)}`;
  }
}

/** Une ligne « libellé : valeur », pour une tuile de type fiche (KV). */
export type LigneDetailMachine = {
  readonly libelle: string;
  readonly valeur: string;
};

/**
 * LES LIGNES DE DÉTAIL D'UNE MACHINE (9I8C) — année de fabrication, date de
 * vente, date de mise en service, garantie. **Aucune ligne pour une donnée
 * absente**, sauf la garantie, qui porte toujours une réponse (« non
 * renseignée » en est une) — partagée par la tuile Machine de la fiche
 * intervention et par le bon, pour que les deux ne divergent jamais (§9,
 * 01/09).
 */
export function lignesDetailMachine(
  dates: DatesMachine,
  jourReference: JourLocal,
): readonly LigneDetailMachine[] {
  const lignes: LigneDetailMachine[] = [];
  if (dates.anneeFabrication !== null) {
    lignes.push({
      libelle: t("machine.champ.annee_fabrication"),
      valeur: String(dates.anneeFabrication),
    });
  }
  if (dates.dateVente !== null) {
    lignes.push({
      libelle: t("machine.champ.date_vente"),
      valeur: dateCivile(dates.dateVente),
    });
  }
  if (dates.dateMiseEnService !== null) {
    lignes.push({
      libelle: t("machine.champ.date_mise_en_service"),
      valeur: dateCivile(dates.dateMiseEnService),
    });
  }
  lignes.push({
    libelle: t("machine.garantie.libelle"),
    valeur: libelleEtatGarantieMachine(
      etatGarantieMachine(dates.garantieFin, jourReference),
    ),
  });
  return lignes;
}
