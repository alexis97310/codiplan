import { type Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * RÉSOUDRE UNE MACHINE PAR SON JETON QR (ticket L2-02, arbitrage D22).
 *
 * D22 : *« `qr_token` est unique globalement, mais `GET /machines/qr/{token}`
 * **vérifie côté serveur que la machine appartient à la société active** et
 * refuse sinon. »*
 *
 * ## LE CONTRÔLE N'EST PAS ÉCRIT ICI, ET C'EST LE POINT
 *
 * On ne lit pas la machine puis on ne compare pas sa société : **on lit sous le
 * contexte**, et la politique de forme « parc » fait le contrôle. Une
 * comparaison écrite ici serait une SECONDE lecture du même critère, et deux
 * lectures d'un même critère divergent en silence (§9, 01/09) — celle-ci
 * dériverait le jour où le portail ou le périmètre changeraient, sans que rien
 * ne rougisse.
 *
 * Conséquence, mesurée par les scénarios : le jeton ne LÈVE aucune restriction.
 * Un compte portail hors périmètre ne résout pas la machine, alors même que son
 * jeton est juste. *Le QR ouvre la fiche de ce qu'on avait déjà le droit de
 * voir ; il n'ouvre pas ce qu'on n'avait pas.*
 *
 * ## UN SEUL REFUS POUR DEUX CAUSES, ET C'EST DÉLIBÉRÉ (D35, D50)
 *
 * « Jeton inconnu » et « machine d'une autre société » rendent **la même
 * chose** : `null`. Les distinguer transformerait la résolution en oracle —
 * *ce jeton existe-t-il quelque part ?* — c'est-à-dire en moyen d'apprendre,
 * depuis un compte quelconque, qu'une machine étiquetée appartient à un
 * concurrent. Un refus a le droit d'être lisible, jamais d'être informatif.
 *
 * ## Ce que ce module NE fait pas
 *
 * Il ne crée aucune machine, n'attribue aucun `numero`, et **n'imprime rien** :
 * les planches d'étiquettes attendent une décision d'exploitation — quelle
 * imprimante, quel support —, inscrite au registre plutôt que devinée.
 */

/**
 * Borne de taille d'un jeton reçu de l'extérieur. Généreuse à dessein : elle
 * n'a pas à connaître la dérivation, seulement à refuser l'illimité.
 */
const BORNE_LONGUEUR = 128;

/** Ce qu'un scan rend : de quoi ouvrir la fiche, et rien de plus. */
export type MachineResolue = {
  readonly id: string;
  readonly numero: number | null;
  readonly numeroSerie: string;
  readonly complet: boolean;
  readonly clientId: string;
  readonly siteId: string;
  readonly modeleId: string;
};

/**
 * Résout un jeton sous le contexte de la session, ou rend `null`.
 *
 * `client` est pris en paramètre pour la raison de L1-02d : *une couche sans
 * appelant ne se garde pas.* Les scénarios d'isolation empruntent ce chemin
 * contre la base jetable, sous le rôle applicatif restreint — et non une
 * variante écrite pour eux.
 */
export async function resoudreParJeton(
  contexte: ContexteSession,
  jeton: string,
  client?: PrismaClient,
): Promise<MachineResolue | null> {
  // ── CE CHEMIN NE VÉRIFIE PAS LA *FORME* DU JETON, ET C'EST UNE DÉCISION ──
  //
  // La première version appelait `estFormeDeJeton` ici. C'était une erreur, et
  // elle ne se serait vue que bien plus tard : **le jeton lu est une donnée
  // STOCKÉE, pas une donnée produite.** Contrôler sa forme à la LECTURE lie les
  // scans d'aujourd'hui à la dérivation d'aujourd'hui — le jour où celle-ci
  // changerait de longueur ou d'alphabet, les étiquettes déjà collées
  // cesseraient de se résoudre, en silence et sans qu'aucun gardien ne bouge.
  // *La forme sert à FABRIQUER un jeton ; elle ne sert pas à en reconnaître un.*
  //
  // Ce qui reste est une borne de taille, et elle n'est pas un contrôle
  // d'accès : elle évite d'envoyer à PostgreSQL une chaîne non bornée reçue de
  // l'extérieur.
  const propre = jeton.trim();
  if (propre.length === 0 || propre.length > BORNE_LONGUEUR) {
    return null;
  }

  const lignes = await avecContexteApplicatif(
    contexte,
    (tx: Prisma.TransactionClient) =>
      tx.$queryRawUnsafe<
        Array<{
          id: string;
          numero: number | null;
          numero_serie: string;
          complet: boolean;
          client_id: string;
          site_id: string;
          modele_id: string;
        }>
      >(
        `SELECT "id", "numero", "numero_serie", "complet",
                "client_id", "site_id", "modele_id"
           FROM "machine"
          WHERE "qr_token" = $1`,
        propre,
      ),
    client,
  );

  const ligne = lignes[0];
  if (ligne === undefined) return null;
  return {
    id: ligne.id,
    numero: ligne.numero,
    numeroSerie: ligne.numero_serie,
    complet: ligne.complet,
    clientId: ligne.client_id,
    siteId: ligne.site_id,
    modeleId: ligne.modele_id,
  };
}
