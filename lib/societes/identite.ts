import type { Prisma } from "@prisma/client";

/**
 * L'IDENTITÉ DE LA SOCIÉTÉ ACTIVE, EN LECTURE SEULE (QT-22, D167, 05/10/2026,
 * TP-NAV1).
 *
 * Six colonnes, et pas une de plus : celles que la carte « Identité » du hub
 * de paramétrage affiche. Aucun réglage n'écrit ici — la charte (couleurs) et
 * le reste de la société ont leur propre chemin d'écriture, hors de ce
 * module, et cette liste ne s'agrandit pas au passage.
 *
 * **Cloisonnement.** Même discipline que `lireThemeCloisonne`
 * (`lib/theme/session.ts`) : le filtre applicatif (`where: { id: societeId }`)
 * puis la politique RLS de `societe` (`id = app.societe_id`, D42) — une
 * session active sur A ne peut pas lire l'identité de B, pas même en le
 * demandant explicitement.
 */
export const CHAMPS_IDENTITE = {
  raison_sociale: true,
  territoire: true,
  fuseau_horaire: true,
  devise_code: true,
  libelle_code_externe: true,
  mentions_legales: true,
} as const;

export type IdentiteSociete = Prisma.SocieteGetPayload<{
  select: typeof CHAMPS_IDENTITE;
}>;

/**
 * Lit l'identité de `societeId` sous le contexte cloisonné DÉJÀ POSÉ sur `tx`.
 *
 * Extraite pour que le scénario d'isolation éprouve exactement la requête que
 * sert l'application — sous le rôle applicatif restreint, politiques
 * comprises — et non une variante écrite pour le test.
 */
export async function lireIdentiteCloisonnee(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<IdentiteSociete | null> {
  return tx.societe.findFirst({
    where: { id: societeId },
    select: CHAMPS_IDENTITE,
  });
}
