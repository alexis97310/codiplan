import { TABLES_CLOISONNEES } from "./inventaire";

/**
 * L'état DÉCLARÉ de la sécurité au niveau des lignes, table par table — logique
 * pure (I1 ; correction de revue du ticket L0-10).
 *
 * **Pourquoi ce contrôle existe, alors que le cloisonnement est déjà prouvé par
 * la LECTURE.** Les scénarios d'isolation et le contrôle de cloisonnement lisent
 * de vraies lignes sous de vrais rôles : c'est la preuve la plus forte qu'on
 * puisse produire, et elle ne peut pas rester verte sur une RLS éteinte.
 * Mesuré : `DISABLE ROW LEVEL SECURITY` sur `societe`, et le rôle applicatif
 * voit aussitôt les deux sociétés sans contexte.
 *
 * **Mais elle est structurellement AVEUGLE à `FORCE`.** `FORCE ROW LEVEL
 * SECURITY` ne change rien pour un rôle NON propriétaire — il ne concerne que
 * le propriétaire des tables. Une lecture faite sous `codiplan_app` ne peut donc
 * pas le voir. Mesuré, sur un propriétaire non superutilisateur :
 *
 * | État de `societe` | rôle applicatif | PROPRIÉTAIRE |
 * |---|---|---|
 * | `ENABLE` + `FORCE` | 0 ligne | 0 ligne |
 * | `ENABLE`, **`FORCE` retiré** | 0 ligne — *rien ne se voit* | **2 lignes** |
 * | **`ENABLE` retiré** | 2 lignes | 2 lignes |
 *
 * La ligne du milieu est tout l'objet de ce module : le cloisonnement paraît
 * intact, et le propriétaire — donc les migrations, le seed, toute connexion de
 * maintenance — lit les deux sociétés. **Ce qui ne se prouve pas par la lecture
 * doit se prouver par l'attribut**, et c'est le seul cas du dépôt où l'attribut
 * est la seule preuve possible.
 *
 * **Et l'attribut se lit en DEUX drapeaux, jamais un.** `FORCE` sans `ENABLE`
 * laisse la sécurité inerte — mesuré au même ticket sur les partitions du
 * journal. Une assertion sur un seul drapeau est creuse.
 *
 * **Les trois listes sont CLOSES et l'appartenance est exclusive**, sur le
 * modèle du gardien d'exhaustivité de D41 : toute table de `public` doit
 * relever d'exactement l'une d'elles. Une table cloisonnée qui perdrait
 * entièrement sa RLS ne « disparaîtrait » pas du contrôle — elle basculerait
 * dans la troisième liste, où elle n'a rien à faire, et le contrôle le dirait.
 */

/**
 * Tables dont la RLS doit être ACTIVÉE **et** FORCÉE — les tables cloisonnées.
 *
 * `journal_audit` s'ajoute à `TABLES_CLOISONNEES`, et l'écart entre les deux
 * listes est délibéré : celle de l'inventaire sert un DÉCOMPTE comparé, auquel
 * le journal ne se prête pas (il grossit à chaque écriture, et sa lecture n'est
 * ouverte qu'à deux rôles). Ici il s'agit d'un ATTRIBUT, et le journal est
 * cloisonné comme les autres — il doit donc y figurer.
 *
 * Ses PARTITIONS sont exclues du périmètre de ce contrôle : elles ont le leur,
 * plus exigeant, dans `scripts/lib/privileges-journal.ts` — aucun privilège du
 * tout, et les deux drapeaux.
 */
export const TABLES_RLS_FORCEE = [
  ...TABLES_CLOISONNEES,
  "journal_audit",
  // `utilisateur` rejoint la RLS FORCÉE au ticket L1-02c, et elle n'est ni
  // cloisonnée par société ni un journal : elle ne porte AUCUN `societe_id` —
  // RG-SOC-03, une même personne travaille légitimement pour deux sociétés —
  // et se cloisonne par DEUX formes qui ne se recouvrent pas, « désignation »
  // avant que la société soit connue et « rattachement » après. Elle est donc
  // nommée ici séparément : la dériver de `TABLES_CLOISONNEES` l'aurait fait
  // entrer dans un décompte par société auquel elle ne se prête pas.
  "utilisateur",
  // ── LA TROISIÈME CATÉGORIE DE I1 REJOINT LA RLS FORCÉE (L1-02d) ───────────
  //
  // Décision d'exploitation du 08/09/2026, prise pour la CATÉGORIE ENTIÈRE et
  // non pour la table mesurée : « traiter une table et laisser ses quatre
  // voisines dans le même état, c'est réparer une liste au lieu de la fermer ».
  //
  // Elles sont nommées ici SÉPARÉMENT, et pas dérivées de `TABLES_CLOISONNEES` :
  // elles ne portent aucun `societe_id` et ne se prêtent à aucun décompte par
  // société. Ce qu'elles portent est un ATTRIBUT, et il est le même.
  "session",
  "compte",
  "verification",
  "second_facteur",
  "journal_acces",
] as const;

/**
 * Référentiels de plateforme : RLS activée, **jamais forcée** (D4). Le
 * propriétaire doit pouvoir les amorcer sans contexte — c'est ce que `FORCE`
 * lui interdirait.
 */
export const TABLES_RLS_SIMPLE = ["devise", "parite", "jour_ferie"] as const;

/**
 * Tables SANS aucune RLS. **ELLE EST VIDE DEPUIS L1-02d, ET C'EST LE TICKET.**
 *
 * Elle portait les cinq tables techniques d'authentification (troisième
 * catégorie de I1, D34). L'exemption était un VESTIGE : elles avaient été
 * laissées sans plancher pour la même raison que `utilisateur` —
 * l'authentification précède la société, et nous ne savions pas exprimer une
 * garantie avant le contexte. Nous savons depuis L1-02c : c'est la forme
 * « désignation ». *Une borne posée faute de mieux ne se reconduit pas dès que
 * le mieux existe.*
 *
 * **La garder plutôt que la supprimer est délibéré.** Elle n'est pas une liste
 * d'exemptions à remplir : elle est la troisième branche d'une partition
 * EXCLUSIVE, celle où atterrirait une table qui perdrait sa RLS. Vide, elle dit
 * « aucune table du dépôt n'est sans plancher » — et le jour où une y tombe,
 * elle est nommée au lieu de disparaître du contrôle.
 *
 * Un test l'éprouve dans les deux sens : une table sans RLS y est nommée, et
 * une addition à la liste est refusée comme un arbitrage.
 */
export const TABLES_SANS_RLS = [] as const;

/**
 * La requête, écrite une seule fois et partagée par
 * `scripts/controle-cloisonnement.mts` (base hébergée) et par
 * `tests/isolation/force-rls.test.ts` (base jetable).
 *
 * `relkind IN ('r','p')` retient les tables ordinaires ET partitionnées ;
 * `NOT relispartition` écarte les partitions, qui relèvent du contrôle dédié.
 * `_prisma_migrations` est la table de Prisma, hors périmètre de I1 : elle ne
 * porte aucune donnée métier et n'est jamais lue par l'application.
 */
export const SQL_ETAT_RLS = `
  SELECT "c"."relname"::text       AS "table",
         "c"."relrowsecurity"      AS "activee",
         "c"."relforcerowsecurity" AS "forcee"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relkind" IN ('r', 'p')
     AND NOT "c"."relispartition"
     AND "c"."relname" <> '_prisma_migrations'
   ORDER BY "c"."relname"
`;

/** L'état déclaré d'une table. */
export type EtatRlsTable = {
  table: string;
  activee: boolean;
  forcee: boolean;
};

/**
 * Écarts entre l'état déclaré et ce que I1 exige — une liste vide est le seul
 * état acceptable.
 *
 * Quatre motifs, et le premier est le témoin :
 *   1. **aucune table observée** — la base est vide, ou `pg_class` a été lue
 *      ailleurs qu'on ne croit. Un contrôle qui n'a rien vu n'a rien prouvé ;
 *   2. une table cloisonnée dont un des DEUX drapeaux manque ;
 *   3. un référentiel de plateforme qui aurait gagné `FORCE` — le propriétaire
 *      ne pourrait plus l'amorcer — ou perdu `ENABLE` ;
 *   4. une table qui ne figure dans AUCUNE des trois listes, ou dont l'état
 *      contredit la liste où elle figure.
 */
export function ecartsRlsDeclaree(
  observees: readonly EtatRlsTable[],
  listes: {
    forcee?: readonly string[];
    simple?: readonly string[];
    sansRls?: readonly string[];
  } = {},
): string[] {
  if (observees.length === 0) {
    return [
      "aucune table observée dans le schéma « public » : le contrôle de l'état " +
        "déclaré de RLS n'a rien établi. Base vide, mauvaise base, ou requête " +
        "jouée hors du schéma attendu — un décompte nul ressemble beaucoup " +
        "trop à un sans-faute.",
    ];
  }

  const ecarts: string[] = [];
  // Les listes sont paramétrables pour un seul appelant : le harnais
  // d'isolation, qui crée en plus des tables FIXTURES « contrat »
  // (`client`, `site`, `machine`, `modele_materiel`) modelant les vraies tables
  // des lots 1 et 2. Elles portent délibérément les mêmes politiques que les
  // tables réelles — c'est tout leur objet —, mais elles n'existent pas au
  // schéma et n'ont donc rien à faire dans les listes de production. Aucun
  // autre appelant ne surcharge : le contrôle de la base hébergée juge sur les
  // listes de I1, et rien d'autre.
  const forcee: readonly string[] = listes.forcee ?? TABLES_RLS_FORCEE;
  const simple: readonly string[] = listes.simple ?? TABLES_RLS_SIMPLE;
  const sansRls: readonly string[] = listes.sansRls ?? TABLES_SANS_RLS;

  for (const etat of observees) {
    if (forcee.includes(etat.table)) {
      if (!etat.activee || !etat.forcee) {
        ecarts.push(
          `« ${etat.table} » est cloisonnée : sa RLS doit être ACTIVÉE et ` +
            `FORCÉE, elle est ${etat.activee ? "activée" : "NON activée"} et ` +
            `${etat.forcee ? "forcée" : "NON forcée"}. Les DEUX drapeaux ` +
            "comptent, et pour des raisons différentes : sans ENABLE, aucune " +
            "politique ne s'applique à personne ; sans FORCE, le PROPRIÉTAIRE " +
            "y échappe — donc les migrations, le seed et toute connexion de " +
            "maintenance, qui lisent alors toutes les sociétés. Mesuré : " +
            "FORCE retiré, le rôle applicatif ne voit toujours rien et le " +
            "propriétaire voit tout.",
        );
      }
      continue;
    }

    if (simple.includes(etat.table)) {
      if (!etat.activee) {
        ecarts.push(
          `le référentiel de plateforme « ${etat.table} » n'a plus de RLS ` +
            "activée : son écriture n'est plus réservée aux rôles éditeur (I1).",
        );
      }
      if (etat.forcee) {
        ecarts.push(
          `le référentiel de plateforme « ${etat.table} » a gagné FORCE ROW ` +
            "LEVEL SECURITY. Il ne doit PAS l'avoir (D4) : le propriétaire " +
            "doit pouvoir l'amorcer sans contexte société, et le seed échouerait.",
        );
      }
      continue;
    }

    if (sansRls.includes(etat.table)) {
      if (etat.activee || etat.forcee) {
        ecarts.push(
          `« ${etat.table} » relève des tables sans RLS (I1, catégories 3 et ` +
            "4) et en a pourtant gagné une. Si c'est délibéré, c'est un " +
            "arbitrage : la table change de catégorie, et les listes closes de " +
            "I1 avec elle.",
        );
      }
      continue;
    }

    ecarts.push(
      `« ${etat.table} » ne figure dans AUCUNE des trois listes d'état RLS ` +
        `(état observé : ${etat.activee ? "activée" : "non activée"}, ` +
        `${etat.forcee ? "forcée" : "non forcée"}). Une table nouvelle se ` +
        "range dans l'une des trois — cloisonnée, référentiel de plateforme, " +
        "ou technique sans RLS — et ce classement est celui de I1, pas une " +
        "décision de ticket.",
    );
  }

  return ecarts;
}

/**
 * Rapport de journal — l'état déclaré, table par table et NOMMÉE.
 *
 * **Une première rédaction ne rendait que trois décomptes** : « 9 ENABLE+FORCE,
 * 3 ENABLE seul, 6 sans RLS ». Le verdict était juste — `ecartsRlsDeclaree`
 * confronte déjà chaque table à la liste où elle se range —, mais le rapport ne
 * permettait pas de le relire : un lecteur de la veille voyait une asymétrie
 * (trois tables sans `FORCE`) sans pouvoir dire lesquelles, ni si c'était une
 * décision ou un reste. Un décompte se lit en trois secondes et ne se vérifie
 * pas ; un nom se vérifie.
 *
 * **Et l'asymétrie du milieu est une DÉCISION, écrite ici plutôt que déduite.**
 * Les référentiels de plateforme portent `ENABLE` sans `FORCE` (D4) : `FORCE`
 * ne concerne que le PROPRIÉTAIRE des tables, et c'est lui qui amorce ces
 * référentiels — le seed échouerait s'il devait poser un contexte société pour
 * écrire la parité du franc Pacifique, qui n'appartient à aucune société. Les
 * deux sens sont gardés : un référentiel qui perdrait `ENABLE` est un écart,
 * un référentiel qui gagnerait `FORCE` en est un autre.
 *
 * Le classement rendu ici est celui que la base MONTRE, jamais celui que les
 * listes déclarent : une table qui dérive change de groupe dans le rapport en
 * même temps qu'elle fait rougir le verdict, et son nom se lit des deux côtés.
 */
export function rapportRlsDeclaree(observees: readonly EtatRlsTable[]): string {
  const noms = (retenue: (etat: EtatRlsTable) => boolean): string => {
    const tables = observees
      .filter(retenue)
      .map((etat) => etat.table)
      .sort();
    return tables.length === 0 ? "aucune" : tables.join(", ");
  };

  const forcees = observees.filter((etat) => etat.activee && etat.forcee);
  const simples = observees.filter((etat) => etat.activee && !etat.forcee);
  const sans = observees.filter((etat) => !etat.activee);

  return [
    "État déclaré de la sécurité au niveau des lignes (observé, non déclaré)",
    `  ${forcees.length} cloisonnée(s), ENABLE+FORCE : ` +
      `${noms((etat) => etat.activee && etat.forcee)}`,
    `  ${simples.length} référentiel(s) de plateforme, ENABLE seul — jamais ` +
      `FORCE, le propriétaire les amorce (D4) : ` +
      `${noms((etat) => etat.activee && !etat.forcee)}`,
    `  ${sans.length} technique(s) sans RLS (I1, catégories 3 et 4) : ` +
      `${noms((etat) => !etat.activee)}`,
    "",
  ].join("\n");
}
