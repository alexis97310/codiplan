import { type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

/**
 * LA CAMPAGNE DATÉE (L9-08 ; D88 §8).
 *
 * ## LA RÈGLE, MOT POUR MOT
 *
 * > **Faire passer une famille de « non soumise » à « soumise » n'ouvre PAS
 * > deux cents alertes : cela ouvre UNE CAMPAGNE DATÉE avec un compteur qui
 * > descend.**
 *
 * *Un gardien dont le taux de fausses alertes conduit à ne plus le lire coûte
 * plus qu'il ne rapporte* (§9, 11/09) — et deux cents alertes le jour d'une
 * déclaration sont **la panne par le bruit, la plus sûre de toutes**. Le
 * dispositif produit donc **un objet unique**, daté, avec un reste-à-faire
 * visible, et **aucune notification par machine**.
 *
 * ## LE COMPTEUR N'EST PAS UNE COLONNE, ET C'EST DÉCIDÉ
 *
 * Il se **DÉRIVE** : les machines de la famille qui n'ont reçu aucune
 * information **depuis l'ouverture**. *Un compteur stocké se désynchronise en
 * silence* — la première saisie de vérification qui oublierait de le décrémenter
 * le figerait —, **et un compteur figé est pire qu'une alerte de trop : il a
 * l'air de mesurer.**
 *
 * C'est la même famille que D85 vue par l'autre bout : là, un fait de
 * cloisonnement qui dépend du temps se MATÉRIALISE parce qu'une politique ne
 * doit pas changer d'elle-même ; ici, un compte d'affichage se DÉRIVE parce
 * qu'il doit au contraire suivre. *La différence est ce qui dépend du résultat :
 * un droit de lire, ou un chiffre qu'on regarde.*
 *
 * ## CE MODULE NE LIT PAS L'HORLOGE
 *
 * `ouverteLe` est **reçu**. Une fonction qui lit l'heure rend un test vert parce
 * que l'heure a bougé, non parce que la règle tient (D85, et tout `lib/vgp/`).
 */

/** Une campagne, et son reste-à-faire DÉRIVÉ au moment où on la lit. */
export type CampagneVgp = {
  readonly id: string;
  readonly famille_id: string;
  readonly famille_libelle: string;
  readonly ouverte_le: Date;
  readonly close_le: Date | null;
  /** Les machines de la famille qui n'ont rien reçu depuis l'ouverture. */
  readonly resteAFaire: number;
  /** Combien la campagne en visait à son ouverture — le dénominateur. */
  readonly total: number;
};

/**
 * OUVRE UNE CAMPAGNE sur une famille.
 *
 * **Elle ne vérifie PAS que la famille vient de passer à « soumis »**, et c'est
 * écrit plutôt que tu : ce module ne connaît pas l'intention de l'appelant, et
 * une campagne ouverte sur une famille déjà soumise est un geste légitime —
 * *on rattrape un registre incomplet sans avoir rien redéclaré.*
 */
export async function ouvrirCampagne(
  contexte: ContexteSession,
  familleId: string,
  ouverteLe: Date,
  client?: PrismaClient,
): Promise<string> {
  const societeId = exigerSocieteActive(contexte);
  const id = uuidv7();
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpCampagne.create({
        data: {
          id,
          societe_id: societeId,
          famille_id: familleId,
          ouverte_le: ouverteLe,
        },
      }),
    client,
  );
  return id;
}

/**
 * LES CAMPAGNES, avec leur reste-à-faire calculé à l'instant de la lecture.
 *
 * **Le compte se fait sur les machines VISIBLES**, et c'est une conséquence du
 * cloisonnement qu'il faut dire : un compte de portail restreint à un site
 * verrait un reste-à-faire plus petit que l'exploitant. *Ce n'est pas un défaut
 * — c'est ce que « son parc » veut dire —, mais un chiffre qui change avec le
 * lecteur mérite d'être nommé.*
 */
export async function campagnes(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly CampagneVgp[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ouvertes = await tx.vgpCampagne.findMany({
        select: {
          id: true,
          famille_id: true,
          ouverte_le: true,
          close_le: true,
          famille: { select: { libelle: true } },
        },
        orderBy: [{ ouverte_le: "desc" }, { id: "desc" }],
      });

      return Promise.all(
        ouvertes.map(async (campagne) => {
          const machines = await tx.machine.findMany({
            where: { modele: { famille_id: campagne.famille_id } },
            select: {
              id: true,
              verifications_vgp: {
                where: { date_verification: { gte: campagne.ouverte_le } },
                select: { id: true },
                take: 1,
              },
            },
          });
          return {
            id: campagne.id,
            famille_id: campagne.famille_id,
            famille_libelle: campagne.famille.libelle,
            ouverte_le: campagne.ouverte_le,
            close_le: campagne.close_le,
            // LE RESTE-À-FAIRE : celles qui n'ont RIEN reçu depuis l'ouverture.
            // *Une information reçue AVANT ne solde pas une campagne ouverte
            // APRÈS* — c'est tout ce que la date d'ouverture sert à borner.
            resteAFaire: machines.filter(
              (machine) => machine.verifications_vgp.length === 0,
            ).length,
            total: machines.length,
          };
        }),
      );
    },
    client,
  );
}

/**
 * CLÔT UNE CAMPAGNE — un geste, jamais un effet du compteur.
 *
 * *Elle ne se ferme pas toute seule quand le reste-à-faire atteint zéro* : une
 * campagne close est une décision, et le compteur peut remonter — **une machine
 * neuve entre dans la famille.** Une fermeture automatique ferait disparaître
 * l'objet au moment précis où il redeviendrait utile.
 */
export async function clore(
  contexte: ContexteSession,
  campagneId: string,
  closeLe: Date,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpCampagne.updateMany({
        where: { id: campagneId },
        data: { close_le: closeLe },
      }),
    client,
  );
}
