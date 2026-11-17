import type { PolitiqueObservee } from "./politiques-rls";

/**
 * LA BRÈCHE REFERMÉE PAR 9J22A, ET SON ÉTAT SURVEILLÉ (décision d'Alexis du
 * 10/11/2026).
 *
 * `9J22` avait ouvert au portail la lecture de la ligne `utilisateur` d'un
 * technicien (politique `utilisateur_lecture_filiation_portail`) ; `9J22A` l'a
 * refermée et a déplacé ce qu'un bon affiche réellement — un nom, rien
 * d'autre — sur `segment_travail.nom_technicien_affiche`, recopié une seule
 * fois à la création du segment. Si une base avait vu `9J22` sans `9J22A`, ou
 * si la politique revenait par un geste qui ne passe pas par une migration,
 * rien ne le disait avant ce module.
 *
 * Deux garanties, deux contrôles catalogue — aucun ne lit de ligne de donnée,
 * exactement comme le reste de `pnpm veille` : la politique ne doit pas
 * exister, la colonne de recopie doit rester `NOT NULL`.
 */

export const TABLE_PORTAIL_FILIATION = "utilisateur";
export const POLITIQUE_PORTAIL_FILIATION_RETIREE =
  "utilisateur_lecture_filiation_portail";

/**
 * Écart : la politique retirée par 9J22A est revenue sur `utilisateur`.
 *
 * `politiques` vient de `SQL_POLITIQUES` (`scripts/lib/politiques-rls.ts`),
 * déjà lu par la veille pour les formes de politique — aucune requête de plus.
 */
export function ecartsPolitiquePortailFiliationRetiree(
  politiques: readonly PolitiqueObservee[],
): string[] {
  if (politiques.length === 0) {
    return [
      "aucune politique observée : la surveillance de " +
        `« ${POLITIQUE_PORTAIL_FILIATION_RETIREE} » n'a rien gardé. Un ` +
        "décompte nul ressemble toujours à un sans-faute.",
    ];
  }

  const revenue = politiques.find(
    (p) =>
      p.table === TABLE_PORTAIL_FILIATION &&
      p.nom === POLITIQUE_PORTAIL_FILIATION_RETIREE,
  );
  if (revenue === undefined) {
    return [];
  }

  return [
    `la politique « ${POLITIQUE_PORTAIL_FILIATION_RETIREE} » existe de ` +
      `nouveau sur « ${TABLE_PORTAIL_FILIATION} ». Décision d'Alexis du ` +
      "10/11/2026 (9J22A) : cette politique a été retirée parce qu'elle " +
      "ouvrait toute la ligne d'un technicien (dont son adresse " +
      "électronique) à un compte portail. Sa réapparition — par une " +
      "migration qui la recrée ou par un geste joué à la main — rouvre " +
      "cette brèche.",
  ];
}

export function rapportPolitiquePortailFiliationRetiree(
  politiques: readonly PolitiqueObservee[],
): string {
  const presente = politiques.some(
    (p) =>
      p.table === TABLE_PORTAIL_FILIATION &&
      p.nom === POLITIQUE_PORTAIL_FILIATION_RETIREE,
  );
  return (
    `Politique « ${POLITIQUE_PORTAIL_FILIATION_RETIREE} » sur ` +
    `« ${TABLE_PORTAIL_FILIATION} » (9J22A, observée dans pg_policies) : ` +
    `${presente ? "PRÉSENTE — devrait être absente" : "absente, comme attendu"}.\n`
  );
}

export const TABLE_NOM_TECHNICIEN_AFFICHE = "segment_travail";
export const COLONNE_NOM_TECHNICIEN_AFFICHE = "nom_technicien_affiche";

/**
 * La colonne de recopie, telle que le catalogue la porte — même forme que
 * `SQL_COLONNE_SOCIETE` de `politiques-rls.ts`.
 */
export const SQL_COLONNE_NOM_TECHNICIEN_AFFICHE = `
  SELECT "c"."relname"::text               AS "table",
         ("a"."attname" IS NOT NULL)       AS "presente",
         COALESCE("a"."attnotnull", false) AS "obligatoire"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
    LEFT JOIN "pg_catalog"."pg_attribute" "a"
           ON "a"."attrelid" = "c"."oid"
          AND "a"."attname" = 'nom_technicien_affiche'
          AND NOT "a"."attisdropped"
   WHERE "n"."nspname" = 'public'
     AND "c"."relname" = 'segment_travail'
`;

export type ColonneNomTechnicienAffiche = {
  readonly table: string;
  readonly presente: boolean;
  readonly obligatoire: boolean;
};

/**
 * Écart : la colonne de recopie a disparu, ou n'est plus `NOT NULL`.
 *
 * **Ce que ce contrôle mesure, et ce qu'il ne mesure PAS.** La veille tourne
 * sous le rôle applicatif, en lecture seule et SANS contexte société posé
 * (`contexte-rls.ts`) — une lecture de `segment_travail` elle-même y rend
 * zéro ligne par construction (la forme « interne » de I1, D94), et ce zéro
 * ne prouverait jamais qu'aucune ligne n'y porte de valeur vide. Ce que le
 * catalogue montre, lui, ne dépend d'aucun contexte : si la colonne reste
 * `NOT NULL`, aucune ligne — nouvelle ou déjà en base — ne peut porter
 * `NULL`. Un `ALTER TABLE … DROP NOT NULL` joué à la main, hors migration,
 * est exactement le geste que ce contrôle catalogue est en mesure de voir.
 */
export function ecartsNomTechnicienAfficheObligatoire(
  colonnes: readonly ColonneNomTechnicienAffiche[],
): string[] {
  if (colonnes.length === 0) {
    return [
      "aucune table observée : la surveillance de " +
        `« ${TABLE_NOM_TECHNICIEN_AFFICHE}.${COLONNE_NOM_TECHNICIEN_AFFICHE} » ` +
        "n'a rien gardé. Un décompte nul ressemble toujours à un sans-faute.",
    ];
  }

  const [ligne] = colonnes;
  if (ligne === undefined || !ligne.presente) {
    return [
      `« ${TABLE_NOM_TECHNICIEN_AFFICHE} » ne porte plus de colonne ` +
        `« ${COLONNE_NOM_TECHNICIEN_AFFICHE} » (9J22A). C'est elle, et elle ` +
        "seule, que le bon du portail lit pour le nom du technicien — sans " +
        "jamais ouvrir `utilisateur` à un contexte client.",
    ];
  }

  if (!ligne.obligatoire) {
    return [
      `« ${TABLE_NOM_TECHNICIEN_AFFICHE}.${COLONNE_NOM_TECHNICIEN_AFFICHE} » ` +
        "n'est plus `NOT NULL`. 9J22A posait cette contrainte précisément " +
        "pour qu'aucun segment ne puisse exister sans son nom affiché ; " +
        "sans elle, une ligne peut porter la colonne vide (`NULL`), et rien " +
        "en base ne le refuse.",
    ];
  }

  return [];
}

export function rapportNomTechnicienAfficheObligatoire(
  colonnes: readonly ColonneNomTechnicienAffiche[],
): string {
  const [ligne] = colonnes;
  return (
    `Colonne « ${TABLE_NOM_TECHNICIEN_AFFICHE}.${COLONNE_NOM_TECHNICIEN_AFFICHE} » ` +
    "(9J22A, observée dans pg_attribute) : " +
    `${
      ligne === undefined || !ligne.presente
        ? "INTROUVABLE"
        : `NOT NULL=${ligne.obligatoire}`
    }.\n`
  );
}
