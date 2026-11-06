import { randomUUID } from "node:crypto";

import { type Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerContexteActif } from "@/lib/auth/contexte";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LA SUITE À DONNER (9J17-SUITE-A-DONNER-SCHEMA, D231).
 *
 * Forme « filiation » (D103) : aucune comparaison de société n'est écrite
 * ici. L'écriture et la lecture passent par `avecContexteApplicatif`, donc
 * sous le contexte cloisonné, et c'est la politique de `suite_a_donner` qui
 * prononce — visible si `intervention_origine_id` l'est.
 *
 * **Quatre fonctions, pas plus** (territoire du ticket) : ce dépôt ne couvre
 * pas encore la transition `qualifiee` → `accord_attendu`, cible de FLX-3
 * (future, hors périmètre). Une ligne qui doit l'atteindre aujourd'hui y est
 * posée directement par qui l'écrit — aucun écran de ce ticket n'en a besoin
 * (9J18).
 */

/** L'instant, daté dans le fuseau de la SOCIÉTÉ active (L0-08). */
async function instantDate(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<Date> {
  const societe = await tx.societe.findUniqueOrThrow({
    where: { id: societeId },
    select: { fuseau_horaire: true },
  });
  return maintenant(lireFuseau(societe.fuseau_horaire)).instant;
}

/**
 * Qualifie la suite à donner d'une intervention : crée la ligne et la fait
 * passer dans le même geste à `qualifiee` (devis en cours, cible de FLX-2).
 * **Aucune autre fonction de ce dépôt ne crée de ligne** — `a_qualifier`
 * reste l'état de naissance porté par le schéma, pour toute ligne qu'un
 * chemin futur insérerait autrement.
 */
export async function qualifierSuite(
  contexte: ContexteSession,
  interventionOrigineId: string,
  client?: PrismaClient,
): Promise<string> {
  const { societeId, utilisateurId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const qualifieeLe = await instantDate(tx, societeId);
      await tx.suiteADonner.create({
        data: {
          id,
          societe_id: societeId,
          intervention_origine_id: interventionOrigineId,
          statut: "qualifiee",
          qualifiee_par: utilisateurId,
          qualifiee_le: qualifieeLe,
        },
      });
    },
    client,
  );

  return id;
}

/** La réponse du client, à l'issue de l'attente d'accord (cible de FLX-3). */
export type ReponseAccord =
  | {
      readonly reponse: "accord_recu";
      readonly pieceAttendueRef?: string;
      readonly dateDispoPrevue?: Date;
    }
  | { readonly reponse: "sans_suite"; readonly motifSansSuite: string };

/**
 * Enregistre la réponse à l'accord attendu : `accord_recu` — avec, le cas
 * échéant, l'attente de pièce qui s'ouvre (RG-INT-06, D117, D231) — ou
 * `sans_suite`, avec son motif en texte libre.
 */
export async function enregistrerAccord(
  contexte: ContexteSession,
  id: string,
  reponse: ReponseAccord,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.suiteADonner.update({
        where: { id },
        data:
          reponse.reponse === "accord_recu"
            ? {
                statut: "accord_recu",
                motif_sans_suite: null,
                piece_attendue_ref: reponse.pieceAttendueRef ?? null,
                date_dispo_prevue: reponse.dateDispoPrevue ?? null,
              }
            : {
                statut: "sans_suite",
                motif_sans_suite: reponse.motifSansSuite,
                piece_attendue_ref: null,
                date_dispo_prevue: null,
              },
      }),
    client,
  );
}

/**
 * La pièce attendue arrive (cible de FLX-8, future) : nulle les deux
 * colonnes de l'attente et fait passer le statut à `a_replanifier`, dans la
 * MÊME transaction — jamais un état fermé de plus pour le dire (D231).
 */
export async function marquerPieceRecue(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.suiteADonner.update({
        where: { id },
        data: {
          statut: "a_replanifier",
          piece_attendue_ref: null,
          date_dispo_prevue: null,
        },
      }),
    client,
  );
}

/** Clôture une suite à donner — depuis `a_replanifier` ou `sans_suite`. */
export async function cloturer(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.suiteADonner.update({
        where: { id },
        data: { statut: "cloturee" },
      }),
    client,
  );
}
