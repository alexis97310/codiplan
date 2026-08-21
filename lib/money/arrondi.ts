/**
 * L'unique fonction d'arrondi du dépôt (ticket L0-07, point 4).
 *
 * **Pourquoi une seule.** Un arrondi recopié est un arrondi qui divergera : la
 * valorisation, la consolidation et les documents générés doivent donner le
 * même centime pour la même donnée, ou la facture ne se rapproche plus du
 * rapport. Toute règle de gestion qui a besoin d'arrondir appelle celle-ci.
 *
 * **La règle.** Au plus proche ; à égale distance, on s'éloigne de zéro.
 * `2,5 → 3`, `-2,5 → -3`, `1,5 → 2`, `-1,5 → -2`. C'est l'arrondi commercial,
 * celui que lit un client sur une facture — et non l'arrondi « au pair » de
 * `Math.round`, qui traite d'ailleurs les négatifs de façon asymétrique
 * (`Math.round(-2.5) === -2`).
 *
 * **Pourquoi une division et non un nombre.** L'entrée est une fraction exacte
 * de deux entiers, jamais un flottant : `0.1 + 0.2` ne vaut pas `0.3`, et un
 * montant n'a pas le droit de s'en apercevoir. Les appelants qui manipulent un
 * taux le représentent par un couple mantisse / échelle, et le passent ici sous
 * forme de quotient.
 */

const ZERO = BigInt(0);
const UN = BigInt(1);
const DEUX = BigInt(2);

/**
 * Arrondit `dividende / diviseur` à l'entier le plus proche, à égale distance
 * en s'éloignant de zéro. Arithmétique entière exacte, sans passage par un
 * flottant à aucun moment.
 */
export function arrondirAuPlusProche(
  dividende: bigint,
  diviseur: bigint,
): bigint {
  if (diviseur === ZERO) {
    throw new Error(
      "Arrondi impossible : le diviseur est nul. Une parité ou un nombre de " +
        "décimales manque à l'appel.",
    );
  }

  // On ramène le signe sur le seul dividende, puis on raisonne en valeur
  // absolue : « s'éloigner de zéro » se lit alors simplement « arrondir au
  // supérieur », et les deux signes suivent exactement le même chemin.
  const numerateur = diviseur < ZERO ? -dividende : dividende;
  const denominateur = diviseur < ZERO ? -diviseur : diviseur;

  const negatif = numerateur < ZERO;
  const absolu = negatif ? -numerateur : numerateur;

  const quotient = absolu / denominateur;
  const reste = absolu % denominateur;
  // `reste * 2 >= denominateur` : la demi-unité bascule vers le haut.
  const arrondi = reste * DEUX >= denominateur ? quotient + UN : quotient;

  return negatif ? -arrondi : arrondi;
}
