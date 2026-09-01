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
 * ## LE JOURNAL N'EST PAS UNE EXCEPTION : IL EST HORS DU DOMAINE
 *
 * `journal_audit` porte `societe_id NOT NULL` et relèverait donc de la première
 * catégorie. Elle est **retirée du domaine**, et ce n'est pas une exemption
 * qu'on lui accorde — c'est la frontière de la règle, et elle porte déjà un nom
 * au §9 du CLAUDE.md : **un gardien ne peut pas se garder lui-même.**
 *
 * **La raison est doctrinale, pas technique.** La récursion existe — mesurée :
 * déclencheur posé sur `journal_audit`, une ligne insérée, PostgreSQL rend
 * `ERROR: stack depth limit exceeded`. Mais elle n'est que le SYMPTÔME. Même
 * contournée — un second journal, un déclencheur conditionnel —, auditer le
 * journal depuis le journal produirait un gardien vert par construction, donc
 * sans valeur. La pile qui déborde ne fait que rendre visible ce qui était déjà
 * décidé.
 *
 * **Pourquoi le retirer du domaine plutôt que l'y exempter.** Un motif
 * d'exemption est une porte qu'on rouvre par argument, et « impossibilité » est
 * élastique : quelqu'un plaidera un jour l'impossibilité pour cause de volume,
 * de récursion indirecte ou de verrou, mesure à l'appui, et il aura raison sur
 * la forme. Une **liste close à une entrée, gardée dans les deux sens**, est une
 * porte qu'on ne rouvre que par une modification que quelqu'un relit. C'est la
 * forme de `CLOISONNEE_PAR_IDENTITE` (D42), et elle tient.
 *
 * **Ce que ce retrait coûte, et comment il est payé.** Écrire que le journal
 * n'est pas tracé laisse un trou pour un lecteur futur. La garantie de
 * substitution est donc écrite ICI, à côté du retrait, et surtout ÉPROUVÉE
 * ailleurs : **le journal n'est pas audité, il est INALTÉRABLE** — `UPDATE` et
 * `DELETE` retirés au rôle applicatif depuis L0-10, doublés par l'absence de
 * toute politique pour ces verbes sous `FORCE ROW LEVEL SECURITY`. C'est plus
 * fort qu'une trace, pas plus faible : une trace dit ce qui a été changé, une
 * inaltérabilité dit que rien ne l'a été. Mais seulement si c'est mesuré, et
 * par TENTATIVE plutôt que par lecture de privilèges :
 *
 *   — `tests/isolation/journal-audit.test.ts` tente un `UPDATE` et un `DELETE`
 *     sur `journal_audit` sous `codiplan_app`, et exige l'échec des deux ;
 *   — `tests/isolation/journal-audit-partitions.test.ts` les tente sur CHAQUE
 *     partition, énumérée par `pg_inherits` — jamais sur la table mère. Une
 *     partition est une table : elle n'hérite ni des privilèges ni des
 *     politiques du parent, et c'était exactement la faille de L0-10 ;
 *   — le durcissement est posé par la fonction qui CRÉE la partition
 *     (`journal_audit_partition_creer` appelle `journal_audit_partition_durcir`
 *     avant de rendre, dans la même transaction), si bien qu'aucune partition
 *     ne naît nue par le chemin du dépôt.
 *
 * ## Le motif d'exemption, et la liste close qu'il forme
 *
 * Il n'y en a qu'UN, et la liste est **vide aujourd'hui** — une liste vide qui
 * reste vide est un meilleur signal qu'une liste à une entrée qu'on cesse de
 * regarder.
 *
 *   — **`rejouable`** : l'information qu'une écriture non tracée ferait perdre
 *     se reconstitue depuis une autre table, elle-même auditée. « C'est
 *     bruyant » n'en est pas un : le journal est partitionné (L0-10) précisément
 *     pour que le volume ne soit jamais un argument. Et **aucune exemption pour
 *     une table dont les lignes sont saisies par un humain** — c'est justement
 *     là que la question « qui a écrit cela, quand, depuis quelle valeur » se
 *     pose.
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
 * Le SEUL motif d'exemption recevable. En ajouter un second est un arbitrage —
 * et c'est le geste par lequel un périmètre inversé redeviendrait une liste
 * d'admis, un argument à la fois.
 */
export type MotifExemption = "rejouable";

/** Une table de la première catégorie de I1 que l'on n'audite PAS, et pourquoi. */
export type Exemption = {
  readonly table: string;
  readonly motif: MotifExemption;
  /** Le raisonnement, en une phrase. Une exemption sans motif écrit n'existe pas. */
  readonly justification: string;
};

/**
 * Les exemptions en vigueur. **Il n'y en a AUCUNE**, et c'est un état, pas un
 * oubli : toute table métier cloisonnée du dépôt est auditée.
 *
 * Une liste vide qui reste vide est un meilleur signal qu'une liste à une
 * entrée qu'on cesse de regarder. Le jour où une entrée s'y ajoutera, elle
 * devra porter le motif `rejouable`, une justification écrite, et s'adosser à
 * une table qui existe — les trois sont gardés.
 */
export const EXEMPTIONS_AUDIT: readonly Exemption[] = [] as const;

/**
 * LA FRONTIÈRE DU DOMAINE — liste close d'UNE entrée, gardée dans les deux
 * sens, sur le modèle de `CLOISONNEE_PAR_IDENTITE` (D42).
 *
 * `journal_audit` n'est pas exemptée : elle est **hors du domaine**. La raison
 * est celle du §9 du CLAUDE.md — **un gardien ne peut pas se garder lui-même**
 * —, et elle était écrite avant que la question ne se pose. Voir l'en-tête de
 * ce module pour le raisonnement complet et pour la garantie de substitution :
 * le journal n'est pas audité, il est INALTÉRABLE, et cela est éprouvé par
 * TENTATIVE d'écriture, sur la table mère comme sur chacune de ses partitions.
 *
 * **Toute addition comme tout retrait passent par un arbitrage.** Une addition
 * ferait du §9 un argument réutilisable, alors qu'il ne vise qu'un objet : le
 * journal qui devrait se garder lui-même. Un retrait remettrait le journal dans
 * le domaine, et le gardien réclamerait un déclencheur dont on a mesuré qu'il
 * fait déborder la pile.
 */
export const HORS_DOMAINE_AUDIT = ["journal_audit"] as const;

/** L'unique entrée que l'arbitrage autorise. Recopiée : c'est la doctrine, pas la liste. */
const SEULE_SORTIE_ARBITREE = "journal_audit";

/**
 * Écarts de la liste HORS DOMAINE elle-même — additions comme retraits.
 *
 * Même forme que `ecartsListeExceptions` de `categories-i1` et que
 * `ecartsListeParc` : une liste close à une entrée n'a de valeur que si les
 * deux gestes qui la modifient sont refusés.
 */
export function ecartsListeHorsDomaine(
  liste: readonly string[] = HORS_DOMAINE_AUDIT,
): string[] {
  const ecarts = liste
    .filter((table) => table !== SEULE_SORTIE_ARBITREE)
    .map(
      (table) =>
        `« ${table} » a été retirée du domaine d'audit. Le §9 — un gardien ne ` +
        "peut pas se garder lui-même — ne vise qu'un objet : le journal. En " +
        "faire un argument réutilisable rouvrirait par la prose la porte que " +
        "D55 a fermée. Toute addition passe par un arbitrage.",
    );

  if (!liste.includes(SEULE_SORTIE_ARBITREE)) {
    ecarts.push(
      `« ${SEULE_SORTIE_ARBITREE} » ne figure plus hors du domaine d'audit : ` +
        "le gardien réclamerait alors un déclencheur sur le journal, dont il " +
        "est mesuré qu'il fait déborder la pile. Toute modification passe par " +
        "un arbitrage.",
    );
  }

  return ecarts;
}

/** Les tables hors du domaine d'audit. */
export function tablesHorsDomaine(
  liste: readonly string[] = HORS_DOMAINE_AUDIT,
): string[] {
  return [...liste];
}

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
 * LE PÉRIMÈTRE : première catégorie de I1, moins la frontière du domaine
 * (`journal_audit`, §9), moins les exemptions (aucune aujourd'hui).
 *
 * C'est la seule définition du périmètre d'audit dans le dépôt. Elle se calcule,
 * elle ne se tient pas. Les deux soustractions ne disent pas la même chose :
 * la première est une FRONTIÈRE — le journal ne peut pas se garder lui-même —,
 * la seconde une EXCEPTION, qui se plaide table par table.
 */
export function perimetreAudit(
  observees: readonly TableObservee[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
  horsDomaine: readonly string[] = HORS_DOMAINE_AUDIT,
): string[] {
  const exemptees = tablesExemptees(exemptions);
  return tablesPremiereCategorieI1(observees).filter(
    (table) => !horsDomaine.includes(table) && !exemptees.includes(table),
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
    if ((exemption.motif as string) !== "rejouable") {
      ecarts.push(
        `« ${exemption.table} » est exemptée sous le motif ` +
          `« ${String(exemption.motif)} », qui n'existe pas. Il n'y a qu'un ` +
          "motif recevable — `rejouable` : l'information perdue se reconstitue " +
          "depuis une autre table auditée. En ajouter un second est un " +
          "arbitrage, et c'est le geste par lequel un périmètre inversé " +
          "redevient une liste d'admis, un argument à la fois.",
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

/**
 * Les tables portant le déclencheur d'audit, telles que le CATALOGUE les
 * montre — et non telles que les migrations les écrivent.
 *
 * Les deux lectures sont nécessaires et ne se remplacent pas. Le gardien
 * statique lit les MIGRATIONS : il attrape le ticket qui crée une table sans
 * son déclencheur, avant que la migration ne parte. Celle-ci lit la BASE : elle
 * attrape ce qu'aucune migration ne raconte — un `DROP TRIGGER` passé à la main,
 * une table créée hors migration, un `ALTER TABLE … DISABLE TRIGGER`. C'est le
 * couple préventif/détectif du 30/08, appliqué au périmètre d'audit.
 *
 * `tgisinternal` écarte les déclencheurs que PostgreSQL pose lui-même pour les
 * clés étrangères ; `tgenabled <> 'D'` écarte ceux qui sont endormis — un
 * déclencheur désactivé n'écrit rien, et le compter reviendrait à croire une
 * trace qui n'existe pas.
 */
export const SQL_DECLENCHEURS_AUDIT = `
  SELECT "c"."relname"::text AS "table"
    FROM "pg_catalog"."pg_trigger" "t"
    JOIN "pg_catalog"."pg_class" "c" ON "c"."oid" = "t"."tgrelid"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "t"."tgname" = $1
     AND NOT "t"."tgisinternal"
     AND "t"."tgenabled" <> 'D'
   ORDER BY "c"."relname"
`;

/**
 * Écarts entre le périmètre d'audit et les déclencheurs réellement posés.
 *
 * **UNE SEULE implémentation, deux sources.** Le gardien statique lui passe le
 * schéma Prisma et les migrations ; la veille de la base hébergée lui passe
 * `pg_attribute` et `pg_trigger`. Écrire deux fois cette logique serait
 * exactement l'espèce nommée au §9 du CLAUDE.md — deux lectures d'un même
 * critère qui divergent en silence, aucune ne prétendant être l'autre.
 *
 * Quatre motifs :
 *   1. une table métier cloisonnée sans déclencheur — le cas de `client` avant
 *      D55, et il ne demandait aucune liste pour être détecté ;
 *   2. un déclencheur sur le JOURNAL lui-même — il est hors du domaine (§9) ;
 *   3. un déclencheur sur une table EXEMPTÉE — l'exemption dit une chose et la
 *      base une autre ;
 *   4. un déclencheur hors de la première catégorie de I1 — élargir la
 *      traçabilité est un arbitrage.
 */
export function ecartsDeclencheurs(
  observees: readonly TableObservee[],
  declenchees: readonly string[],
  exemptions: readonly Exemption[] = EXEMPTIONS_AUDIT,
  horsDomaine: readonly string[] = HORS_DOMAINE_AUDIT,
): string[] {
  // TÉMOIN DE POPULATION, et c'est la faute déjà commise deux fois : « aucune
  // table sans déclencheur » est vert que la réponse soit zéro parce qu'il n'y
  // en a pas, ou zéro parce que la requête n'a rien vu — mauvais schéma,
  // mauvais filtre, connexion sur la mauvaise base. Les cinq autres contrôles
  // du dépôt portaient déjà cette garde ; celui-ci ne l'avait pas.
  if (observees.length === 0) {
    return [
      "aucune table observée : le périmètre d'audit n'a rien établi. Schéma " +
        "vide, mauvaise base, ou requête jouée hors du schéma attendu — dans " +
        "les trois cas, « aucune table sans déclencheur » ne prouve rien.",
    ];
  }

  const perimetre = perimetreAudit(observees, exemptions, horsDomaine);
  const exemptees = tablesExemptees(exemptions);

  // Second témoin, plus étroit : des tables observées mais AUCUNE de la
  // première catégorie de I1 signifie que le critère de cloisonnement n'a rien
  // reconnu — une colonne `societe_id` renommée, par exemple.
  if (perimetre.length === 0 && horsDomaine.length === 0) {
    return [
      "aucune table métier cloisonnée parmi les tables observées : le " +
        "périmètre d'audit est vide, et il n'a donc rien gardé.",
    ];
  }

  const ecarts: string[] = [
    ...ecartsListeHorsDomaine(horsDomaine),
    ...ecartsExemptions(observees, exemptions),
  ];

  for (const table of perimetre) {
    if (!declenchees.includes(table)) {
      ecarts.push(
        `« ${table} » est une table métier cloisonnée (1ʳᵉ catégorie de I1) et ` +
          `ne porte pas le déclencheur « ${NOM_DECLENCHEUR} ». Depuis D55 le ` +
          "périmètre d'audit est INVERSÉ : une table métier est auditée par " +
          "défaut, et n'y échappe que par une exemption écrite et justifiée " +
          "dans scripts/lib/perimetre-audit.ts. Le déclencheur se pose dans la " +
          "migration qui crée la table, jamais dans une migration de " +
          "rattrapage écrite quand quelqu'un s'en apercevra.",
      );
    }
  }

  for (const table of declenchees) {
    if (horsDomaine.includes(table)) {
      ecarts.push(
        `« ${table} » porte le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle est HORS DU DOMAINE d'audit — un gardien ne peut pas se " +
          "garder lui-même (§9). Le journal n'est pas audité : il est " +
          "INALTÉRABLE, et cela s'éprouve par tentative d'écriture, pas par " +
          "un déclencheur qui écrirait dans la table qui le déclenche.",
      );
      continue;
    }
    if (exemptees.includes(table)) {
      ecarts.push(
        `« ${table} » porte le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle figure aux EXEMPTIONS. L'exemption dit une chose et la " +
          "migration une autre : soit l'exemption n'a plus lieu d'être et se " +
          "retire, soit le déclencheur est de trop.",
      );
      continue;
    }
    if (!perimetre.includes(table)) {
      ecarts.push(
        `« ${table} » a reçu le déclencheur « ${NOM_DECLENCHEUR} » alors ` +
          "qu'elle ne relève PAS de la première catégorie de I1 — c'est un " +
          "référentiel de plateforme, une table technique, ou elle n'existe " +
          "pas au schéma. Élargir la traçabilité au-delà des tables métier " +
          "cloisonnées est un arbitrage, jamais une décision de ticket.",
      );
    }
  }

  return ecarts;
}

/** Rapport de journal — ce que la veille a observé, avant tout verdict. */
export function rapportDeclencheurs(
  observees: readonly TableObservee[],
  declenchees: readonly string[],
): string {
  const perimetre = perimetreAudit(observees);
  return [
    "Périmètre d'audit (calculé, non tenu — D55)",
    `  ${observees.length} table(s) observée(s), ${perimetre.length} ` +
      `métier cloisonnée(s) à auditer, ${declenchees.length} déclencheur(s) ` +
      "observé(s)",
    `  hors du domaine : ${tablesHorsDomaine().join(", ")} ; ` +
      `exemptions : ${tablesExemptees().length === 0 ? "aucune" : tablesExemptees().join(", ")}`,
    "",
  ].join("\n");
}
