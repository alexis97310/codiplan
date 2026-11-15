/**
 * EXEMPTION DES DEUX FONCTIONS D'IDENTITÉ — mesure partagée par `pnpm veille`
 * et `/api/sante` (une lecture, deux rendus — R3-01, sur le modèle de
 * `SQL_TENTATIVES` dans `lib/db/sante.ts`).
 *
 * Décision d'Alexis du 10/11/2026 : `app_identite_exclusive_a_la_societe`
 * (D226) et `app_identite_interne_ailleurs` (D233) ne répondent sur la base
 * hébergée QUE parce que leur propriétaire est exempté des politiques
 * (`rolbypassrls` ou superutilisateur) et que `prosecdef`, `search_path` et
 * `row_security` restent ceux posés par leur migration. Les deux migrations
 * restent SÛRES si ce propriétaire change (la fonction LÈVE plutôt que de
 * filtrer en silence — c'est tout l'objet de leur `SET row_security = off`),
 * mais chaque appel applicatif retomberait alors sur un refus, SANS qu'aucune
 * alarme ne le dise. Cette mesure rend cette dérive bruyante plutôt que
 * silencieuse.
 *
 * Lecture SANS privilège particulier : `pg_proc`, `pg_roles` et
 * `pg_namespace` sont lisibles par tout rôle connecté — c'est ce qui permet au
 * rôle applicatif, le seul que `/api/sante` et la veille nocturne portent, de
 * la jouer sans GRANT supplémentaire (mesuré sous `codiplan_app` sur la base
 * de test).
 */

/** Les deux fonctions SECURITY DEFINER arbitrées (D226, D233) — liste close. */
export const FONCTIONS_IDENTITE = [
  "app_identite_exclusive_a_la_societe",
  "app_identite_interne_ailleurs",
] as const;

/** Les réglages posés par les deux migrations — toute autre valeur est un écart. */
export const SEARCH_PATH_ATTENDU = "pg_catalog, public";
export const ROW_SECURITY_ATTENDU = "off";

const LISTE_FONCTIONS = FONCTIONS_IDENTITE.map((nom) => `'${nom}'`).join(", ");

/**
 * La requête, écrite une seule fois. Les deux noms interpolés sont les
 * CONSTANTES ci-dessus, jamais une entrée venue de l'appelant.
 */
export const SQL_FONCTIONS_IDENTITE = `
  SELECT "p"."proname"::text          AS "fonction",
         "own"."rolname"::text        AS "proprietaire",
         "own"."rolbypassrls"         AS "proprietaire_contourne_rls",
         "own"."rolsuper"             AS "proprietaire_superutilisateur",
         "p"."prosecdef"              AS "securite_definer",
         "p"."proconfig"::text[]      AS "reglages"
    FROM "pg_catalog"."pg_proc" "p"
    JOIN "pg_catalog"."pg_roles" "own" ON "own"."oid" = "p"."proowner"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "p"."pronamespace"
   WHERE "n"."nspname" = 'public'
     AND "p"."proname" IN (${LISTE_FONCTIONS})
   ORDER BY "p"."proname"
`;

/** Une ligne brute, telle que la requête la rend. */
export type LigneFonctionIdentite = {
  fonction: string;
  proprietaire: string;
  proprietaire_contourne_rls: boolean;
  proprietaire_superutilisateur: boolean;
  securite_definer: boolean;
  reglages: string[] | null;
};

/** Lit UN réglage (`clef=valeur`) dans le tableau `proconfig` ; `null` s'il est absent. */
function reglage(
  reglages: readonly string[] | null,
  clef: string,
): string | null {
  for (const brut of reglages ?? []) {
    const separateur = brut.indexOf("=");
    if (separateur === -1) {
      continue;
    }
    if (brut.slice(0, separateur) === clef) {
      return brut.slice(separateur + 1);
    }
  }
  return null;
}

/** L'état d'UNE fonction, réduit à ce que ce contrôle juge. */
export type EtatFonctionIdentite = {
  fonction: string;
  /** Le propriétaire contourne les politiques (`BYPASSRLS` ou superutilisateur). */
  exempte: boolean;
  /** `SECURITY DEFINER`, `search_path` et `row_security` sont ceux de la migration. */
  reglagesSurs: boolean;
};

export function etatsFonctionsIdentite(
  lignes: readonly LigneFonctionIdentite[],
): EtatFonctionIdentite[] {
  return lignes.map((ligne) => ({
    fonction: ligne.fonction,
    exempte:
      ligne.proprietaire_contourne_rls || ligne.proprietaire_superutilisateur,
    reglagesSurs:
      ligne.securite_definer &&
      reglage(ligne.reglages, "search_path") === SEARCH_PATH_ATTENDU &&
      reglage(ligne.reglages, "row_security") === ROW_SECURITY_ATTENDU,
  }));
}

/**
 * VRAI seulement si les DEUX fonctions attendues sont observées, leur
 * propriétaire exempté et leurs réglages intacts. L'absence d'une fonction
 * (migration non jouée, nom changé) vaut « non sûr », jamais « rien à
 * signaler » — même refus que les décomptes de `lib/db/sante.ts`.
 */
export function exemptionFonctionsIdentiteOk(
  etats: readonly EtatFonctionIdentite[],
): boolean {
  return FONCTIONS_IDENTITE.every((nom) =>
    etats.some(
      (etat) => etat.fonction === nom && etat.exempte && etat.reglagesSurs,
    ),
  );
}
