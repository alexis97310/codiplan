import type { PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { peutPleinement } from "./habilitations";
import { avecDesignationAuth } from "./lecture-identite";
import { Role } from "./roles";

/**
 * L7-04 — DÉVERROUILLAGE D'UN COMPTE PARVENU À L'ESCALADE (D66).
 *
 * ## Ce que ce geste rend, et ce qu'il ne rend pas
 *
 * Au troisième verrouillage enchaîné, le verrouillage du second facteur cesse
 * d'expirer : l'état est atteignable en **trente codes faux**, et il n'en
 * existait **aucune sortie**. Ce geste rompt la série.
 *
 * ***Déverrouiller n'accorde aucun accès.*** La personne devra toujours
 * présenter un code valide, et n'a **rien** à réenrôler : le facteur est
 * intact. C'est ce qui distingue L7-04 de L7-01, qui rend un accès PERDU —
 * et c'est pourquoi il appartient à l'`admin_societe` de la société concernée
 * plutôt qu'à l'éditeur. *Exiger un appel extérieur un vendredi soir pour une
 * gêne d'exploitation, c'est organiser le contournement de la mesure.*
 *
 * ## POURQUOI CE MODULE N'ÉCRIT PAS DE `where`, ET C'EST LA CHOSE À NE PAS
 * « SIMPLIFIER »
 *
 * Mesuré le 09/09/2026, sous le rôle applicatif, sur la base jetable :
 *
 * | Ce qui a été essayé | Lignes modifiées |
 * |---|---|
 * | politique d'`UPDATE` seule, `UPDATE … WHERE utilisateur_id = $1` | **0** |
 * | politique de `SELECT` ajoutée, même `UPDATE` | 1 — *et l'admin lit alors `secret` et `codes_secours`* |
 * | `UPDATE … SET <constantes>` **sans `WHERE`** | **1** |
 * | `updateMany` de Prisma **sans `where`** | count **1** |
 *
 * **PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`**
 * (§9, 08/09). Écrire le `where` naturel aurait donc obligé à ouvrir la lecture
 * de `second_facteur` à l'administrateur — c'est-à-dire à lui donner le secret
 * et les codes de secours de la personne qu'il dépanne : **une prise de
 * contrôle, pas un déverrouillage.**
 *
 * Un `UPDATE` sans `WHERE` et à `SET` constants ne lit aucune colonne. La ligne
 * est alors désignée par `app.deverrouillage_sujet_id`, et c'est la politique —
 * elle seule — qui décide QUI a le droit et DANS QUEL ÉTAT. **Ajouter un `where`
 * ici casserait le geste en silence** (zéro ligne, aucune erreur), et l'y
 * remettre exigerait d'ouvrir la lecture.
 *
 * ## LE DÉCOMPTE EST UNE ASSERTION, PAS UNE CURIOSITÉ
 *
 * Un `UPDATE` sans `WHERE` s'appuie ENTIÈREMENT sur sa politique. Si celle-ci
 * était un jour élargie, il écrirait plus d'une ligne — et personne ne le
 * verrait. Le geste **annule** donc dès que le décompte n'est pas exactement un.
 * En base, un déclencheur écrit à l'envers tient le second filet : sous un
 * contexte de déverrouillage, aucune colonne autre que les trois du
 * verrouillage ne peut bouger.
 */

/** Ce que le geste refuse, avec le motif. */
export class RefusDeverrouillage extends Error {}

export type DemandeDeverrouillage = {
  /** La société sous laquelle l'administrateur agit. */
  readonly societeId: string;
  /** Le rôle qu'il y tient. */
  readonly role: Role;
  /** Son identité — l'auteur porté au journal des accès. */
  readonly auteurId: string;
  /** Le compte à déverrouiller. */
  readonly sujetId: string;
};

/**
 * Rompt la série de verrouillages d'un compte parvenu à l'escalade.
 *
 * @returns `true` si un déverrouillage a eu lieu, `false` si le compte n'était
 *   pas à l'escalade — la distinction est utile à l'écran, et aucune des deux
 *   ne renseigne sur l'existence d'un second facteur.
 */
export async function deverrouillerSecondFacteur(
  demande: DemandeDeverrouillage,
  client: PrismaClient = clientParDefaut,
): Promise<boolean> {
  // LE REFUS EST DIT DANS LE CODE **ET** TENU EN BASE. Ici pour qu'il soit
  // lisible, là-bas pour qu'il soit vrai : la base ne dépend pas de cette
  // ligne, et un scénario le prouve en éprouvant la politique directement.
  if (!peutPleinement(demande.role, "administrer_utilisateurs")) {
    throw new RefusDeverrouillage(
      `Le rôle « ${demande.role} » ne peut pas déverrouiller un compte. ` +
        "Le déverrouillage appartient à l'administrateur de la société.",
    );
  }
  if (demande.auteurId === demande.sujetId) {
    throw new RefusDeverrouillage(
      "Un compte ne se déverrouille pas lui-même : la série de verrouillages " +
        "ne serait plus une mesure.",
    );
  }

  const rompu = await avecContexteRls(
    client,
    {
      societeId: demande.societeId,
      role: demande.role,
      auteurId: demande.auteurId,
      deverrouillageSujetId: demande.sujetId,
    },
    async (tx) => {
      // AUCUN `where` — voir l'en-tête. La ligne est désignée par
      // `app.deverrouillage_sujet_id`, et bornée par la politique.
      const { count } = await tx.secondFacteur.updateMany({
        data: { verrouille_jusqu_a: null, echecs_verification: 0 },
      });
      if (count > 1) {
        // La politique a laissé passer plus d'une ligne : on n'écrit pas
        // « probablement bon », on annule. La transaction reflue.
        throw new RefusDeverrouillage(
          `Le déverrouillage a atteint ${count} lignes au lieu d'une seule : ` +
            "la politique de déverrouillage ne borne plus ce qu'elle devrait, " +
            "et l'écriture est annulée.",
        );
      }
      return count === 1;
    },
  );

  // LA TRACE EST ÉCRITE MÊME QUAND RIEN N'A ÉTÉ ROMPU. Une tentative de
  // déverrouillage est un accès administratif à un compte tiers : ce qu'elle a
  // trouvé ne change pas ce qu'elle était.
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: demande.auteurId,
      evenement: "deverrouillage_second_facteur",
      societe_id_cible: demande.societeId,
      role: demande.role,
      detail: rompu
        ? `déverrouillage du compte ${demande.sujetId} — la série de verrouillages est rompue ; aucun accès n'est accordé, un code valide reste exigé`
        : `déverrouillage demandé sur le compte ${demande.sujetId} — aucune série à rompre`,
    },
  });

  return rompu;
}
