import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma as clientParDefaut } from "@/lib/db/client";

import { auth, type Auth } from "./config";
import { dansUnEchangeAuth } from "./echange";
import { fermerSessionsDuCompte } from "./fermeture-sessions";
import { avecDesignationAuth } from "./lecture-identite";

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
 *
 * ## CE QU'IL FERME (décision d'Alexis du 10/11/2026,
 * 9L09-SESSIONS-FERMEES-REINITIALISATION)
 *
 * TOUTES les sessions déjà ouvertes du compte, une fois le mot de passe posé
 * — ce module n'en ouvre aucune (voir ci-dessus), il n'y a donc pas de
 * session « courante » à épargner, à la différence de
 * `changerSonMotDePasse` (`lib/auth/mon-compte.ts`), qui, lui, en préserve
 * une. Pour un PREMIER accès, aucune session n'existe encore : fermer « tout »
 * revient à fermer « rien ». Pour un NOUVEAU lien (D86, mot de passe oublié,
 * compte déjà actif ailleurs), c'est tout l'objet du geste : un poste perdu
 * ou partagé ne doit plus rien valoir une fois le mot de passe changé.
 *
 * **MESURÉ** : l'option du greffon, `emailAndPassword.revokeSessionsOnPasswordReset`,
 * appelle `deleteUserSessions` à travers `avecDesignationAuth`
 * (`lib/auth/config.ts`), qui ne pose AUCUNE désignation pour un `WHERE
 * utilisateur_id = …` sur `session` (`CLES_DESIGNATION.session.ou` n'admet
 * que le jeton, jamais l'identifiant — `lib/auth/lecture-identite.ts`) :
 * **zéro ligne supprimée**, même constat que celui déjà écrit pour
 * `deleteUserSessions` dans `lib/auth/mon-compte.ts`. Ce module ferme donc les
 * sessions LUI-MÊME (`fermerSessionsDuCompte`, `lib/auth/fermeture-sessions.ts`),
 * en désignant la cible par `app.utilisateur_id` dans une transaction qu'il
 * contrôle entièrement — même patron que `revoquerAccesPortailClient` et
 * `retirerAccesInterne`.
 *
 * Le compte visé est appris en lisant `verification` AVANT l'appel à
 * `resetPassword` (sous désignation, par l'identifiant du jeton — la même clé
 * que Better Auth lit lui-même) : `resetPassword` ne rend jamais l'identité
 * dans sa réponse. Un jeton qui ne désigne rien (inconnu, déjà consommé) ne
 * fait rien fuiter de plus : le refus qui suit reste le même motif unique,
 * et aucune session n'est fermée.
 */

/** Le plancher de longueur, celui de Better Auth — écrit ici pour être lisible. */
export const LONGUEUR_MINIMALE = 8;

/**
 * LE PLAFOND (9L28-PORTAIL-PHOTOS-BORNES-D236, décision d'Alexis du
 * 10/11/2026) — sans lui, `motDePasse` était un `z.string()` nu, sans
 * aucune borne : un appelant direct pouvait soumettre un texte de plusieurs
 * mégaoctets, haché par bcrypt comme n'importe quel autre. 128 dépasse
 * largement tout mot de passe choisi à la main ou par un gestionnaire.
 */
export const LONGUEUR_MAXIMALE = 128;

const Saisie = z.object({
  jeton: z.string().trim().min(1),
  motDePasse: z.string().max(LONGUEUR_MAXIMALE),
  confirmation: z.string().max(LONGUEUR_MAXIMALE),
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
  // MÊME CLIENT QUE `instance` — un scénario d'isolation passe le sien pour
  // les deux ; la production prend le même singleton par défaut (voir
  // l'en-tête : la fermeture des sessions lit et écrit sur CE client).
  client: PrismaClient = clientParDefaut,
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
    // LU AVANT LA CONSOMMATION — `resetPassword` ne rend jamais l'identité
    // dans sa réponse, et le jeton n'existe plus une fois consommé. Voir
    // l'en-tête : une désignation absente (jeton inconnu) ne fait rien
    // fuiter, le refus qui suit restant le même motif unique.
    const avant = await avecDesignationAuth(client).verification.findFirst({
      where: { identifiant: `reset-password:${jeton}` },
      select: { valeur: true },
    });
    try {
      await instance.api.resetPassword({
        body: { newPassword: motDePasse, token: jeton },
      });
    } catch {
      // UN SEUL MOTIF, quelle que soit la cause. Voir l'en-tête : le détail
      // serait un renseignement sur l'existence et l'état d'un compte.
      return { issue: "refuse" as const };
    }
    // FERME TOUTES LES SESSIONS DU COMPTE — voir l'en-tête de la fonction.
    if (avant !== null) {
      await fermerSessionsDuCompte(client, avant.valeur);
    }
    return { issue: "abouti" as const };
  });
}
