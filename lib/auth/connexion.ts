import { type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma as clientParDefaut } from "@/lib/db/client";

import { auth, type Auth } from "./config";
import { avecDesignationIdentite } from "./lecture-identite";
import { avecPlancherDeDuree, motifRefusUniforme } from "./reponse-uniforme";

/**
 * Ouverture de session par mot de passe (arbitrage D35, ticket L0-06b).
 *
 * Better Auth rend déjà le même code d'erreur pour un compte inexistant et pour
 * un mot de passe faux, et hache un mot de passe pour rien quand le compte est
 * introuvable — deux précautions justes, mais insuffisantes ici pour deux
 * raisons : son message est le sien, en anglais, et rien ne garantit que le
 * temps de réponse des deux chemins reste du même ordre. Ce module ajoute les
 * deux pièces manquantes, communes à tous les refus (voir
 * `lib/auth/reponse-uniforme.ts`).
 *
 * **Identités globales (D35).** Une même personne travaille légitimement pour
 * deux sociétés : l'identité est unique au niveau plateforme — un compte, une
 * adresse électronique, un mot de passe —, les habilitations sont par société.
 * Cette fonction n'établit donc que l'identité. Elle n'ouvre aucune société : la
 * session sort d'ici sans `societe_id_active`, et ne lit rien tant que
 * `basculerSociete` n'a pas relu une habilitation en base.
 *
 * C'est aussi pourquoi le troisième cas de D35 — « compte sans habilitation » —
 * ne se refuse pas ici mais à la bascule : le même message uniforme y est rendu,
 * et le scénario
 * `tests/isolation/reponses-indiscernables.test.ts` éprouve les trois cas
 * ensemble.
 */

/** Entrée serveur — validée par Zod, sans exception (CLAUDE.md §2). */
export const schemaDemandeConnexion = z.object({
  email: z.email(),
  motDePasse: z.string().min(1),
});

export type DemandeConnexion = z.infer<typeof schemaDemandeConnexion>;

/**
 * Issue d'une tentative de connexion.
 *
 * `refus` couvre indistinctement le compte inexistant, le mot de passe faux, le
 * compte désactivé et l'entrée malformée : c'est le fond de D35.
 */
export type ResultatConnexion =
  | {
      readonly issue: "session";
      readonly sessionId: string;
      readonly utilisateurId: string;
    }
  | { readonly issue: "second_facteur_requis" }
  | { readonly issue: "refus"; readonly motif: string };

/**
 * Les deux formes que Better Auth peut rendre, relues par un schéma plutôt que
 * par une conversion de type : une réponse inattendue doit dégrader en refus,
 * pas se propager en aval (même parti pris que `lib/auth/session.ts`).
 */
const schemaSecondFacteur = z.object({ twoFactorRedirect: z.literal(true) });
const schemaSessionOuverte = z.object({
  token: z.string().min(1),
  user: z.object({ id: z.uuid() }),
});

function refus(): ResultatConnexion {
  return { issue: "refus", motif: motifRefusUniforme() };
}

/**
 * Tente d'ouvrir une session, et rend toujours la main au même moment.
 *
 * L'entrée est `unknown` à dessein : la validation Zod fait partie du chemin
 * chronométré. Une adresse malformée rejetée avant le plancher répondrait plus
 * vite que le reste, et cet écart-là se mesure aussi bien qu'un autre.
 */
export async function tenterConnexion(
  entree: unknown,
  instance: Auth = auth(),
  client: PrismaClient = clientParDefaut,
): Promise<ResultatConnexion> {
  return avecPlancherDeDuree(async () => {
    const demande = schemaDemandeConnexion.safeParse(entree);
    if (!demande.success) {
      return refus();
    }

    let reponse: unknown;
    try {
      reponse = await instance.api.signInEmail({
        body: {
          email: demande.data.email,
          password: demande.data.motDePasse,
        },
      });
    } catch {
      // Compte inexistant ou mot de passe faux : Better Auth lève dans les deux
      // cas, et c'est bien ce qu'on veut — il n'y a rien à distinguer.
      return refus();
    }

    if (schemaSecondFacteur.safeParse(reponse).success) {
      // Atteignable seulement avec le bon mot de passe : ne dit rien à un tiers.
      return { issue: "second_facteur_requis" };
    }

    const ouverte = schemaSessionOuverte.safeParse(reponse);
    if (!ouverte.success) {
      return refus();
    }

    // ── DEUX LECTURES, ET NON UNE JOINTURE (L1-02c) ────────────────────────
    //
    // Cette ligne lisait `utilisateur` par une relation IMBRIQUÉE OBLIGATOIRE
    // depuis `session`. Depuis que `utilisateur` porte une politique, Prisma
    // lève « Field utilisateur is required to return data, got null » : la
    // relation est filtrée, et il refuse de rendre une ligne incomplète.
    //
    // La séparation n'est pas un contournement, c'est la forme juste. La
    // session se lit par son jeton — `session` n'a pas de politique (troisième
    // catégorie de I1, D34). L'identité se lit par son IDENTIFIANT, que
    // l'appelant tient déjà de la réponse de Better Auth : c'est très
    // exactement la forme « désignation », et l'enveloppe de
    // `lib/auth/lecture-identite.ts` la nomme.
    const session = await client.session.findUnique({
      where: { token: ouverte.data.token },
      select: { id: true, utilisateur_id: true },
    });

    const identite =
      session === null
        ? null
        : await avecDesignationIdentite(client).utilisateur.findUnique({
            where: { id: session.utilisateur_id },
            select: { actif: true },
          });

    // Compte désactivé : Better Auth ne connaît pas `utilisateur.actif`, qui est
    // à nous. La session qu'il vient d'ouvrir est retirée — sans quoi un compte
    // désactivé garderait un jeton valide —, et le refus reste le même.
    if (session === null || identite === null || !identite.actif) {
      await client.session.deleteMany({
        where: { token: ouverte.data.token },
      });
      return refus();
    }

    return {
      issue: "session",
      sessionId: session.id,
      utilisateurId: ouverte.data.user.id,
    };
  });
}
