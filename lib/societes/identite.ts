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
 * **La devise porte son libellé et ses décimales** (9EWD-PARAMETRES-HUB-
 * MAQUETTE) — la carte affiche « Franc pacifique (XPF), sans décimale »,
 * jamais le seul code : le libellé et le compte de décimales viennent du
 * référentiel `Devise` (I3), jamais approchés ni recopiés.
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
  devise: { select: { code: true, libelle: true, decimales: true } },
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

/**
 * LE SIGLE DE LA PASTILLE (9EWD-PARAMETRES-HUB-MAQUETTE, M:4358) — dérivé des
 * initiales de la raison sociale, jamais saisi : deux mots donnent leurs
 * initiales, un seul donne ses deux premiers caractères.
 */
export function sigleDeLaRaisonSociale(raisonSociale: string): string {
  const mots = raisonSociale
    .trim()
    .split(/\s+/)
    .filter((mot) => mot.length > 0);
  if (mots.length >= 2) {
    return (mots[0]!.charAt(0) + mots[1]!.charAt(0)).toLocaleUpperCase("fr");
  }
  return (mots[0] ?? "").slice(0, 2).toLocaleUpperCase("fr");
}
