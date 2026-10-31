/**
 * LES RÈGLES DE SAISIE DES MENTIONS LÉGALES, SANS PRISMA
 * (9I8D-SECURITE-NOUVEAU-LIEN-MULTI-SOCIETE, point 5, réserve de 9I7D).
 *
 * Extrait de `lib/societes/identite.ts` pour que le composant CLIENT
 * (`editeur-mentions-legales.tsx`) puisse valider AVANT d'envoyer le
 * formulaire, sans tirer `avecContexteApplicatif`/Prisma dans le paquet
 * client — et sans recopier la règle, ce qui l'aurait condamnée à diverger
 * (§9, 01/09) : le serveur et le client lisent désormais la MÊME constante.
 */

/** La borne de longueur des mentions légales. */
export const MENTIONS_LEGALES_MAX = 1000;

/**
 * UN OCTET NUL OU UN CARACTÈRE DE CONTRÔLE (hors tabulation et retour à la
 * ligne) — réserve de la revue de 9I7A, 9I7D-RESERVES-DE-REVUE-ACCES-ET-
 * MENTIONS, point 3. PostgreSQL refuse déjà l'octet NUL dans une colonne
 * texte (erreur non maîtrisée, 500) ; les autres caractères de contrôle
 * passeraient tels quels dans un pied de document imprimé. `\t` (0x09) et
 * `\n` (0x0A, APRÈS normalisation) restent permis.
 */
export const CARACTERE_CONTROLE_INTERDIT = /[\u0000-\u0008\u000B-\u001F\u007F]/;

/**
 * Espaces de bord retirés, `\r\n` → `\n` AVANT le décompte et le stockage —
 * un texte saisi sur un clavier dont le navigateur pose `\r\n` comptait deux
 * caractères pour un seul retour à la ligne, et le stockage s'écartait du
 * texte relu, un aller-retour qui changeait le texte à l'insu de qui l'a
 * saisi. Les retours à la ligne internes restent, SEULE leur forme change.
 */
export function mentionsLegalesNettoyees(texte: string): string | null {
  const normalise = texte.replace(/\r\n/g, "\n");
  const nettoye = normalise.trim();
  return nettoye === "" ? null : nettoye;
}
