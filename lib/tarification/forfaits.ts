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

/**
 * UN FORFAIT S'AJOUTE TOUJOURS AUX HEURES (arbitrage du 09/09/2026, Q4).
 *
 * *Un forfait est un montant fixe qui vient EN PLUS du temps passé.* Il
 * n'absorbe jamais d'heures ; **la notion d'heure excédentaire ne s'applique pas
 * aux forfaits.** C'est ce qui manquait à RG-TAR-05, qui donne l'ordre du calcul
 * sans dire ce qu'un forfait consomme du temps.
 *
 * **Conséquence : `heures_incluses_minutes` a été RETIRÉE.** Elle avait été
 * posée à L1-06 sans consommateur, en attendant cette décision ; le cas qu'elle
 * modélisait n'existe pas. *Une colonne qui modélise un cas qui n'existe pas est
 * pire qu'une colonne absente* — quelqu'un finirait par « l'implémenter », et
 * il implémenterait une règle que personne n'a décidée.
 *
 * **La réciproque, écrite parce qu'elle sera un jour invoquée :** si une société
 * a un jour besoin qu'un forfait inclue du temps, ce sera un besoin réel avec un
 * cas réel derrière — un contrat, un client, un devis à honorer —, jamais
 * « la colonne existait déjà ».
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
   * L'ORDRE D'APPLICATION, explicite et saisi (D86). Sans défaut : *le rang
   * est une décision de tarification*, et une valeur par défaut serait une
   * décision prise par personne — c'est le §9 du 24/08 sur les actions
   * référentielles, appliqué à un nombre. Strictement positif, pour que « 1 »
   * se lise « le premier ».
   */
  rang: z.number().int().positive(),

  /**
   * Le montant, en unités les plus fines de la devise de la société. **Zéro est
   * permis** : une prestation offerte est un forfait à zéro, et c'est la façon
   * de la dire. Négatif, non — ce serait un avoir, qui n'est pas un forfait.
   */
  montant_mineur: z.number().int().nonnegative(),

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
 *
 * **« Aucune condition » a DEUX écritures, et c'est mesuré plutôt que supposé**
 * *(09/09/2026)*. La saisie Zod l'écrit `null` ; la BASE ne le peut pas — une
 * liste scalaire PostgreSQL n'est pas nullable, Prisma rend toujours un
 * `String[]`, et l'absence de condition y est donc le tableau **VIDE**. Cette
 * fonction ne voyait que la première : `[]` tombait dans la branche « une
 * condition est posée », `[].includes(zone)` rendait `false`, et **le forfait
 * général — celui qui n'a aucune condition de zone, c'est-à-dire le cas que ce
 * module documente comme le plus courant — ne s'appliquait JAMAIS** par le
 * chemin de production. Mesuré avant d'être corrigé, sur `forfaitApplicable`
 * appelée avec la forme que Prisma rend.
 *
 * *C'est la frontière du §9 (08/09) : deux formes d'un même fait, dont une
 * seule était lue — et le SQL, lui, n'en laissait rien voir.* La saisie
 * refusant `[]` (`nonempty`), le vide en base ne peut vouloir dire qu'une
 * chose, et les deux écritures se lisent ici **au même endroit**.
 */
function axeSatisfait(
  condition: readonly string[] | null,
  valeur: string | null,
): boolean {
  if (condition === null || condition.length === 0) {
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

/**
 * LE RANG — ce qui décide QUEL forfait l'emporte quand plusieurs s'appliquent
 * *(arbitrage D86, 09/09/2026)*.
 *
 * **« Le premier applicable l'emporte » ne définissait pas « premier ».** La
 * lecture ordonnait par `code`, ce qui est un ordre d'ALPHABET ; avant cela
 * c'eût été l'ordre d'insertion, qui est un ordre de PASSÉ. Dans les deux cas,
 * *deux interventions identiques se factureraient différemment selon un fait
 * sans rapport avec le tarif* — la casse d'un code, ou la minute où quelqu'un a
 * saisi une ligne six mois plus tôt. **Un tarif qui dépend de cela ne se défend
 * pas devant un client.**
 *
 * Le rang est donc **explicite, stocké, modifiable** — une colonne que
 * l'exploitation règle, jamais une propriété dérivée. **Le plus petit rang
 * l'emporte** : on lit « rang 1 » comme « le premier », et un forfait plus
 * spécifique s'insère devant sans renuméroter ce qui le suit.
 *
 * **L'ÉGALITÉ DE RANG EST UN ÉTAT INTERDIT, et c'est la BASE qui le refuse** —
 * `@@unique([societe_id, type, rang])`. Deux raisons de préférer le refus au
 * signalement : un contrôle qui signale laisse la facture partir, et *le rang
 * ne se compare qu'entre forfaits de MÊME NATURE* — un déplacement n'est jamais
 * en concurrence avec une prestation, et exiger un rang unique sur tout le
 * catalogue obligerait à renuméroter des lignes sans rapport.
 *
 * **Ce que la base NE sait PAS refuser, et pourquoi on ne le lui demande pas.**
 * L'énoncé exact — *« deux forfaits de même rang APPLICABLES AU MÊME CAS »* —
 * est un recouvrement sur trois axes où **l'absence de condition vaut « toutes
 * les valeurs »**. Une contrainte d'exclusion sur `zone_geo && zone_geo` dirait
 * l'inverse : pour PostgreSQL, un tableau vide ne recouvre rien, alors qu'il
 * signifie ici « partout ». Il faudrait encoder la négation dans la colonne, et
 * *une contrainte dont l'expression inverse le sens de sa colonne est une
 * contrainte que personne ne relit.* L'unicité du rang par nature est plus
 * FORTE (elle interdit aussi les égalités entre forfaits disjoints), totale, et
 * lisible — elle rend le cas litigieux **impossible** au lieu de le détecter.
 */
export type ForfaitCandidat = ConditionsForfait & {
  readonly id: string;
  readonly rang: number;
};

/**
 * RG-TAR-06 — LE forfait applicable, celui de plus petit rang.
 *
 * **Le résultat ne dépend pas de l'ordre des candidats**, et c'est la propriété
 * qui compte : la liste vient d'une requête, et une requête n'a pas d'ordre
 * qu'on ne lui a pas demandé. Le tri est fait ici plutôt que dans le `orderBy`
 * seul, de sorte que la garantie soit **portée par la règle** et non par la
 * lecture — un appelant qui oublierait le `orderBy` obtiendrait le même
 * forfait.
 *
 * L'égalité de rang étant refusée en base, l'ordre est **total** et il n'y a
 * pas de départage à écrire. S'il en apparaissait un — une base restaurée sans
 * sa contrainte, par exemple —, la fonction reste déterministe en départageant
 * par `id`, ce qui vaut mieux qu'un résultat qui change d'une requête à
 * l'autre ; ce n'est pas une règle de tarification, c'est un refus de rendre
 * l'arbitraire invisible.
 */
export function forfaitRetenu<T extends ForfaitCandidat>(
  candidats: readonly T[],
  intervention: ConditionsIntervention,
): T | null {
  const applicables = candidats
    .filter((forfait) => forfaitApplicable(forfait, intervention))
    .sort((a, b) =>
      a.rang === b.rang ? compare(a.id, b.id) : a.rang - b.rang,
    );
  return applicables[0] ?? null;
}

function compare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
