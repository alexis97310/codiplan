import { PrismaClient } from "@prisma/client";

/**
 * LE DÉNOMBREMENT DES LIGNES QUE LE RATTRAPAGE DE R3-02 DEVRA TRAITER (D104).
 *
 * ## POURQUOI UN DÉNOMBREMENT EST UN TRAVAIL À PART ENTIÈRE
 *
 * D104 a posé `intervention_suspension_a_son_motif` et
 * `intervention_suspension_a_sa_date` en `NOT VALID` : elles valent pour toute
 * ligne **nouvelle ou modifiée**, et les interventions suspendues avant L2-10
 * ne sont pas relues. `scripts/lib/contraintes-non-validees.ts` rend cet état
 * VISIBLE. **Mais visible n'est pas chiffré**, et le backlog l'écrit :
 *
 * > *Un rattrapage dont on ne connaît pas le volume est un rattrapage dont on
 * > ne sait pas s'il coûte une minute ou une semaine.*
 *
 * ## CE MODULE COMPTE. IL NE RÉPARE RIEN, ET IL N'ÉCRIT RIEN.
 *
 * Pas d'`UPDATE`, pas de `VALIDATE CONSTRAINT`, pas de motif générique. *Ce
 * dernier serait exactement l'issue (a) que D104 a écartée, reprise par la
 * porte de service — et elle porterait cette fois sur des données réelles.*
 *
 * ## LES DEUX COLONNES SONT COMPTÉES SÉPARÉMENT, ET CE N'EST PAS DU DÉTAIL
 *
 * Elles ne se rattrapent pas pareil. `suspendue_le` **se reprend** : le journal
 * d'audit porte l'instant du changement de statut (I8), et le lire là est une
 * reprise, jamais une invention. `motif_suspension` **ne se reprend pas** :
 * aucune table ne le porte. *Un total unique ferait croire à un seul travail, et
 * ferait chiffrer le plus cher au prix du moins cher.*
 *
 * ## LA VIOLATION EST COMPTÉE DANS LES DEUX SENS DE LA CONTRAINTE
 *
 * Les deux `CHECK` sont des ÉQUIVALENCES — `(statut = 'suspendue') = (colonne
 * IS NOT NULL)` —, et non des implications. Une ligne **non suspendue qui porte
 * un motif** les viole autant qu'une ligne suspendue qui n'en porte pas. Ne
 * compter que le second sens rendrait un chiffre trop bas, *et il aurait l'air
 * juste.*
 *
 * ## CE QU'IL NE PEUT PAS FAIRE, ET QUI SE DIT
 *
 * `intervention` est sous `FORCE ROW LEVEL SECURITY`. Sous un rôle
 * **propriétaire non superutilisateur** et sans contexte de société, ce
 * dénombrement verrait **zéro ligne** et rendrait un zéro qui n'est pas une
 * mesure (§9, 07/09). Le module **refuse de compter** tant qu'il n'a pas
 * constaté qu'il voit — voir `TemoinDeLecture` ci-dessous. *Un décompte nul
 * ressemble toujours à un sans-faute.*
 */

/** Ce que le dénombrement rend, colonne par colonne. */
export type DenombrementSuspensions = {
  /** Toutes les interventions, quel que soit leur statut. Le témoin du reste. */
  readonly interventions: number;
  /** Celles qui sont au statut `suspendue` aujourd'hui. */
  readonly suspendues: number;
  /** Lignes qui violeraient `intervention_suspension_a_son_motif`. */
  readonly sansMotif: number;
  /** Lignes qui violeraient `intervention_suspension_a_sa_date`. */
  readonly sansDate: number;
  /** Lignes NON suspendues qui portent pourtant l'une ou l'autre colonne. */
  readonly residus: number;
};

/**
 * LE TÉMOIN DE LECTURE — il porte sur le MÉCANISME, jamais sur un décompte.
 *
 * Un décompte légitimement nul le rendrait muet, ce qui est précisément le cas
 * qu'on veut distinguer : *« il n'y a rien à rattraper »* et *« je ne vois
 * rien »* rendent le même zéro.
 */
export type TemoinDeLecture = {
  readonly role: string;
  readonly superutilisateur: boolean;
  readonly forceActif: boolean;
  /** Faux quand le rôle ne peut pas voir les lignes : le compte serait creux. */
  readonly voit: boolean;
};

export const SQL_TEMOIN = `
  SELECT current_user::text AS "role",
         (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS "superutilisateur",
         (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'intervention') AS "forceActif"
`;

export const SQL_DENOMBREMENT = `
  SELECT count(*)::int AS "interventions",
         count(*) FILTER (WHERE statut = 'suspendue')::int AS "suspendues",
         count(*) FILTER (WHERE statut = 'suspendue'
                            AND motif_suspension IS NULL)::int AS "sansMotif",
         count(*) FILTER (WHERE statut = 'suspendue'
                            AND suspendue_le IS NULL)::int AS "sansDate",
         count(*) FILTER (WHERE statut <> 'suspendue'
                            AND (motif_suspension IS NOT NULL
                                 OR suspendue_le IS NOT NULL))::int AS "residus"
  FROM "intervention"
`;

/**
 * Le rôle voit-il les lignes de `intervention` ?
 *
 * Trois cas, et un seul permet de compter : un **superutilisateur** contourne
 * RLS ; un rôle sous `FORCE` inactif voit tout ; sinon, il ne voit que ce que
 * le contexte lui donne — c'est-à-dire rien sans contexte.
 */
export function lectureFiable(temoin: {
  readonly superutilisateur: boolean;
  readonly forceActif: boolean;
}): boolean {
  return temoin.superutilisateur || !temoin.forceActif;
}

/** Le rapport, une ligne par chiffre. Aucun secret : ni hôte, ni base (D50). */
export function rapport(
  d: DenombrementSuspensions,
  temoin: TemoinDeLecture,
): string {
  return [
    "── R3-02 — les suspensions antérieures à L2-10 ──────────",
    `  rôle de lecture          : ${temoin.role}` +
      (temoin.superutilisateur ? " (superutilisateur)" : "") +
      (temoin.forceActif ? " — FORCE actif sur « intervention »" : ""),
    `  interventions au total   : ${d.interventions}`,
    `  au statut « suspendue »  : ${d.suspendues}`,
    "",
    `  SANS MOTIF               : ${d.sansMotif}   ← ne se reprend PAS : aucune table ne le porte`,
    `  SANS DATE                : ${d.sansDate}   ← se reprend depuis le journal d'audit (I8)`,
    `  résidus hors suspension  : ${d.residus}   ← non suspendues portant l'une des deux colonnes`,
    "",
    "  Ce dénombrement NE RÉPARE RIEN : R3-02 exige qu'un humain énonce",
    "  chaque motif, intervention par intervention. Un motif générique serait",
    "  l'issue (a) que D104 a écartée, reprise par la porte de service.",
    "",
    "  ET UN ZÉRO NE SE LIT PAS COMME « C'EST FAIT ». Une base bâtie depuis",
    "  zéro par « prisma migrate deploy » ne PEUT pas porter de violation : la",
    "  contrainte y précède la première ligne, et NOT VALID refuse ensuite",
    "  toute écriture fautive (mesuré — un UPDATE qui retire un motif est",
    "  REJETÉ). Le seul chiffre qui décide du coût du rattrapage est celui de",
    "  la base qui portait déjà des interventions « suspendue » AVANT la",
    "  migration 20260913160000_suspension_l2_10.",
    "",
  ].join("\n");
}

/** Ouvre un client sur la base visée, sans jamais choisir la production. */
export function clientDenombrement(): PrismaClient {
  const url =
    process.env.DENOMBREMENT_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    process.env.MIGRATION_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error(
      "Aucune base à interroger : renseigner DENOMBREMENT_DATABASE_URL, " +
        "TEST_DATABASE_URL, MIGRATION_DATABASE_URL ou DATABASE_URL. Le " +
        "dénombrement refuse de rendre un zéro sans avoir rien lu.",
    );
  }
  return new PrismaClient({ datasources: { db: { url } } });
}
