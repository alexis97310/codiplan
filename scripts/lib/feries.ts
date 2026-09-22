import { PrismaClient } from "@prisma/client";

import {
  cleJour,
  comparerJours,
  lireCleJour,
  maintenant,
  type EtatHorizon,
  type JourLocal,
} from "@/lib/calendar";

import {
  messageDecompteFiltre,
  prendreIdentiteExemptee,
  type GesteExempte,
} from "./identite-exemptee";

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

/**
 * Le geste, tel que le refus d'identité le nomme : la variable est la PREMIÈRE
 * que `urlBase()` regarde — celle que le flux d'amorçage alimente.
 */
const GESTE_HORIZON: GesteExempte = {
  nom: "Lecture des agences pour l'horizon des fériés",
  variable: "HORIZON_DATABASE_URL",
};

/**
 * Les agences de la base, avec leur territoire et leur fuseau effectif —
 * TOUTES les agences, de TOUTES les sociétés, ou un refus. Jamais zéro par
 * filtrage.
 *
 * ## LE DÉFAUT REFERMÉ ICI (FERIES-1, 22/09/2026)
 *
 * `agence` porte `FORCE ROW LEVEL SECURITY`. Cette fonction la lisait sans
 * contexte ni identité exemptée : sous un rôle ni superutilisateur ni
 * `BYPASSRLS` — le propriétaire de migration tel qu'un hébergeur le donne —,
 * elle rendait ZÉRO ligne, sans erreur, et les deux scripts concluaient
 * « aucun territoire n'est rattaché à une agence ». Mesuré sur la base de
 * production : une agence en base, zéro lue, le bouton du flux d'amorçage
 * refusait. *Il ne se trompait pas, il ne regardait rien* (§9, 07/09). Le seul
 * environnement où le défaut existait est celui que `verify:full` ne joue
 * jamais — poste et CI lisent en superutilisateur.
 *
 * **Le vrai défaut n'était pas le zéro, c'était le silence** : une base qui
 * porte une agence et une base dont on ne voit pas les agences rendaient le
 * MÊME message. Ce fichier disait déjà, à propos de l'URL, qu'un contrôle muet
 * ressemble trop à un contrôle réussi — et laissait passer celui-ci.
 *
 * ## L'ARBITRAGE : UNE IDENTITÉ EXEMPTÉE, PAS UN CONTEXTE SOCIÉTÉ PAR SOCIÉTÉ
 *
 * Deux issues étaient possibles, et c'est la MESURE qui tranche, pas le goût :
 *
 * 1. **Poser `app.societe_id` société par société** et réunir les agences. Ce
 *    chemin exige d'abord d'ÉNUMÉRER les sociétés — et `societe` est elle-même
 *    cloisonnée, forcée, en forme « adhésion » : sans contexte, elle rend zéro
 *    ligne au même rôle (`tests/isolation/cloisonnement-societe.test.ts`). Il
 *    faudrait donc une identité exemptée pour lire la liste des sociétés avant
 *    de poser leur contexte une à une — l'exemption est de toute façon
 *    nécessaire, et ce chemin ne fait qu'y ajouter N transactions de plus.
 *    Il a aussi le tort de dire le faux : les fériés sont un fait de
 *    TERRITOIRE (D46), ils traversent les sociétés par nature, et un script qui
 *    les lirait société par société laisserait croire qu'une société en décide.
 *
 * 2. **Exiger une identité exemptée des politiques**, prise le temps d'UNE
 *    transaction de lecture — et REFUSER de conclure à défaut. C'est le
 *    mécanisme que `scripts/inventaire.mts` et `refus-si-donnees-reelles.mts`
 *    emploient déjà, écrit une fois dans `scripts/lib/identite-exemptee.ts` :
 *    trois pièces, dont aucune ne remplace l'autre — l'identité (le rôle
 *    connecté s'il est exempté, sinon un rôle exempté dont il est membre, par
 *    `SET LOCAL ROLE`) ; le FILET `row_security = off`, sous lequel PostgreSQL
 *    REFUSE une lecture qui serait filtrée au lieu de la filtrer en silence ;
 *    et le refus, qui nomme le rôle, la base, la variable à alimenter.
 *
 * Le 2 est retenu. Aucune politique n'est touchée, aucun `BYPASSRLS` n'est posé
 * sur le rôle applicatif, et l'invariant de cloisonnement passe avant le
 * confort du script : sur une base où AUCUNE identité exemptée n'est
 * accessible au rôle connecté, le script s'arrête et le dit — il n'invente ni
 * territoire, ni vide.
 *
 * `lib/db/garde-role.ts` n'était pas le bon outil : il juge un rôle pour un
 * USAGE — applicatif, consolidation — et refuse ; il ne sait pas prendre une
 * identité, et l'usage ici n'est ni l'un ni l'autre. La sonde `/sante`, elle,
 * nomme un état à un humain qui l'ouvre ; ce script tourne sans écran.
 *
 * **L'identité meurt avec la transaction.** L'extension écrit ensuite dans
 * `jour_ferie` sous le rôle CONNECTÉ — propriétaire ou éditeur (D46) —, et non
 * sous l'identité exemptée, qui n'a, chez un hébergeur, que `SELECT`. Un rôle
 * capable d'écrire ET de contourner les politiques n'est pas ce qu'on prend.
 *
 * **Condition de réouverture** : si un jour un rôle de migration hébergé n'a
 * accès à AUCUN rôle exempté lisant les tables — ni `SUPERUSER`, ni
 * `BYPASSRLS`, ni membre —, ce script refusera sur cet hébergeur, et il faudra
 * ou bien un rôle dédié en lecture (à créer par migration, comme
 * `codiplan_reporting`), ou bien rouvrir le chemin 1. Le refus le dira en
 * nommant le rôle et la base.
 */
export async function lireAgences(
  prisma: PrismaClient,
): Promise<AgenceHorizon[]> {
  return prisma.$transaction(async (tx) => {
    const identite = await prendreIdentiteExemptee(tx, GESTE_HORIZON);

    // Le filet : sous ce réglage, PostgreSQL lève au lieu de filtrer. Posé
    // APRÈS la bascule d'identité, et `SET LOCAL` retombe au COMMIT.
    await tx.$executeRawUnsafe("SET LOCAL row_security = off");

    try {
      return await tx.agence.findMany({
        where: { actif: true },
        select: {
          code: true,
          territoire: true,
          fuseau_horaire: true,
          societe: { select: { code: true, fuseau_horaire: true } },
        },
        orderBy: [{ territoire: "asc" }, { code: "asc" }],
      });
    } catch (erreur) {
      if (/row.?level security|row security/i.test(String(erreur))) {
        throw new Error(messageDecompteFiltre(identite, GESTE_HORIZON), {
          cause: erreur,
        });
      }
      throw erreur;
    }
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
