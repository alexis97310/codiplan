import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  forfaitApplicable,
  forfaitRetenu,
  type ConditionsForfait,
  type ConditionsIntervention,
  type ForfaitCandidat,
  type TypeForfait,
} from "@/lib/tarification/forfaits";

/**
 * LE CALCUL N'APPLIQUE QUE LE DÉPLACEMENT — le verdict le dit (PA-18, audit
 * du 28/09/2026).
 *
 * *Aucune lecture neuve, aucun calcul changé.* `lib/interventions/depot.ts`
 * n'appelle `forfaitRetenu` que sur les forfaits `type: "deplacement"` — les
 * trois autres natures (prestation, contrôle, mise en service) n'ont AUCUN
 * consommateur du rang aujourd'hui. Montrer « Retenu » / « Applicable après »
 * / « Écarté » sur ces natures décrirait une sélection que le calcul ne fait
 * pas. Un forfait actif de nature autre que le déplacement rend donc
 * `forfaits.non_applique` — jamais un des trois verdicts, qui restent
 * exacts pour le déplacement seul. Un forfait inactif rend `forfaits.inactif`
 * quelle que soit sa nature : il ne se facture nulle part.
 */
export function verdict(
  type: TypeForfait,
  forfait: ConditionsForfait & { readonly id: string; readonly actif: boolean },
  retenuId: string | null,
  conditions: ConditionsIntervention,
): string {
  if (!forfait.actif) {
    return t("forfaits.inactif");
  }
  if (type !== "deplacement") {
    return t("forfaits.non_applique");
  }
  if (forfait.id === retenuId) {
    return t("forfaits.retenu");
  }
  return forfaitApplicable(forfait, conditions)
    ? t("forfaits.applicable_apres")
    : t("forfaits.ecarte");
}

/**
 * LA ZONE SANS FORFAIT DE DÉPLACEMENT SE DIT (PA-19, audit du 28/09/2026).
 *
 * *La même lecture que la page fait déjà* : `forfaitRetenu` sur les seuls
 * déplacements actifs du catalogue, avec la nature d'intervention nulle —
 * aucun calcul nouveau, aucune requête nouvelle. D11 (docs/arbitrages.md) :
 * sans forfait de déplacement, le déplacement n'est pas facturé — cette
 * fonction ne fait que le DIRE quand c'est le cas, catalogue vide compris.
 *
 * **Limite connue (VERIF PA-18/PA-19)** : la nature d'intervention est
 * toujours nulle ici, comme sur le reste de la page — un forfait de
 * déplacement conditionné PAR nature n'est pas vu par cette lecture.
 */
/** Le tiret cadratin d'une valeur absente — un signe, pas une phrase. */
export const ABSENT = "—";

/** Le libellé d'une zone — au dictionnaire, jamais écrit dans le composant. */
export function libelleZone(zone: string): string {
  const cle = `zone.${zone}`;
  return estCleTraduction(cle) ? t(cle) : zone;
}

/** Le libellé d'une nature de forfait — au dictionnaire également. */
export function libelleType(type: string): string {
  const cle = `type_forfait.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

/**
 * Ce qu'un forfait exige, en clair — l'absence de condition se DIT
 * (DÉPLACÉ depuis `forfaits/page.tsx` par 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE :
 * `/parametres/tarifs` et la fiche `forfaits/[id]` s'en servent désormais
 * toutes les deux — une seconde écriture aurait divergé en silence, §9).
 */
export function resumeConditions(forfait: {
  readonly zone_geo: readonly string[];
  readonly famille_id: string | null;
  readonly type_intervention: readonly string[];
}): string {
  const parts: string[] = [];
  if (forfait.zone_geo.length > 0) {
    parts.push(forfait.zone_geo.map((z) => libelleZone(z)).join(", "));
  }
  if (forfait.famille_id !== null) {
    parts.push(t("forfaits.condition_famille"));
  }
  if (forfait.type_intervention.length > 0) {
    parts.push(forfait.type_intervention.join(", "));
  }
  return parts.length === 0 ? t("forfaits.sans_condition") : parts.join(" · ");
}

export function phraseSansForfaitDeDeplacement(
  catalogue: readonly (ForfaitCandidat & {
    readonly type: string;
    readonly actif: boolean;
  })[],
  zone: string | null,
): "forfaits.sans_deplacement" | null {
  const deplacements = catalogue.filter(
    (f) => f.type === "deplacement" && f.actif,
  );
  const retenu = forfaitRetenu(deplacements, {
    zone,
    familleId: null,
    typeIntervention: null,
  });
  return retenu === null ? "forfaits.sans_deplacement" : null;
}
