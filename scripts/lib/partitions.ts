import { PrismaClient } from "@prisma/client";

import type { EtatPartitions } from "@/lib/db/partitions";

import { urlBase } from "./feries";

/**
 * Lecture de l'état des partitions du journal d'audit — partagée par le
 * CONTRÔLE et par l'EXTENSION (ticket L0-10).
 *
 * Deux scripts, une seule lecture : `scripts/audit-partitions.mts` constate et
 * échoue, `scripts/etendre-partitions.mts` corrige. C'est le montage des jours
 * fériés (D46, complément 3), et pour la même raison — écrire la lecture deux
 * fois serait la meilleure façon d'obtenir un contrôle et une correction qui ne
 * parlent pas du même horizon.
 *
 * `urlBase()` est réutilisée telle quelle : la préséance des variables
 * d'environnement — `HORIZON_DATABASE_URL`, puis `TEST_DATABASE_URL` AVANT
 * `DATABASE_URL` — a été arrêtée pour l'horizon des fériés, et une seconde
 * règle de préséance serait une seconde façon de viser la base hébergée par
 * mégarde.
 */

/** Ouvre un client sur la base visée. */
export function clientPartitions(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: urlBase() } } });
}

/**
 * L'état des partitions, lu en base.
 *
 * **Trois lectures, et aucune ne repose sur le nom des tables.** Les mois
 * couverts viennent de `journal_audit_partitions_couvertes()`, la fonction que
 * pose la migration : elle lit les BORNES réelles des partitions. Un nom est
 * une commodité, il peut mentir ; une borne, non. Et la convention de découpage
 * reste à un seul endroit — celui qui crée les partitions.
 *
 * Le mois courant est lu sur l'horloge de la BASE, jamais sur celle de Node :
 * ce sont les bornes de la base qui décident où une ligne tombe, et un contrôle
 * qui comparerait deux horloges échouerait une nuit sur trente.
 */
export async function lireEtatPartitions(
  prisma: PrismaClient,
): Promise<EtatPartitions> {
  const [horloge] = await prisma.$queryRawUnsafe<{ mois: string }[]>(
    "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AS mois",
  );

  const couverts = await prisma.$queryRawUnsafe<{ mois: string }[]>(
    'SELECT mois FROM "journal_audit_partitions_couvertes"() ORDER BY mois',
  );

  const [defaut] = await prisma.$queryRawUnsafe<{ presente: boolean }[]>(
    `SELECT count(*) > 0 AS presente
       FROM pg_catalog.pg_class
      WHERE relname = 'journal_audit_defaut' AND relkind = 'r'`,
  );

  // `ONLY` : on compte ce que la partition PAR DÉFAUT contient, pas ce que le
  // parent contient. Sans lui, on compterait tout le journal et le contrôle
  // détectif échouerait dès la première ligne écrite.
  const lignes =
    (defaut?.presente ?? false)
      ? await prisma.$queryRawUnsafe<{ lignes: bigint }[]>(
          'SELECT count(*) AS lignes FROM ONLY "journal_audit_defaut"',
        )
      : [];

  return {
    moisCourant: horloge?.mois ?? "",
    moisCouverts: couverts.map((ligne) => ligne.mois),
    defautPresente: defaut?.presente ?? false,
    lignesParDefaut: Number(lignes[0]?.lignes ?? 0),
  };
}

/** Ligne de rapport — ce qui a été observé, avant tout verdict. */
export function ligneEtat(etat: EtatPartitions): string {
  const dernier = etat.moisCouverts[etat.moisCouverts.length - 1] ?? "(aucun)";
  return [
    `  mois courant (UTC)   : ${etat.moisCourant}`,
    `  partitions couvertes : ${etat.moisCouverts.length}, jusqu'à ${dernier}`,
    `  partition par défaut : ${
      etat.defautPresente
        ? `présente, ${etat.lignesParDefaut} ligne(s)`
        : "ABSENTE"
    }`,
  ].join("\n");
}
