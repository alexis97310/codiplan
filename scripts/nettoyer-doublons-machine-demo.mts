import { PrismaClient } from "@prisma/client";

import { instructionContexte } from "@/lib/db/rls";

import {
  rapportHorsSeed,
  verdictHorsSeed,
  type SocieteObservee,
} from "./lib/donnees-hors-seed";
import {
  planDeNettoyage,
  rapportDoublons,
  totalARetirer,
  type LigneRattachement,
} from "./lib/doublons-machine";
import {
  messageDecompteFiltre,
  prendreIdentiteExemptee,
  type GesteExempte,
} from "./lib/identite-exemptee";

/**
 * `pnpm db:doublons-machine-demo` — RETIRER LES RATTACHEMENTS MACHINE EN TROP
 * de la base de DÉMONSTRATION (P3009, ticket 9CU-DEMO-DOUBLONS-MACHINE).
 *
 * Porté par le flux GitHub « DB doublons machine — démonstration »,
 * déclenché À LA MAIN uniquement. La base de démonstration est bloquée
 * (P3009) depuis le 23/09/2026 sur `20260923130000_parcours_1_creer_puis_planifier` :
 * cette migration pose « une intervention ne porte qu'une machine au plus »,
 * et REFUSE de s'appliquer tant que des lignes existantes l'enfreignent — en
 * nommant son propre commentaire, « le rattrapage appartient à l'exploitation ».
 * Ce script EST ce rattrapage.
 *
 * ## CE QU'IL NE FAIT JAMAIS
 *
 * Il ne lève JAMAIS `FORCE ROW LEVEL SECURITY`, ne le désactive jamais : le
 * cloisonnement n'est assoupli à aucun moment, pas même le temps d'une
 * transaction. La LECTURE prend une identité exemptée des politiques (seule
 * façon de voir la vérité sur une table qui porte `FORCE ROW LEVEL SECURITY` —
 * sans elle, la lecture rend zéro ligne et « aucun doublon » serait un
 * silence, pas une observation). L'ÉCRITURE, elle, se fait sous le rôle
 * CONNECTÉ, avec le contexte de chaque société posé comme le fait
 * `lib/db/rls.ts` : la politique « cloisonnement_filiation » l'autorise alors
 * exactement comme elle autoriserait le rôle applicatif.
 *
 * ## LES QUATRE REFUS
 *
 *   — l'identité exemptée est hors de portée : rien n'a pu être lu, code `75` ;
 *   — la base porte une société hors du seed (borne 3 de l'amendement du §12,
 *     réutilisée ici à l'identique) : code `1`, rien n'est écrit ;
 *   — une ligne en doublon ne porte pas un identifiant du jeu de démonstration :
 *     code `1`, aucun plan n'est proposé ;
 *   — après application, le nombre de lignes retirées ne correspond pas au
 *     plan, ou le témoin voit encore un doublon : `75`, la transaction est
 *     annulée (dans le premier cas) ou l'anomalie est signalée (dans le second).
 *
 * Sans `APPLIQUER=oui`, le script est PUREMENT LECTURE : il imprime le plan et
 * s'arrête, code `0`.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

const GESTE: GesteExempte = {
  nom: "Lecture des rattachements machine",
  variable: "MIGRATION_DATABASE_URL",
};

const GESTE_SUIVANT =
  "GESTE SUIVANT, et il n'est pas automatique :\n" +
  "  1. DB resolve (cible démonstration, migration " +
  "20260923130000_parcours_1_creer_puis_planifier)\n" +
  "  2. DB migrate & seed (démonstration, reinitialiser_demo décoché)\n";

const SQL_SOCIETES = `SELECT "id"::text, "code", "raison_sociale" FROM "societe" ORDER BY "code"`;

const SQL_RATTACHEMENTS = `
  SELECT "id"::text, "societe_id"::text, "intervention_id"::text, "machine_id"::text
  FROM "intervention_machine"
  ORDER BY "id"
`;

/** Lit, sous une identité exemptée et `row_security = off`, l'état réel de la base. */
async function lireEtatBase(prisma: PrismaClient): Promise<{
  societes: SocieteObservee[];
  lignes: LigneRattachement[];
}> {
  return prisma.$transaction(async (tx) => {
    const identite = await prendreIdentiteExemptee(tx, GESTE);
    try {
      await tx.$executeRawUnsafe("SET LOCAL row_security = off");
      const societes =
        await tx.$queryRawUnsafe<SocieteObservee[]>(SQL_SOCIETES);
      const lignes =
        await tx.$queryRawUnsafe<LigneRattachement[]>(SQL_RATTACHEMENTS);
      return { societes, lignes };
    } catch (erreur) {
      // Le filet a joué : l'identité prise est finalement soumise à une
      // politique. On ne rend pas un décompte filtré — on refuse de conclure.
      throw new Error(
        `${messageDecompteFiltre(identite, GESTE)}\n${String(erreur)}`,
      );
    }
  });
}

const prisma = new PrismaClient();

try {
  const { societes, lignes } = await lireEtatBase(prisma);

  const verdictSeed = verdictHorsSeed(societes);
  process.stdout.write(`${rapportHorsSeed(verdictSeed)}\n\n`);
  if (verdictSeed.verdict !== "seed_seul") {
    process.stdout.write(
      "REFUSÉ — rien n'a été lu ni écrit sur « intervention_machine ».\n",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const plan = planDeNettoyage(lignes);
  process.stdout.write(`${rapportDoublons(plan)}\n`);

  if (plan.verdict === "hors_semis") {
    await prisma.$disconnect();
    process.exit(1);
  }

  if (plan.verdict === "aucun_doublon") {
    process.stdout.write(`\n${GESTE_SUIVANT}`);
    await prisma.$disconnect();
    process.exit(0);
  }

  if (process.env.APPLIQUER !== "oui") {
    process.stdout.write(
      "\nLecture seule : AUCUNE ligne n'a été retirée. " +
        "Relancer avec APPLIQUER=oui pour appliquer ce plan ; le geste suivant " +
        "(DB resolve puis DB migrate & seed) attend que ce retrait soit fait.\n",
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  const attendu = totalARetirer(plan);
  const supprimees = await prisma.$transaction(async (tx) => {
    let compte = 0;
    for (const groupe of plan.groupes) {
      const societeId = groupe.gardee.societe_id;
      const ids = groupe.retirees.map((ligne) => ligne.id);
      // Le cloisonnement n'est JAMAIS désactivé : on pose le contexte de
      // CETTE société, exactement comme le fait `lib/db/rls.ts` sur le chemin
      // de production, et c'est la politique « cloisonnement_filiation » qui
      // autorise — ou refuserait — la suppression.
      const { sql, parametres } = instructionContexte({
        societeId,
        role: null,
      });
      await tx.$executeRawUnsafe(sql, ...parametres);
      const resultat = await tx.interventionMachine.deleteMany({
        where: { id: { in: ids }, societe_id: societeId },
      });
      compte += resultat.count;
    }
    if (compte !== attendu) {
      // TÉMOIN DANS LA TRANSACTION : lever ici annule tout ce qui précède.
      throw new Error(
        `${compte} ligne(s) supprimée(s) au lieu des ${attendu} attendues : ` +
          "annulation, rien n'est resté retiré.",
      );
    }
    return compte;
  });

  process.stdout.write(`\n${supprimees} ligne(s) retirée(s).\n`);

  // TÉMOIN hors transaction : relecture sous la même identité exemptée.
  const { lignes: apres } = await lireEtatBase(prisma);
  const planApres = planDeNettoyage(apres);
  if (planApres.verdict !== "aucun_doublon") {
    throw new Error(
      "Après nettoyage, une anomalie demeure :\n" + rapportDoublons(planApres),
    );
  }

  process.stdout.write(
    `\nTémoin : aucune intervention ne porte plus d'une machine.\n\n${GESTE_SUIVANT}`,
  );
  await prisma.$disconnect();
} catch (erreur) {
  // NI 0 NI 1 : une anomalie après lecture réussie n'est ni une confirmation
  // ni un refus fondé sur l'état observé — c'est l'exploitation qui reprend.
  process.stdout.write(`${String(erreur)}\n`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(75);
}
