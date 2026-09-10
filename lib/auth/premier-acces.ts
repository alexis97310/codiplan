import { z } from "zod";

import { auth, type Auth } from "./config";
import { dansUnEchangeAuth } from "./echange";

/**
 * LE PREMIER ACCÈS — choisir un mot de passe contre un jeton à usage unique.
 *
 * ## Pourquoi ce module existe séparément de la route
 *
 * Pour la même raison que `lib/auth/enrolement.ts` : *le premier écran n'a
 * d'intérêt que s'il s'éprouve sans navigateur.* La règle vit ici, la route
 * n'est qu'une surface HTTP, et un scénario d'isolation appelle la même chaîne
 * que le formulaire.
 *
 * ## LES REFUS SONT INDISCERNABLES, ET C'EST LA RÈGLE
 *
 * Jeton inconnu, jeton expiré, jeton déjà consommé : **un seul motif**. Les
 * distinguer apprendrait à un tiers si un compte existe et s'il a déjà servi —
 * exactement le renseignement que D35 et D50 refusent. Seuls les refus qui ne
 * parlent que de CE QUE L'UTILISATEUR VIENT DE SAISIR sont distingués : deux
 * saisies discordantes, et un mot de passe trop court. Ceux-là ne disent rien
 * de la base.
 *
 * ## CE QU'IL N'OUVRE PAS
 *
 * Aucune session. La personne se reconnecte avec le mot de passe qu'elle vient
 * de choisir, et son second facteur lui sera demandé si son rôle l'exige (D58).
 * *Une chaîne qui enchaînerait sur une session ouverte sauterait le facteur.*
 */

/** Le plancher de longueur, celui de Better Auth — écrit ici pour être lisible. */
export const LONGUEUR_MINIMALE = 8;

const Saisie = z.object({
  jeton: z.string().trim().min(1),
  motDePasse: z.string(),
  confirmation: z.string(),
});

export type SaisiePremierAcces = z.input<typeof Saisie>;

export type IssuePremierAcces =
  | { readonly issue: "abouti" }
  | { readonly issue: "discordance" }
  | { readonly issue: "trop_court" }
  | { readonly issue: "refuse" };

/**
 * Consomme le jeton et pose le mot de passe choisi.
 *
 * L'échange d'authentification est ouvert par l'appelant HTTP ; il l'est aussi
 * ici pour les scénarios qui appellent la fonction sans passer par la route.
 * `dansUnEchangeAuth` est réentrant — un échange déjà ouvert n'en ouvre pas un
 * second (voir `lib/auth/echange.ts`).
 */
export async function choisirLePremierMotDePasse(
  saisie: SaisiePremierAcces,
  // L'INSTANCE EST UN PARAMÈTRE, comme pour `tenterConnexion`. Un scénario
  // d'isolation la construit sur SON client — celui du harnais, soumis aux
  // politiques — là où la production prend le singleton. Sans cela, le
  // scénario mesurerait une autre base que celle qu'il vient de préparer, et
  // son refus viendrait du voisin (§9, 24/08).
  instance: Auth = auth(),
): Promise<IssuePremierAcces> {
  const analyse = Saisie.safeParse(saisie);
  if (!analyse.success) {
    return { issue: "refuse" };
  }
  const { jeton, motDePasse, confirmation } = analyse.data;

  // LES DEUX CONTRÔLES DE SAISIE VIENNENT AVANT LE JETON, et l'ordre compte :
  // ils ne consomment rien. Une discordance qui aurait brûlé le jeton
  // obligerait à en redemander un pour une faute de frappe.
  if (motDePasse !== confirmation) {
    return { issue: "discordance" };
  }
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return { issue: "trop_court" };
  }

  return dansUnEchangeAuth(async () => {
    try {
      await instance.api.resetPassword({
        body: { newPassword: motDePasse, token: jeton },
      });
      return { issue: "abouti" as const };
    } catch {
      // UN SEUL MOTIF, quelle que soit la cause. Voir l'en-tête : le détail
      // serait un renseignement sur l'existence et l'état d'un compte.
      return { issue: "refuse" as const };
    }
  });
}
