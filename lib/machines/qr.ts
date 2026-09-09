import { createHash } from "node:crypto";

/**
 * LE JETON QR D'UNE MACHINE (ticket L2-02, arbitrages D7 et D22, invariant I10).
 *
 * ## Ce que les sources imposent, et ce qu'elles laissent
 *
 * D7 : *« Le QR encode le `qr_token`, **dérivé de l'UUID**, jamais le numéro
 * affiché. »* I10 le redit, et I4 ajoute la contrainte qui décide de la forme :
 * **la création d'une machine se fait en mode avion**. Le jeton doit donc se
 * calculer **sur l'appareil, sans réseau et sans secret** que l'appareil n'aurait
 * pas — ce qui exclut toute dérivation à clé, et rend la fonction publique.
 *
 * Ce que la dérivation apporte, et qu'un jeton tiré au hasard n'apporterait pas :
 * **l'appareil peut le RECALCULER à partir du seul `id`**. Une étiquette
 * réimprimée pour une machine créée hors ligne, dont le jeton n'a jamais été
 * synchronisé, reste la même. C'est la raison d'être de « dérivé », et elle est
 * de la famille de I4.
 *
 * ## CE QUE CE JETON EST AUJOURD'HUI : UN IDENTIFIANT, PAS UN SECRET
 *
 * Et il faut l'écrire, parce que **cela peut changer sans que rien ne le dise**.
 *
 * Aujourd'hui, résoudre un jeton ne donne accès à rien de plus : la lecture
 * passe par les mêmes politiques que toute autre, et un compte qui ne verrait
 * pas la machine par son parc ne la voit pas davantage par son QR — un scénario
 * d'isolation le mesure sur une machine hors périmètre. *Connaître le jeton
 * équivaut à connaître l'`id`, et les deux sont protégés par la même politique.*
 *
 * **Mais RG-DRO-02 promet au technicien « la résolution par QR code » EN PLUS de
 * son périmètre.** Le jour où cette restriction sera implémentée — elle ne l'est
 * pas : la forme « parc » ouvre aujourd'hui tout le parc de la société à un
 * utilisateur interne —, le jeton deviendra ce qui la LÈVE, c'est-à-dire un
 * secret. **Une dérivation publique cesserait alors de borner quoi que ce soit**
 * pour qui connaît l'`id`. La question est inscrite au registre du 09/09 plutôt
 * que tranchée ici.
 *
 * ## L'ENTROPIE EST CELLE DE L'`id`, ET LE HACHAGE N'EN AJOUTE AUCUNE
 *
 * Un UUID v7 porte 48 bits d'horodatage et **74 bits aléatoires**. Le jeton en
 * est une fonction publique : sa force contre la devinette est donc de **74
 * bits**, quelle que soit sa longueur. L'écrire évite de lire la longueur du
 * jeton comme une mesure de sa solidité — *un chiffre qui ne peut pas bouger
 * sous une faute n'est pas une observation* (§9, 06/09).
 *
 * Ce que le hachage apporte, et c'est réel : **il n'est pas inversible**. Une
 * étiquette photographiée ne rend pas l'`id` de la machine, là où un jeton égal
 * à l'`id` l'aurait donné — avec son horodatage de création.
 *
 * ## La VERSION est dans le préfixe, et elle ne périme aucune étiquette
 *
 * Le jeton est **stocké** en base : la dérivation ne sert qu'à la création. En
 * changer la version n'invalide donc aucune étiquette déjà collée — les
 * anciennes gardent leur jeton, les nouvelles en reçoivent un autre. C'est ce
 * qui rend le préfixe versionné utile plutôt que décoratif.
 */

/**
 * Le domaine de dérivation. Il SÉPARE : sans lui, la même empreinte pourrait
 * être produite par un autre usage du même identifiant, et deux usages qui
 * partagent une empreinte finissent par se contaminer.
 */
const DOMAINE = "codiplan:machine:qr:v1";

/**
 * Longueur du jeton, en caractères base32.
 *
 * Vingt-six caractères portent 130 bits, davantage que les 74 bits aléatoires
 * de l'UUID : **la troncature ne retire donc rien**, et l'allonger n'ajouterait
 * rien non plus. C'est la seule raison du chiffre — pas une marge de sécurité,
 * qui serait une lecture fausse de ce que ce jeton garantit.
 */
const LONGUEUR = 26;

/** L'alphabet base32 de la RFC 4648, sans remplissage. Majuscules : une étiquette se relit à l'œil. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

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
 * Le jeton QR d'une machine, dérivé de son `id` (D7).
 *
 * Déterministe, calculable hors ligne, sans secret et sans réseau. La casse et
 * les espaces de bordure de l'identifiant sont normalisés : un même UUID écrit
 * en majuscules ou en minuscules doit rendre le MÊME jeton, sans quoi deux
 * appareils qui formatent différemment produiraient deux étiquettes pour une
 * seule machine.
 */
export function jetonDeMachine(id: string): string {
  const normalise = id.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      normalise,
    )
  ) {
    throw new Error(
      "jetonDeMachine attend l'identifiant UUID de la machine. Le jeton se " +
        "dérive de l'`id` et de rien d'autre (D7, I10) : ni du numéro, ni du " +
        "numéro de série, qui changent tous deux après la pose de l'étiquette.",
    );
  }
  const empreinte = createHash("sha256")
    .update(`${DOMAINE}:${normalise}`)
    .digest();
  return base32(empreinte).slice(0, LONGUEUR);
}

/**
 * Vrai si ce texte a la FORME d'un jeton. Il ne dit pas qu'il existe.
 *
 * Sert à écarter une entrée manifestement hors sujet avant d'interroger la
 * base — jamais à décider d'un accès. *Une forme valide n'est pas une
 * autorisation*, et le chemin de résolution le rappelle à son propre endroit.
 */
export function estFormeDeJeton(candidat: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${LONGUEUR}}$`).test(candidat);
}
