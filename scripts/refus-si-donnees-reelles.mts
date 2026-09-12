import { PrismaClient } from "@prisma/client";

import {
  rapportHorsSeed,
  verdictHorsSeed,
  type SocieteObservee,
} from "./lib/donnees-hors-seed";
import {
  messageDecompteFiltre,
  prendreIdentiteExemptee,
} from "./lib/identite-exemptee";

/**
 * LA BORNE 3 DE L'AMENDEMENT DU §12 : une exécution AUTOMATIQUE refuse de
 * s'appliquer si la base porte une donnée qui ne vient pas du seed (N1).
 *
 * **Il ne migre rien et n'écrit rien.** Il lit, il prononce, et il sort. Le flux
 * s'arrête sur son code de retour : *un contrôle qui appliquerait lui-même ce
 * qu'il autorise serait juge et partie, et son refus n'aurait plus de témoin.*
 *
 * ## POURQUOI IL PREND UNE IDENTITÉ EXEMPTÉE, ET POURQUOI C'EST LE CŒUR
 *
 * `societe` porte `FORCE ROW LEVEL SECURITY` et la forme « adhésion ». Sous le
 * rôle de migration sans contexte, **la lecture rend zéro ligne** — et un
 * contrôle qui compterait zéro conclurait « aucune société étrangère »,
 * c'est-à-dire **autoriserait la migration automatique sur une base pleine de
 * données réelles**. *Il ne se tromperait pas : il ne regarderait rien*
 * (§9, 07/09). C'est la vacuité dans son sens le plus coûteux, puisqu'elle
 * ouvre au lieu de fermer.
 *
 * Trois pièces, et aucune ne remplace l'autre :
 *   — l'identité exemptée, prise par `SET LOCAL ROLE` (module partagé avec
 *     l'inventaire — une seule lecture de ce critère, §9 du 01/09) ;
 *   — `SET LOCAL row_security = off`, le filet : PostgreSQL REFUSE alors une
 *     lecture qui serait filtrée, au lieu de la filtrer en silence ;
 *   — le verdict « rien observé », qui refuse aussi : zéro société est un état
 *     légitime *et* le symptôme d'une lecture filtrée, et on ne part pas sur un
 *     doute.
 *
 * ## LES CODES DE SORTIE, ET POURQUOI ILS NE SE MÊLENT PAS
 *
 * `0` la base ne porte que le seed — l'automatisation continue.
 * `1` elle porte autre chose — l'automatisation s'arrête, un humain reprend.
 * `75` on n'a pas pu savoir : base injoignable, identité exemptée hors de
 *      portée. **C'est le code de l'exploitation, jamais celui de la sécurité**
 *      — la veille les sépare pour la même raison : *les mêler apprendrait à ne
 *      lire ni l'un ni l'autre.*
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce rapport est une sortie de journal délibérée.
 */

const prisma = new PrismaClient();

try {
  const societes = await prisma.$transaction(async (tx) => {
    const identite = await prendreIdentiteExemptee(tx);
    try {
      await tx.$executeRawUnsafe("SET LOCAL row_security = off");
      return await tx.$queryRawUnsafe<SocieteObservee[]>(
        `SELECT "id"::text, "code", "raison_sociale" FROM "societe" ORDER BY "code"`,
      );
    } catch (erreur) {
      // Le filet a joué : l'identité prise est finalement soumise à une
      // politique. On ne rend pas un décompte filtré — on refuse de conclure.
      throw new Error(`${messageDecompteFiltre(identite)}\n${String(erreur)}`);
    }
  });

  const verdict = verdictHorsSeed(societes);
  process.stdout.write(`${rapportHorsSeed(verdict)}\n`);
  await prisma.$disconnect();
  process.exit(verdict.verdict === "seed_seul" ? 0 : 1);
} catch (erreur) {
  // NI 0 NI 1 : « je n'ai pas pu regarder » n'est ni une autorisation ni un
  // refus fondé, et le confondre avec l'un des deux est exactement ce que les
  // deux rouges distincts de la veille évitent.
  process.stdout.write(
    "La base n'a pas pu être interrogée : aucun verdict n'est rendu, et " +
      "l'exécution automatique ne se poursuit pas.\n" +
      `${String(erreur)}\n`,
  );
  await prisma.$disconnect().catch(() => undefined);
  process.exit(75);
}
