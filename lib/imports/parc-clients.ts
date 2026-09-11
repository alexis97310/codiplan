import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { type ParcConnu } from "@/lib/excel/controle";
import { cleDeClient } from "@/lib/excel/rapprochement";

/**
 * LE PARC DES CLIENTS, INDEXÉ PAR SA CLÉ DE RAPPROCHEMENT (L1-08g ; RG-IMP-05).
 *
 * ## Pourquoi ce module existe, et ce qu'il retire
 *
 * L1-08f avait écrit sa limite plutôt que de la taire : *« RG-IMP-05 veut qu'en
 * cas d'ambiguïté la ligne parte en rejet pour arbitrage humain ; l'ambiguïté
 * est un fait du PARC — deux clients de même raison sociale normalisée —, et le
 * contrôle ne reçoit qu'un `Set<string>`, qui ne peut pas la porter. »*
 *
 * **C'est cette limite que ce module retire.** L'ambiguïté se constate en
 * indexant : deux fiches qui rendent la MÊME clé rendent indécidable ce qu'une
 * ligne du fichier désigne. *Elle ne se devine pas d'une ressemblance ; elle se
 * lit d'une collision.*
 *
 * ## La clé est calculée ICI par la MÊME fonction que le contrôle
 *
 * `cleDeClient`, et pas une variante. *Deux lectures d'un même critère divergent
 * en silence* (§9, 01/09), et ici la divergence serait invisible et grave : une
 * clé calculée autrement côté parc ferait que RIEN ne se rapproche jamais — tout
 * deviendrait création, c'est-à-dire le défaut que L1-08f vient de réparer.
 *
 * ## Il LIT, il ne compare aucune société
 *
 * La lecture passe par `avecContexteApplicatif`, donc sous le contexte
 * cloisonné : la politique de `client` est de forme « parc », et rien n'est
 * recomparé au-dessus.
 */

/** Le parc, avec de quoi RETROUVER chaque fiche — ce dont l'application aura besoin. */
export type ParcClientsIndexe = ParcConnu & {
  /**
   * La fiche que chaque clé NON AMBIGUË désigne. Une clé ambiguë n'y figure
   * pas : *elle ne désigne rien, et lui attribuer l'une des deux fiches serait
   * le choix au hasard que RG-IMP-05 refuse.*
   */
  readonly fiches: ReadonlyMap<string, string>;
};

/**
 * Indexe le parc des clients de la société active.
 *
 * **`actif` n'est pas filtré, et c'est délibéré.** Un client désactivé occupe
 * toujours son code externe et sa raison sociale : l'ignorer ferait qu'un
 * import le recrée, et la base refuserait sur l'unicité du code — *un refus
 * technique à la place d'un rapprochement, sur la fiche la moins surveillée.*
 */
export async function indexerLeParcClients(
  contexte: ContexteSession,
  /**
   * La connexion, quand l'appelant en fournit une — le paramètre que
   * `avecContexteApplicatif` porte déjà, et pour la même raison : *une couche
   * sans appelant ne se garde pas.*
   */
  client?: PrismaClient,
): Promise<ParcClientsIndexe> {
  const fichesLues = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.client.findMany({
        select: { id: true, code_externe: true, raison_sociale: true },
      }),
    client,
  );

  const fiches = new Map<string, string>();
  const ambigues = new Set<string>();

  /** Pose une clé, ou la déclare ambiguë si une autre fiche la porte déjà. */
  const poser = (cle: string, ficheId: string): void => {
    if (ambigues.has(cle)) return;
    const deja = fiches.get(cle);
    if (deja === undefined) {
      fiches.set(cle, ficheId);
      return;
    }
    if (deja === ficheId) return;
    // LA COLLISION. La première fiche est RETIRÉE de l'index en même temps que
    // la seconde n'y entre pas : *laisser la première ferait que la ligne
    // écrase celle-là plutôt que l'autre, c'est-à-dire un choix au hasard rendu
    // stable par l'ordre de lecture.*
    fiches.delete(cle);
    ambigues.add(cle);
  };

  for (const fiche of fichesLues) {
    // **CHAQUE FICHE ENTRE SOUS SES DEUX CLÉS, et c'est RG-IMP-05 lue
    // exactement** : *« le rapprochement se fait sur le code externe s'il
    // existe, à défaut sur la raison sociale normalisée ».* Le « s'il existe »
    // porte sur la LIGNE DU FICHIER, pas sur la fiche — une ligne sans code
    // doit pouvoir rapprocher une fiche qui en a un, sinon l'import crée un
    // doublon à chaque fichier dont la colonne « Code externe » est vide.
    //
    // *Mesuré : avec une seule clé par fiche, une ligne désignant « Client A1 »
    // par son nom proposait une CRÉATION alors que la fiche existait.*
    //
    // Le rang est SANS OBJET — une fiche en base n'a pas de rang dans un
    // fichier —, et il ne peut jamais servir : `client.raison_sociale` étant
    // NOT NULL, la clé de dernier recours est inatteignable par ce chemin.
    if (fiche.code_externe !== null) {
      poser(
        cleDeClient({
          codeExterne: fiche.code_externe,
          raisonSociale: undefined,
          rang: 0,
        }).cle,
        fiche.id,
      );
    }
    poser(
      cleDeClient({
        codeExterne: undefined,
        raisonSociale: fiche.raison_sociale,
        rang: 0,
      }).cle,
      fiche.id,
    );
  }

  return {
    // `cles` porte TOUT ce que le parc connaît, ambiguïtés comprises : une clé
    // ambiguë est connue, elle est seulement indécidable. C'est ce qui permet
    // au contrôle de trancher dans le bon ordre — le rejet précède la
    // modification, sans quoi une clé ambiguë passerait pour modifiable.
    cles: new Set([...fiches.keys(), ...ambigues]),
    ambigues,
    fiches,
  };
}
