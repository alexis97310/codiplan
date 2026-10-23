import { Prisma, type NatureNumerotation } from "@prisma/client";

import { anneeCourante, type Fuseau } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

/**
 * LA NUMÉROTATION SERVEUR — INT-AAAA-NNNN / DEM-AAAA-NNNN
 * (9H2-NUMEROTATION-INTERVENTIONS, D135).
 *
 * **Repart à 1 chaque année CIVILE, au fuseau de la SOCIÉTÉ** — jamais UTC,
 * et jamais un territoire écrit en dur (L0-08, I7) : *le fuseau appartient à
 * l'agence/la société, pas à la plateforme* — la solution est destinée à
 * être vendue (chapitre 20), et une société métropolitaine numéroterait
 * sinon selon l'horloge de Nouméa. `anneeDeNumerotation` ne lit JAMAIS
 * l'horloge elle-même : le fuseau lui est un PARAMÈTRE — une DONNÉE
 * (`societe.fuseau_horaire`, lue par l'appelant, même geste que
 * `prisma/seed-data.ts`, `anneeCourante(societe.fuseau_horaire)`) — et
 * `prochainNumero` ne reçoit que l'année déjà résolue, même doctrine que
 * `lib/demandes/accuse.ts` (D85) : sinon un scénario deviendrait vert ou
 * rouge parce que l'horloge a tourné pendant qu'il s'exécutait.
 *
 * **Le compteur fait foi, jamais `MAX(numero) + 1`** : deux transactions qui
 * liraient le même maximum avant d'écrire poseraient le même numéro. `UPDATE
 * … SET dernier_numero = dernier_numero + 1` est une écriture ATOMIQUE — Post-
 * greSQL sérialise les écritures concurrentes sur la même ligne, la seconde
 * voit le résultat committé de la première. Le PREMIER appel de l'année, en
 * revanche, ne trouve AUCUNE ligne : `update` lève alors `P2025`
 * (enregistrement absent), rattrapé par un `create`. Si DEUX transactions
 * tombent toutes deux sur ce premier appel, l'une des deux `create` lève
 * `P2002` (violation d'unicité sur la clé `(societe_id, nature, annee)`) — elle
 * rejoue alors `prochainNumero`, qui cette fois trouve la ligne que l'autre a
 * posée et retombe sur le chemin `update` normal.
 *
 * **LE POINT DE SAUVEGARDE, et pourquoi sans lui la retentative ne retente
 * rien (9H1C, revue du pilote sur `f7e32fcd`).** `create` qui lève `P2002`
 * laisse la transaction PostgreSQL dans l'état `25P02` — « avortée » — et
 * TOUTE instruction suivante, y compris l'`update` de la retentative et le
 * `tx.intervention.create`/`tx.demande.create` qui attendait ce numéro, lève
 * alors la MÊME erreur sans rien tenter : deux créations simultanées sur un
 * compteur ABSENT (société neuve, ou premier jour de l'année) ne laissaient
 * gagner que la première, l'autre échouant entièrement. `SAVEPOINT` avant le
 * `create` risqué, `ROLLBACK TO SAVEPOINT` avant de retenter : la transaction
 * redevient utilisable, et l'`update` qui suit trouve la ligne que l'autre
 * vient de committer.
 *
 * **Jamais de SQL brut pour LIRE OU ÉCRIRE une donnée** (CLAUDE.md §2) : le
 * point de sauvegarde ne lit ni n'écrit rien du métier, il ne fait que
 * gouverner la transaction elle-même — exactement au même titre que
 * `BEGIN`/`COMMIT`, que Prisma émet déjà pour `$transaction`.
 */

/** L'année civile à laquelle une création NOUVELLE doit se numéroter. */
export function anneeDeNumerotation(fuseauSociete: Fuseau): number {
  return anneeCourante(fuseauSociete);
}

const VIOLATION_UNICITE = "P2002";
const ENREGISTREMENT_ABSENT = "P2025";

export type ParametresNumero = {
  readonly societeId: string;
  readonly nature: NatureNumerotation;
  readonly annee: number;
};

/**
 * Le PROCHAIN numéro de séquence pour (société, nature, année) — démarre à 1.
 * Appelée DANS la transaction qui crée la ligne numérotée (même transaction
 * que `tx.intervention.create`/`tx.demande.create`) : un numéro consommé par
 * une transaction annulée reste « brûlé », jamais réattribué (accepté par le
 * ticket).
 */
export async function prochainNumero(
  tx: Prisma.TransactionClient,
  params: ParametresNumero,
): Promise<number> {
  try {
    const compteur = await tx.compteurNumerotation.update({
      where: {
        societe_id_nature_annee: {
          societe_id: params.societeId,
          nature: params.nature,
          annee: params.annee,
        },
      },
      data: { dernier_numero: { increment: 1 } },
      select: { dernier_numero: true },
    });
    return compteur.dernier_numero;
  } catch (erreur) {
    if (
      !(erreur instanceof Prisma.PrismaClientKnownRequestError) ||
      erreur.code !== ENREGISTREMENT_ABSENT
    ) {
      throw erreur;
    }
  }

  // Le POINT DE SAUVEGARDE précède le `create` risqué : si une autre
  // transaction gagne la course, `P2002` laisse sinon la transaction entière
  // avortée (`25P02`), et la retentative ci-dessous lèverait la même erreur
  // sans même l'essayer.
  await tx.$executeRawUnsafe("SAVEPOINT prochain_numero");
  try {
    const compteur = await tx.compteurNumerotation.create({
      data: {
        id: uuidv7(),
        societe_id: params.societeId,
        nature: params.nature,
        annee: params.annee,
        dernier_numero: 1,
      },
      select: { dernier_numero: true },
    });
    return compteur.dernier_numero;
  } catch (erreur) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === VIOLATION_UNICITE
    ) {
      // La transaction redevient utilisable : l'autre a committé la ligne
      // que ce `create` visait, et la retentative la trouve par `update`.
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT prochain_numero");
      return prochainNumero(tx, params);
    }
    throw erreur;
  }
}
