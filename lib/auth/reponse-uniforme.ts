import { t } from "@/lib/i18n/fr";

/**
 * Réponses d'authentification indiscernables (arbitrage D35, ticket L0-06b).
 *
 * **Le problème.** Trois refus différents disent trois choses différentes à qui
 * les provoque : « ce compte n'existe pas », « ce compte existe mais le mot de
 * passe est faux », « ce compte existe et n'est habilité nulle part ici ». Le
 * troisième est le plus coûteux : sur une plateforme multi-société vendue à des
 * entreprises qui se font concurrence, il transforme la page de connexion — et
 * plus encore celle de mot de passe oublié — en annuaire des clients. Un
 * concurrent apprend qui d'autre utilise CODIPLAN sans jamais entrer.
 *
 * **La réponse.** Un seul message pour tous les refus qu'un tiers peut
 * provoquer, et un plancher de durée commun pour que la réponse ne se trahisse
 * pas par sa rapidité. Ce module porte les deux, et il est le point de passage
 * unique : `lib/auth/connexion.ts` s'en sert pour le mot de passe,
 * `lib/auth/societe-active.ts` pour l'habilitation. Le chemin de
 * réinitialisation de mot de passe, quand il sera livré, devra s'en servir
 * aussi — c'est là que la fuite serait la plus large, puisqu'elle ne demande
 * même pas de mot de passe.
 *
 * **Ce qui reste distinct, et pourquoi.** Le refus « second facteur absent » ne
 * passe pas par ici : il n'est atteignable qu'une fois le mot de passe validé ET
 * l'habilitation établie. Il ne dit donc rien à un tiers, et le rendre opaque
 * priverait un utilisateur légitime de la seule information qui lui permette
 * d'agir.
 */

/**
 * Durée plancher d'une réponse d'authentification, refus comme acceptation.
 *
 * Ce n'est pas un délai métier : c'est une constante technique, choisie au-dessus
 * du coût observé du chemin le plus lent — vérification du mot de passe (scrypt,
 * volontairement coûteux) plus deux allers-retours de base. Tant que le travail
 * réel reste sous ce plancher, les trois refus rendent la main au même moment,
 * et l'écart de traitement cesse d'être mesurable depuis l'extérieur.
 *
 * Le relever est sans danger ; l'abaisser sous le coût réel du chemin le plus
 * lent rouvre la fuite, et le scénario `tests/isolation/reponses-indiscernables`
 * le fait alors échouer.
 */
export const PLANCHER_REPONSE_MS = 700;

/** Le message unique. Compte inexistant, mot de passe faux, habilitation absente. */
export function motifRefusUniforme(): string {
  return t("auth.refus");
}

/**
 * Exécute un travail en garantissant qu'il ne rend jamais la main avant le
 * plancher.
 *
 * Le `finally` compte autant que le reste : sans lui, un chemin qui lève une
 * exception — un compte inexistant, par exemple — répondrait plus vite que les
 * autres, et l'uniformité du message ne servirait à rien.
 */
export async function avecPlancherDeDuree<T>(
  travail: () => Promise<T>,
  plancherMs: number = PLANCHER_REPONSE_MS,
): Promise<T> {
  const debut = performance.now();
  try {
    return await travail();
  } finally {
    const reste = plancherMs - (performance.now() - debut);
    if (reste > 0) {
      await new Promise((resoudre) => setTimeout(resoudre, reste));
    }
  }
}
