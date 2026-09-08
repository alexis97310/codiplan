import { z } from "zod";

import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

/**
 * LE CATALOGUE DE FORFAITS, ET LA RÈGLE QUI DÉCIDE (ticket L1-06, RG-TAR-06).
 *
 * ## RG-TAR-06, mot pour mot
 *
 * *« Un forfait ne s'applique que si ses conditions sont remplies — zone,
 * famille de matériel, type d'intervention. »*
 *
 * Trois axes, et **l'absence de condition sur un axe n'est pas une condition
 * qui échoue** : un forfait sans zone s'applique partout. C'est le cas le plus
 * courant, et le confondre avec « aucune zone ne convient » retirerait du
 * catalogue tous les forfaits généraux.
 *
 * ## CE QUI EST INERTE, ET POURQUOI C'EST ÉCRIT PLUTÔT QUE TU
 *
 * **Le troisième axe ne décide rien aujourd'hui.** Les types d'intervention
 * n'existent nulle part dans ce dépôt — ni énumération, ni liste close, ni
 * table —, et le lot 2 les décidera. Un forfait peut donc porter des valeurs
 * que rien ne valide, et une intervention n'a pas de type à leur opposer.
 *
 * C'est la forme de D63 sur les durées de validité : *ce n'est pas un défaut du
 * code — le code est juste, la donnée n'existe pas.* Et c'est ce qui le rend
 * dangereux : la règle se lira comme entière, les scénarios seront verts, et
 * personne ne s'apercevra qu'un tiers dort. **Le rendez-vous est le lot 2.**
 *
 * ## Ce que ce module ne fait pas
 *
 * Il **ne valorise rien**. Ce qu'un forfait consomme du temps passé — à partir
 * de quand une heure devient « excédentaire » — n'est tranché nulle part.
 * RG-TAR-05 donne l'ORDRE du calcul, jamais la composition. C'est au registre.
 */

/** Les natures de forfait, telles que la base les énumère. */
export const TYPES_FORFAIT = [
  "deplacement",
  "mise_en_service",
  "controle",
  "prestation",
] as const;

export type TypeForfait = (typeof TYPES_FORFAIT)[number];

/** Un ensemble non vide et sans doublon, ou l'absence de condition. */
function conditionSur<T extends readonly [string, ...string[]]>(valeurs: T) {
  return z
    .array(z.enum(valeurs))
    .nonempty()
    .refine((liste) => new Set(liste).size === liste.length, {
      message: "Un doublon dans une condition ne dit rien de plus.",
    })
    .nullable()
    .default(null);
}

export const schemaForfait = z.object({
  code: z.string().trim().min(1),
  libelle: z.string().trim().min(1),
  type: z.enum(TYPES_FORFAIT),

  /**
   * Le montant, en unités les plus fines de la devise de la société. **Zéro est
   * permis** : une prestation offerte est un forfait à zéro, et c'est la façon
   * de la dire. Négatif, non — ce serait un avoir, qui n'est pas un forfait.
   */
  montant_mineur: z.number().int().nonnegative(),

  /** EN MINUTES : RG-TAR-05 arrondit au quart d'heure, D57 le tranche. */
  heures_incluses_minutes: z.number().int().positive().nullable().default(null),

  /**
   * La liste des zones est close ICI et pas en base — six valeurs d'UN
   * territoire, exactement comme `site.zone_geo` : l'ajout d'une zone ne doit
   * pas être une migration.
   */
  zone_geo: conditionSur(ZONES_GEOGRAPHIQUES),
  famille_id: z.uuid().nullable().default(null),
  /**
   * **Aucune liste close ne peut être opposée ici** : les types d'intervention
   * n'existent pas encore. Les valeurs sont donc contrôlées dans leur FORME —
   * non vides, sans doublon — et pas dans leur contenu, ce qui est dit plutôt
   * que dissimulé derrière un `z.string()` anodin.
   */
  type_intervention: z
    .array(z.string().trim().min(1))
    .nonempty()
    .refine((liste) => new Set(liste).size === liste.length)
    .nullable()
    .default(null),

  cumulable_temps: z.boolean(),
  actif: z.boolean().default(true),
});

export type SaisieForfait = z.infer<typeof schemaForfait>;

/** Le contexte d'une intervention, tel que RG-TAR-06 l'interroge. */
export type ConditionsIntervention = {
  readonly zone: string | null;
  readonly familleId: string | null;
  /** `null` tant que le lot 2 n'a pas décidé des types. */
  readonly typeIntervention: string | null;
};

/** Ce qu'un forfait porte comme conditions, une fois lu. */
export type ConditionsForfait = {
  readonly zone_geo: readonly string[] | null;
  readonly famille_id: string | null;
  readonly type_intervention: readonly string[] | null;
};

/**
 * Un axe est satisfait quand le forfait n'y met **aucune** condition, ou quand
 * la valeur de l'intervention figure dans la liste.
 *
 * Une valeur d'intervention absente (`null`) face à une condition posée **ne
 * satisfait pas** : on ne suppose pas ce qu'on ne sait pas. C'est le sens de
 * RG-TAR-06 — *le forfait ne s'applique QUE SI ses conditions sont remplies*, et
 * une condition qu'on ne peut pas vérifier n'est pas remplie.
 */
function axeSatisfait(
  condition: readonly string[] | null,
  valeur: string | null,
): boolean {
  if (condition === null) {
    return true;
  }
  return valeur !== null && condition.includes(valeur);
}

/**
 * RG-TAR-06 — le forfait s'applique-t-il à cette intervention ?
 *
 * Les trois axes sont conjoints : un seul non satisfait suffit à écarter le
 * forfait. La fonction ne dit **pas** lequel — c'est une décision d'affichage,
 * pas une règle, et le ticket ne la demande pas.
 */
export function forfaitApplicable(
  forfait: ConditionsForfait,
  intervention: ConditionsIntervention,
): boolean {
  return (
    axeSatisfait(forfait.zone_geo, intervention.zone) &&
    axeSatisfait(
      forfait.famille_id === null ? null : [forfait.famille_id],
      intervention.familleId,
    ) &&
    axeSatisfait(forfait.type_intervention, intervention.typeIntervention)
  );
}
