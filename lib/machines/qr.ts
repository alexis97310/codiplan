import { randomBytes } from "node:crypto";

/**
 * LE JETON QR D'UNE MACHINE — UN SECRET, PAS UN IDENTIFIANT (L2-02, D71).
 *
 * ## Ce qui a changé, et pourquoi ce n'était pas reportable
 *
 * La première version DÉRIVAIT le jeton de l'`id` — `sha256` d'un domaine
 * versionné —, en écrivant que c'était « un identifiant, pas un secret », et en
 * inscrivant la question au registre : *le jour où RG-DRO-02 donnera au
 * technicien la résolution QR EN PLUS de son périmètre, le jeton deviendra ce
 * qui LÈVE une restriction, c'est-à-dire un secret.*
 *
 * **L'exploitation a tranché le 09/09, et l'argument est ASYMÉTRIQUE.** Le faire
 * maintenant ne coûte rien — c'est une façon de tirer une valeur, pas une
 * architecture. Le faire plus tard coûte de **réétiqueter physiquement tout le
 * parc**, chez des clients, à travers la Nouvelle-Calédonie. Entre un coût nul
 * aujourd'hui et une campagne physique demain, il n'y a pas d'arbitrage.
 *
 * **Et la règle générale, qui vaut au-delà de ce jeton :** *une valeur dont on
 * sait qu'on lui demandera un jour de porter une autorité doit naître capable de
 * la porter. Un identifiant qu'on promeut en secret après coup n'est pas un
 * secret — c'est un identifiant que tout le monde a déjà vu.*
 *
 * ## D7 SE CONTREDISAIT, et cette décision le RÉPARE
 *
 * D7 écrit deux choses incompatibles à trois lignes d'écart :
 *
 *   1. « le `qr_token`, **dérivé de l'UUID** » ;
 *   2. « planches de QR **pré-imprimées**, avec des **jetons pré-générés** et
 *      téléchargés sur l'appareil **avant le départ** — recommandé pour les
 *      campagnes de recensement ».
 *
 * *Un jeton pré-généré avant le départ ne peut pas être dérivé de l'identifiant
 * d'une machine qui n'existe pas encore.* La seconde moitié est celle dont
 * l'usage réel a besoin — le recensement en série —, et c'est celle qui reste.
 *
 * ## CE QUE LA DÉRIVATION APPORTAIT, ET CE QUE CELA COÛTE DE LE PERDRE : RIEN
 *
 * L'argument qui la portait était le RECALCUL : une étiquette réimprimée pour
 * une machine créée hors ligne, dont le jeton n'aurait jamais été synchronisé.
 * **Il ne coûte rien parce que le jeton VOYAGE AVEC LA FICHE** : il naît sur
 * l'appareil au moment de la création, dans la même ligne que l'`id`. Le seul
 * cas qu'un recalcul aurait sauvé — « l'appareil a perdu le jeton mais garde
 * l'`id` » — **ne peut pas se produire** : les deux sont la même ligne.
 *
 * ## I4 EST TENU : `randomBytes` NE DEMANDE AUCUN RÉSEAU
 *
 * La création d'une machine se fait en mode avion. Un tirage aléatoire local
 * satisfait cette contrainte aussi bien qu'une dérivation — mieux, même : il ne
 * demande pas que l'`id` existe déjà, ce qui est exactement ce qu'exigent les
 * planches pré-générées.
 *
 * ## L'ENTROPIE EST CELLE DU TIRAGE, ET ELLE EST RÉELLE
 *
 * 26 caractères base32 portent **130 bits**, et ils sont tous aléatoires — là où
 * la version dérivée n'en portait que 74, ceux de l'UUID, quelle que fût sa
 * longueur. *C'est la première fois que la longueur de ce jeton mesure vraiment
 * quelque chose*, et c'est la différence exacte entre un identifiant et un
 * secret.
 */

/** L'alphabet base32 de la RFC 4648, sans remplissage. Majuscules : une étiquette se relit à l'œil. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Longueur du jeton, en caractères base32. 26 × 5 = **130 bits**, tous tirés. */
const LONGUEUR = 26;

/** Octets à tirer pour couvrir `LONGUEUR` caractères sans jamais compléter par des zéros. */
const OCTETS = Math.ceil((LONGUEUR * 5) / 8);

/** Encode les octets en base32 (RFC 4648), sans remplissage. */
function base32(octets: Buffer): string {
  let accumulateur = 0;
  let bits = 0;
  let sortie = "";
  for (const octet of octets) {
    accumulateur = (accumulateur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(accumulateur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    sortie += ALPHABET[(accumulateur << (5 - bits)) & 31];
  }
  return sortie;
}

/**
 * Engendre un jeton QR — **130 bits tirés au sort**, calculable hors ligne.
 *
 * Il ne prend AUCUN argument, et c'est le cœur de D71 : *il ne dépend de rien
 * qu'un tiers puisse connaître.* Ni l'`id`, ni le numéro de série, ni le client
 * ne permettent de le prévoir, et le photographier ne rend rien d'autre que
 * lui-même.
 *
 * `randomBytes` est le générateur cryptographique de la plateforme, jamais
 * `Math.random` — qui est prévisible depuis quelques sorties, et dont l'usage
 * ici transformerait 130 bits affichés en une poignée de bits réels.
 */
export function engendrerJetonQr(): string {
  return base32(randomBytes(OCTETS)).slice(0, LONGUEUR);
}

/**
 * Engendre `combien` jetons distincts — les PLANCHES PRÉ-GÉNÉRÉES de D7.
 *
 * C'est l'usage que la dérivation rendait impossible : une planche s'imprime
 * **avant** que les machines existent, donc avant qu'aucun `id` ne soit connu.
 * *Cette fonction est la moitié de D7 que D71 rend enfin réalisable* — et elle
 * n'imprime rien : l'impression attend une décision d'exploitation (question
 * ouverte n° 6).
 *
 * L'unicité est VÉRIFIÉE plutôt que supposée. À 130 bits elle est acquise par
 * le calcul, mais un générateur mal câblé — `Math.random`, une graine figée,
 * un tampon réutilisé — produirait des doublons **en silence**, et c'est
 * exactement le défaut qu'aucun décompte ne signale.
 */
export function engendrerPlancheDeJetons(combien: number): readonly string[] {
  if (!Number.isInteger(combien) || combien < 1) {
    throw new Error(
      "engendrerPlancheDeJetons attend un nombre entier de jetons, au moins un.",
    );
  }
  const jetons = new Set<string>();
  while (jetons.size < combien) {
    const avant = jetons.size;
    jetons.add(engendrerJetonQr());
    if (jetons.size === avant) {
      throw new Error(
        "Deux jetons identiques ont été tirés : à 130 bits c'est " +
          "impossible par le calcul, donc le générateur est en cause. " +
          "Vérifier qu'il s'agit bien de `randomBytes` et non d'une source " +
          "prévisible ou d'un tampon réutilisé.",
      );
    }
  }
  return [...jetons];
}

/**
 * Vrai si ce texte a la FORME d'un jeton. Il ne dit pas qu'il existe.
 *
 * Sert à la FABRICATION et aux épreuves, **jamais à la lecture** : un jeton lu
 * est une donnée stockée, et contrôler sa forme à la lecture lierait les scans
 * d'aujourd'hui à la génération d'aujourd'hui — le jour où celle-ci changerait
 * de longueur, les étiquettes déjà collées cesseraient de se résoudre, en
 * silence. `lib/machines/resolution.ts` s'en abstient délibérément.
 */
export function estFormeDeJeton(candidat: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${LONGUEUR}}$`).test(candidat);
}
