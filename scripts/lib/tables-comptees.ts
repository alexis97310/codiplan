import { REFERENTIELS_PLATEFORME } from "./politiques-rls";
import {
  tablesPremiereCategorieI1,
  type TableObservee,
} from "./perimetre-audit";

/**
 * LA POPULATION DE L'INVENTAIRE, PRODUITE PAR LE SCHÉMA (I1, décision
 * d'exploitation du 10/09/2026).
 *
 * ## Ce que ce module répare, et il faut le dire avec ses chiffres
 *
 * L'inventaire du socle et le contrôle de cloisonnement se confrontent l'un à
 * l'autre : le premier compte sous une identité exemptée des politiques, le
 * second relit sous le rôle applicatif. **Les deux tenaient leur population dans
 * une liste écrite à la main**, `TABLES_CLOISONNEES`, et cette liste a divergé
 * de ses compteurs pendant deux jours et vingt et une heures.
 *
 * *Mesuré :* la divergence naît au commit `97e8f95` — la fusion de #32, ticket
 * L1-02, qui ajoute `site` à la liste sans lui écrire de compteur — le
 * **07/09/2026 à 01:28 UTC**, et se referme au commit `52173a1` le **09/09/2026
 * à 22:48 UTC**. Entre les deux, quatorze tables comptaient **zéro des deux
 * côtés**, dont `site`, `machine` et `intervention` : le seul contrôle qui
 * regarde la base hébergée comparait zéro à zéro et concluait au vert.
 *
 * ## Pourquoi passer de 8 à 22 entrées ne réparait rien
 *
 * Vingt-deux est un nombre, et un nombre tenu à la main dérive comme les huit
 * précédents. C'est la maladie que le §9 nomme depuis le 20/08 — *une liste
 * close se re-vérifie à chaque table créée, sinon elle devient fausse* — et le
 * remède est celui de D41 et de D55 : **renverser la charge et partir du
 * schéma.** Toute table du schéma est ici soit COMPTÉE, soit TÉMOIN, soit
 * EXEMPTÉE nommément avec son motif ; une table qui n'est rien de tout cela
 * fait rougir le jour où elle est écrite.
 *
 * ## Ce que ce module NE fait pas
 *
 * Il ne relit pas le critère de la première catégorie de I1 : il appelle
 * `tablesPremiereCategorieI1`, la seule lecture du dépôt. Une seconde
 * implémentation aurait été la faute du §9 (01/09) — deux lectures d'un même
 * critère, chacune verte, qui s'écartent sans que rien ne les confronte.
 */

/**
 * Les motifs recevables pour ne pas compter une table par société. La liste est
 * close : en ajouter un est un arbitrage, et c'est le geste par lequel un
 * périmètre dérivé redeviendrait une liste d'admis, un argument à la fois.
 */
export type MotifHorsDecompte =
  /** La table grossit à chaque écriture et non à chaque seed : aucun des deux termes de la comparaison n'a de sens. */
  | "hors_comparaison"
  /** La table ne porte aucun `societe_id` : elle ne se range sous aucune société. */
  | "sans_societe";

/** Une table du schéma que l'inventaire ne compte pas, et pourquoi. */
export type ExemptionDecompte = {
  readonly table: string;
  readonly motif: MotifHorsDecompte;
  /** Le raisonnement, en une phrase. Une exemption sans motif écrit n'existe pas. */
  readonly justification: string;
};

/**
 * Les tables du schéma que l'inventaire ne compte NI par société, NI comme
 * témoin — nommées une à une, avec leur motif.
 *
 * Elles ne sont pas un oubli qu'on aurait toléré : chacune est une table dont
 * le décompte comparé n'aurait aucun sens, et le dire ici est ce qui permet au
 * gardien de couverture d'échouer sur toutes les autres.
 */
export const EXEMPTIONS_DECOMPTE: readonly ExemptionDecompte[] = [
  {
    table: "journal_audit",
    motif: "hors_comparaison",
    justification:
      "le journal grossit à chaque ÉCRITURE et non à chaque seed, et sa " +
      "lecture n'est ouverte qu'à deux rôles (§5.2) : comparer les deux " +
      "chiffres exigerait l'égalité de deux grandeurs qui n'ont aucune raison " +
      "d'être égales. Son cloisonnement est éprouvé par l'attribut RLS et par " +
      "le contrôle de privilèges dédié.",
  },
  {
    table: "utilisateur",
    motif: "sans_societe",
    justification:
      "quatrième catégorie de I1 : aucune colonne `societe_id`, parce qu'une " +
      "même personne travaille légitimement pour deux sociétés (RG-SOC-03). " +
      "Elle est cloisonnée par DÉSIGNATION, forme qu'un décompte par société " +
      "ne sait pas mesurer.",
  },
  {
    table: "session",
    motif: "sans_societe",
    justification:
      "troisième catégorie de I1 — trace technique d'authentification, lue " +
      "AVANT qu'une société soit connue, et cloisonnée par désignation.",
  },
  {
    table: "compte",
    motif: "sans_societe",
    justification:
      "troisième catégorie de I1 — trace technique d'authentification, lue " +
      "AVANT qu'une société soit connue, et cloisonnée par désignation.",
  },
  {
    table: "verification",
    motif: "sans_societe",
    justification:
      "troisième catégorie de I1 — trace technique d'authentification, lue " +
      "AVANT qu'une société soit connue, et cloisonnée par désignation.",
  },
  {
    table: "second_facteur",
    motif: "sans_societe",
    justification:
      "troisième catégorie de I1 — trace technique d'authentification, lue " +
      "AVANT qu'une société soit connue, et cloisonnée par désignation.",
  },
  {
    table: "journal_acces",
    motif: "sans_societe",
    justification:
      "troisième catégorie de I1 — trace d'accès. Elle porte deux colonnes de " +
      "société INFORMATIVES et nullables, qui ne filtrent jamais : les " +
      "compter par société ferait d'elles un critère.",
  },
] as const;

/**
 * LES TABLES COMPTÉES PAR SOCIÉTÉ — dérivées, jamais écrites.
 *
 * Première catégorie de I1 telle que le schéma la donne, moins les exemptions.
 * Une table métier créée demain y entre le jour de sa migration, sans que
 * personne n'ait à y penser — et si son compteur manquait, c'est le gardien de
 * couverture qui le dirait, pas trois semaines de verts.
 */
export function tablesComptees(
  observees: readonly TableObservee[],
  exemptions: readonly ExemptionDecompte[] = EXEMPTIONS_DECOMPTE,
): string[] {
  const exemptees = new Set(exemptions.map((exemption) => exemption.table));
  return tablesPremiereCategorieI1(observees)
    .filter((table) => !exemptees.has(table))
    .sort();
}

/**
 * LES TÉMOINS HORS CLOISONNEMENT — dérivés de la deuxième catégorie de I1.
 *
 * Contrôle POSITIF de l'étape 2 : sous le rôle applicatif et sans contexte, les
 * référentiels de plateforme restent lisibles (D4). Sans eux, une base vide ou
 * une connexion muette produirait les mêmes zéros qu'un cloisonnement parfait.
 *
 * La liste vient de `REFERENTIELS_PLATEFORME` et n'est pas recopiée : c'est la
 * liste close de I1, tenue en un seul endroit.
 */
export function tablesTemoins(): string[] {
  return [...REFERENTIELS_PLATEFORME].sort();
}

/**
 * COUVERTURE : toute table du schéma est comptée, témoin, ou exemptée — et
 * exactement l'une des trois.
 *
 * C'est le renversement de charge, et il se lit dans les deux sens. Zéro table
 * lue est un échec — un décompte nul ressemble toujours à un sans-faute (§9,
 * 30/08). Une exemption qui ne s'adosse à aucune table du schéma est un échec
 * aussi : elle ne protège plus rien, et le premier fichier — ici la première
 * table — qui reprendra ce nom héritera d'une exemption que personne ne lui a
 * accordée (§9, 31/08).
 */
export function ecartsCouverture(
  observees: readonly TableObservee[],
  exemptions: readonly ExemptionDecompte[] = EXEMPTIONS_DECOMPTE,
): string[] {
  if (observees.length === 0) {
    return [
      "aucune table lue au schéma : la population de l'inventaire n'a pas été " +
        "établie. Un contrôle qui ne regarde rien ne peut que dire oui.",
    ];
  }

  const ecarts: string[] = [];
  const comptees = new Set(tablesComptees(observees, exemptions));
  const temoins = new Set(tablesTemoins());
  const exemptees = new Set(exemptions.map((exemption) => exemption.table));
  const connues = new Set(observees.map((observee) => observee.table));

  for (const { table } of observees) {
    const rangs = [
      comptees.has(table) ? "comptée" : null,
      temoins.has(table) ? "témoin" : null,
      exemptees.has(table) ? "exemptée" : null,
    ].filter((rang): rang is string => rang !== null);

    if (rangs.length === 0) {
      ecarts.push(
        `« ${table} » n'est ni comptée par société, ni témoin hors ` +
          "cloisonnement, ni exemptée : l'inventaire ne la regarde pas, et le " +
          "contrôle de cloisonnement conclurait au vert sans rien prouver " +
          "d'elle. La compter, ou l'exempter nommément avec son motif dans " +
          "`EXEMPTIONS_DECOMPTE`.",
      );
    } else if (rangs.length > 1) {
      ecarts.push(
        `« ${table} » relève de ${rangs.length} rangs à la fois ` +
          `(${rangs.join(", ")}) : l'appartenance est exclusive.`,
      );
    }
  }

  for (const exemption of exemptions) {
    if (!connues.has(exemption.table)) {
      ecarts.push(
        `l'exemption « ${exemption.table} » ne s'adosse à aucune table du ` +
          "schéma : elle n'exempte plus personne, et la prochaine table de ce " +
          "nom en hériterait sans que personne ne la lui ait accordée.",
      );
    }
    if (exemption.justification.trim().length === 0) {
      ecarts.push(
        `l'exemption « ${exemption.table} » ne porte aucune justification ` +
          "écrite : une exemption sans motif n'existe pas.",
      );
    }
  }

  return ecarts;
}

/** Un identifiant de table SQL acceptable — le schéma n'en produit pas d'autres. */
const IDENTIFIANT = /^[a-z_][a-z0-9_]*$/;

/**
 * Le SQL du décompte, ÉCRIT À PARTIR DE LA POPULATION DÉRIVÉE.
 *
 * **C'est ici que la cécité devient impossible**, et pas seulement improbable :
 * la requête n'énumère plus rien de son côté, elle est fabriquée depuis la
 * liste que le schéma produit. Il n'existe plus d'endroit où une table puisse
 * entrer dans la liste sans entrer dans la mesure — c'était très exactement
 * l'écart du 07/09 au 09/09.
 *
 * *Effet de bord mesuré et voulu :* les vingt et un allers-retours Prisma
 * deviennent UN seul. Sous les 190 ms de latence vers Sydney, le décompte passe
 * d'environ quatre secondes à deux dixièmes — et le §9 (23/08) compte les
 * allers-retours plutôt qu'il ne mesure les durées.
 *
 * `parIdentite` porte l'exception nommée de D42 : `societe` se range sous
 * elle-même par son `id`, les autres par leur `societe_id`. Elle est passée en
 * argument plutôt que lue ici — la liste close vit dans `politiques-rls.ts`.
 */
export function sqlDecompteParSociete(
  tables: readonly string[],
  parIdentite: readonly string[],
): string {
  if (tables.length === 0) {
    throw new Error(
      "Décompte impossible : la population dérivée du schéma est vide. Une " +
        "requête sans table rendrait zéro partout, ce qui ressemble trait pour " +
        "trait à un cloisonnement parfait.",
    );
  }

  return tables
    .map((table) => {
      if (!IDENTIFIANT.test(table)) {
        throw new Error(`Nom de table inattendu au schéma : « ${table} ».`);
      }
      const colonne = parIdentite.includes(table) ? "id" : "societe_id";
      return (
        `SELECT '${table}' AS "table", "${colonne}"::text AS "societe_id", ` +
        `count(*)::int AS "lignes" FROM "${table}" GROUP BY 1, 2`
      );
    })
    .join("\n UNION ALL ");
}

/**
 * Le SQL du décompte À PLAT — sans regroupement, pour la relecture sous le rôle
 * applicatif, où le contexte a déjà choisi la société (ou l'absence de société).
 *
 * Les tables sans ligne visible doivent apparaître avec un zéro : c'est
 * pourquoi le décompte n'est pas un `GROUP BY` mais un `count(*)` par table.
 */
export function sqlDecompteAPlat(tables: readonly string[]): string {
  if (tables.length === 0) {
    throw new Error(
      "Décompte impossible : la population dérivée du schéma est vide.",
    );
  }

  return tables
    .map((table) => {
      if (!IDENTIFIANT.test(table)) {
        throw new Error(`Nom de table inattendu au schéma : « ${table} ».`);
      }
      return `SELECT '${table}' AS "table", count(*)::int AS "lignes" FROM "${table}"`;
    })
    .join("\n UNION ALL ");
}
