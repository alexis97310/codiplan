import type { Prisma } from "@prisma/client";

import { estContexteActif } from "@/lib/auth/contexte";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";

import { THEME_DEFAUT, themeDeSociete, type ThemeSociete } from "./theme";

/**
 * Le thème de la SOCIÉTÉ ACTIVE de la session (ticket L0-09, point 4).
 *
 * **Cloisonnement.** La lecture passe par les deux barrières que I1 impose, et
 * dans cet ordre : le filtre applicatif (`where: { id: societeId }`) puis la
 * politique RLS de `societe`, qui est `id = app.societe_id` (D42). Une session
 * active sur A ne peut donc pas obtenir le thème de B — pas même en passant
 * l'identifiant de B, puisque la politique ne laisse voir que la société du
 * contexte. `tests/isolation/theme-societe.test.ts` le prouve dans les deux
 * sens, et prouve aussi le cas du portail : un compte client porte pour société
 * active celle qui le SERT, si bien que le portail affiche la charte de la
 * société émettrice et jamais celle du client (chapitre 7, M8).
 *
 * **Un thème ne fait jamais échouer un rendu.** Toute impossibilité — aucune
 * session, aucune société active, base injoignable — rend le thème neutre.
 * C'est délibéré : la charte est de la présentation, et une page de connexion
 * doit s'afficher alors même qu'aucune société n'est encore choisie. Le refus
 * d'accès aux DONNÉES, lui, reste entier : il est prononcé par les politiques
 * et par `exigerContexteActif`, jamais par la couleur d'un bandeau.
 */

/** Les seules colonnes qu'un thème lit. Aucune donnée métier n'entre ici. */
export const CHAMPS_THEME = {
  raison_sociale: true,
  couleur_primaire: true,
  couleur_secondaire: true,
} as const;

/**
 * Lit le thème de `societeId` sous le contexte cloisonné DÉJÀ POSÉ sur `tx`.
 *
 * Extraite pour que les scénarios d'isolation éprouvent exactement la requête
 * que sert l'application — sous le rôle applicatif restreint, politiques
 * comprises — et non une variante écrite pour le test.
 */
export async function lireThemeCloisonne(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<ThemeSociete> {
  const societe = await tx.societe.findFirst({
    where: { id: societeId },
    select: CHAMPS_THEME,
  });
  return themeDeSociete(societe);
}

/**
 * Le thème à appliquer au rendu d'une requête, d'après ses en-têtes.
 *
 * Appelé par la mise en page racine, côté serveur : les variables CSS partent
 * dans le HTML, sans script ni clignotement.
 */
export async function themeDeLaSession(
  entetes: Headers,
): Promise<ThemeSociete> {
  try {
    const session = await obtenirSession(entetes);
    if (session === null || !estContexteActif(session.contexte)) {
      return THEME_DEFAUT;
    }
    const contexte = session.contexte;
    return await avecContexteApplicatif(contexte, (tx) =>
      lireThemeCloisonne(tx, contexte.societeId),
    );
  } catch {
    // Voir l'entête : la charte n'est jamais un motif d'échec de rendu.
    return THEME_DEFAUT;
  }
}
