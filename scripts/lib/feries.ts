import { PrismaClient } from "@prisma/client";

import {
  cleJour,
  comparerJours,
  lireCleJour,
  maintenant,
  type EtatHorizon,
  type JourLocal,
} from "@/lib/calendar";

/**
 * Lecture de l'horizon des jours fériés en base — partagée par le CONTRÔLE et
 * par l'EXTENSION (ticket L0-08 ; D46, complément 3).
 *
 * Deux scripts, une seule lecture : `scripts/horizon-feries.mts` constate et
 * échoue, `scripts/etendre-feries.mts` corrige. Écrire la lecture deux fois
 * serait la meilleure façon d'obtenir un contrôle et une correction qui ne
 * parlent pas du même horizon.
 */

/**
 * URL de connexion, dans l'ordre de préséance.
 *
 * **`HORIZON_DATABASE_URL` d'abord**, et c'est la seule façon de viser
 * délibérément une base hébergée : un contrôle d'exploitation se demande, il ne
 * s'attrape pas.
 *
 * **`TEST_DATABASE_URL` ensuite, AVANT `DATABASE_URL`**, et cet ordre est
 * voulu. `pnpm feries:horizon` est une étape de `verify:full` ; sur le poste
 * d'un développeur dont l'environnement porte l'URL de production, la
 * préséance inverse ferait partir une porte de vérification locale vers la base
 * hébergée. C'est la même prudence que le garde-fou Neon du harnais
 * d'isolation : une vérification ne touche que des bases jetables, sauf
 * demande explicite.
 *
 * Aucune valeur par défaut : sans URL, le contrôle ÉCHOUE plutôt que de passer
 * au vert sans rien avoir lu. Un contrôle muet ressemble beaucoup trop à un
 * contrôle réussi.
 */
export function urlBase(): string {
  const url =
    process.env.HORIZON_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    process.env.MIGRATION_DATABASE_URL ??
    process.env.DATABASE_URL;

  if (url === undefined || url.length === 0) {
    throw new Error(
      "Aucune base à interroger : renseigner HORIZON_DATABASE_URL, " +
        "TEST_DATABASE_URL, MIGRATION_DATABASE_URL ou DATABASE_URL. Le " +
        "contrôle d'horizon refuse de passer au vert sans avoir rien lu.",
    );
  }
  return url;
}

/** Ouvre un client sur la base visée. */
export function clientHorizon(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: urlBase() } } });
}

/**
 * Une agence, réduite à ce dont l'horizon a besoin.
 *
 * `territoire` n'est plus nullable : la colonne est NOT NULL en base depuis
 * L0-09a (D48). Le contrôle « agence sans territoire » a donc disparu — non
 * parce qu'on y renonce, mais parce que PostgreSQL le rend impossible.
 */
type AgenceHorizon = {
  code: string;
  territoire: string;
  fuseau_horaire: string | null;
  societe: { code: string; fuseau_horaire: string };
};

/** Clé `AAAA-MM-JJ` d'une colonne PostgreSQL `date`. */
function cleJourDeDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Les agences de la base, avec leur territoire et leur fuseau effectif. */
export async function lireAgences(
  prisma: PrismaClient,
): Promise<AgenceHorizon[]> {
  return prisma.agence.findMany({
    where: { actif: true },
    select: {
      code: true,
      territoire: true,
      fuseau_horaire: true,
      societe: { select: { code: true, fuseau_horaire: true } },
    },
    orderBy: [{ territoire: "asc" }, { code: "asc" }],
  });
}

/**
 * L'état de l'horizon, territoire par territoire.
 *
 * Le jour de référence est le plus AVANCÉ parmi les agences du territoire :
 * elles peuvent relever de fuseaux différents, et c'est celle qui est déjà le
 * plus loin dans l'année qui fixe l'exigence. Le fuseau vient de l'agence, ou
 * de sa société à défaut (D5) — jamais d'une constante.
 */
export async function lireHorizons(
  prisma: PrismaClient,
  agences: readonly AgenceHorizon[],
): Promise<EtatHorizon[]> {
  const parTerritoire = new Map<
    string,
    { aujourdhui: JourLocal; agences: number }
  >();

  for (const agence of agences) {
    const fuseau = agence.fuseau_horaire ?? agence.societe.fuseau_horaire;
    const aujourdhui = maintenant(fuseau).local;
    const connu = parTerritoire.get(agence.territoire);

    parTerritoire.set(agence.territoire, {
      aujourdhui:
        connu === undefined || comparerJours(aujourdhui, connu.aujourdhui) > 0
          ? aujourdhui
          : connu.aujourdhui,
      agences: (connu?.agences ?? 0) + 1,
    });
  }

  const etats: EtatHorizon[] = [];

  for (const [territoire, resume] of parTerritoire) {
    const dernier = await prisma.jourFerie.findFirst({
      where: { territoire },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    etats.push({
      territoire,
      aujourdhui: resume.aujourdhui,
      agences: resume.agences,
      dernier:
        dernier === null ? null : lireCleJour(cleJourDeDate(dernier.date)),
    });
  }

  return etats.sort((a, b) => a.territoire.localeCompare(b.territoire));
}

/** Rendu lisible d'un état, pour les deux scripts. */
export function ligneEtat(etat: EtatHorizon): string {
  const dernier = etat.dernier === null ? "aucun" : cleJour(etat.dernier);
  return (
    `  ${etat.territoire.padEnd(6)} ${String(etat.agences).padStart(2)} agence(s)` +
    `   dernier férié : ${dernier}`
  );
}
