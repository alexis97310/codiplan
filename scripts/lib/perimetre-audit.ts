import {
  CLOISONNEE_PAR_IDENTITE,
  REFERENTIELS_PLATEFORME,
} from "./politiques-rls";

/**
 * LE PÉRIMÈTRE DU JOURNAL D'AUDIT — invariant I8, arbitrages D32, D52, D53,
 * **D55**.
 *
 * ## Le renversement de D55, et ce qu'il répare
 *
 * Jusqu'à D55, ce fichier portait une **liste d'admis** : dix tables nommées à
 * la main, tenues à jour par quiconque y penserait. C'est la forme même du
 * défaut du 20/08 — une liste fermée un jour, une décision ultérieure qui crée
 * une table, et personne qui revient la ranger. D52 puis D53 avaient corrigé le
 * CONTENU de la liste et sa MAISON ; ils n'avaient pas touché à son **sens**, et
 * c'est le sens qui dérivait. Le ticket L1-01 l'a montré en acte : `client`
 * naissait hors périmètre, non parce que quelqu'un l'avait décidé, mais parce
 * que personne n'avait ajouté la ligne.
 *
 * **Le périmètre est donc inversé.** Toute table de la **première catégorie de
 * I1** — table métier cloisonnée, `societe_id NOT NULL`, plus `societe` qui est
 * cloisonnée par son identité (D42) — est auditée, **moins une liste
 * d'exemptions explicitement justifiées**. Une table métier créée demain est
 * auditée à sa naissance, sauf si quelqu'un écrit pourquoi non.
 *
 * **L'exhaustivité n'est plus tenue par personne : elle est héritée.** La
 * première catégorie de I1 est déjà énumérée par le schéma lui-même, et le
 * gardien d'exhaustivité de D41 (`tests/unit/db/categories-i1.test.ts`) exige
 * que chaque table du schéma appartienne à exactement une catégorie. Le
 * périmètre d'audit hérite donc de cette fermeture sans avoir rien à tenir.
 *
 * ## Les motifs d'exemption, et la liste close qu'ils forment
 *
 * Il n'y en a que deux, et le second n'est pas un choix :
 *
 *   — **`rejouable`** : l'information qu'une écriture non tracée ferait perdre
 *     se reconstitue depuis une autre table, elle-même auditée. C'est le SEUL
 *     motif recevable pour une table ordinaire. « C'est bruyant » n'en est pas
 *     un : le journal est partitionné (L0-10) précisément pour que le volume ne
 *     soit jamais un argument. Et **aucune exemption pour une table dont les
 *     lignes sont saisies par un humain** — c'est justement là que la question
 *     « qui a écrit cela, quand, depuis quelle valeur » se pose.
 *
 *   — **`impossible`** : poser le déclencheur produit une base qui ne fonctionne
 *     pas. Ce n'est pas une dispense qu'on s'accorde, c'est un constat, et il
 *     doit être MESURÉ dans la justification, jamais supposé.
 *
 * ## Ce que ce fichier reste, et ce qu'il n'est plus
 *
 * Il reste la **seule maison** de la question (D53) : l'invariant I8 du
 * CLAUDE.md, la règle RG-DRO-04 et le README y renvoient sans rien recopier. Il
 * n'est plus la maison d'une LISTE — il n'y en a plus — mais celle d'une
 * **règle** et de ses **exceptions**.
 *
 * Et l'indépendance du gardien n'a pas bougé : il confronte cette règle aux
 * MIGRATIONS et au SCHÉMA, deux sources qu'il ne contrôle pas et qui ne se
 * plient pas à ce qu'il déclare.
 */

/** Ce que le déclencheur d'audit s'appelle, partout où il est posé. */
export const NOM_DECLENCHEUR = "journal_audit";

/**
 * Les deux seuls motifs d'exemption recevables. Liste close : en ajouter un
 * troisième est un arbitrage, et c'est le geste par lequel un périmètre inversé
 * redeviendrait une liste d'admis.
 */
export type MotifExemption = "rejouable" | "impossible";

/** Une table de la première catégorie de I1 que l'on n'audite PAS, et pourquoi. */
export type Exemption = {
  readonly table: string;
  readonly motif: MotifExemption;
  /** Le raisonnement, en une phrase. Une exemption sans motif écrit n'existe pas. */
  readonly justification: string;
};

/**
 * Les exemptions en vigueur. Elles se relisent une par une, et chacune se
 * défend seule.
 */
export const EXEMPTIONS_AUDIT: readonly Exemption[] = [
  {
    table: "journal_audit",
    motif: "impossible",
    justification:
      "Le journal ne peut pas s'auditer lui-même : le déclencheur écrit dans " +
      "la table qui le déclenche, et la récursion est immédiate. MESURÉ sur " +
      "la base jetable, déclencheur posé sur « journal_audit » puis une seule " +
      "ligne insérée : PostgreSQL rend « stack depth limit exceeded » et la " +
      "transaction échoue. Ce n'est donc pas une dispense mais un constat. " +
      "Et l'information n'est perdue nulle part : le journal est en AJOUT " +
      "SEUL (I8, D32) — ni UPDATE ni DELETE ne lui sont accordés, par ses " +
      "privilèges comme par l'absence de politique pour ces verbes —, si bien " +
      "qu'il n'existe aucune écriture à tracer au-delà de l'insertion qui, " +
      "elle, EST déjà la trace.",
  },
] as const;

/**
 * Une table telle qu'une source extérieure la donne à ce module — le schéma
 * Prisma pour le gardien statique, `pg_catalog` pour un contrôle en base.
 *
 * Ce module ne lit ni l'un ni l'autre : il ne dépend de rien, ce qui lui permet
 * d'être appelé depuis `tests/unit/` comme depuis `scripts/`.
 */
export type TableObservee = {
  readonly table: string;
  /** La table porte-t-elle une colonne `societe_id` NON nullable ? */
  readonly societeIdObligatoire: boolean;
};

/**
 * Les tables de la PREMIÈRE catégorie de I1, telles que la source les donne.
 *
 * `societe` en fait partie sans porter de `societe_id` : elle est cloisonnée par
 * son identité (D42), et l'exception est nommée plutôt que déduite. Les
 * référentiels de plateforme en sont exclus : ils relèvent de la deuxième
 * catégorie, et une table qui serait dans les deux est un écart que le gardien
 * d'exhaustivité de D41 refuse déjà.
 */
export function tablesPremiereCategorieI1(
  observees: readonly TableObservee[],
): string[] {
  return observees
    .filter(
      (observee) =>
        (CLOISONNEE_PAR_IDENTITE as readonly string[]).includes(
          observee.table,
        ) ||
        (observee.societeIdObligatoire &&
          !(REFERENTIELS_PLATEFORME as readonly string[]).includes(
            observee.table,
          )),
    )
    .map((observee) => observee.table);
}

/** Les tables exemptées, par leur nom. */
export function tablesExemptees(
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
): string[] {
  return exemptions.map((exemption) => exemption.table);
}

/**
 * LE PÉRIMÈTRE : première catégorie de I1, moins les exemptions.
 *
 * C'est la seule définition du périmètre d'audit dans le dépôt. Elle se calcule,
 * elle ne se tient pas.
 */
export function perimetreAudit(
  observees: readonly TableObservee[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
): string[] {
  const exemptees = tablesExemptees(exemptions);
  return tablesPremiereCategorieI1(observees).filter(
    (table) => !exemptees.includes(table),
  );
}

/**
 * Écarts de la LISTE D'EXEMPTIONS elle-même — la seule chose qui reste tenue à
 * la main, donc la seule qui puisse dériver.
 *
 * Deux motifs, et le premier est le corollaire du 31/08 sur les sélections
 * négatives : **une exemption qui ne s'applique à personne ne fait échouer
 * personne.** Elle survit à la disparition de sa table, ne protège plus rien, et
 * le premier fichier qui reprendra ce nom en héritera sans que personne ne le
 * lui ait accordé.
 */
export function ecartsExemptions(
  observees: readonly TableObservee[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
): string[] {
  const ecarts: string[] = [];
  const categorie1 = tablesPremiereCategorieI1(observees);

  for (const exemption of exemptions) {
    if (!categorie1.includes(exemption.table)) {
      ecarts.push(
        `« ${exemption.table} » est exemptée d'audit alors qu'elle ne relève ` +
          "PAS de la première catégorie de I1 — soit elle a disparu du schéma, " +
          "soit elle a changé de catégorie. Une exemption qui ne s'applique à " +
          "personne ne fait échouer personne : elle ne protège plus rien, et " +
          "la prochaine table qui reprendra ce nom en héritera sans que " +
          "personne ne le lui ait accordé.",
      );
    }
    if (exemption.justification.trim().length === 0) {
      ecarts.push(
        `« ${exemption.table} » est exemptée sans justification écrite. Le ` +
          "périmètre est inversé depuis D55 : une table métier est auditée " +
          "SAUF si quelqu'un écrit pourquoi non, et « pourquoi non » est le " +
          "seul contenu de cette liste.",
      );
    }
  }

  const noms = tablesExemptees(exemptions);
  if (new Set(noms).size !== noms.length) {
    ecarts.push(
      "une table est exemptée deux fois : deux justifications pour une même " +
        "table, et rien ne dit laquelle fait autorité.",
    );
  }

  return ecarts;
}
