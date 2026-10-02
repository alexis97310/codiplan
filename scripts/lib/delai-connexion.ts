/**
 * LE DÉLAI DE CONNEXION, ET LE SEUL NOUVEL ESSAI QU'IL AUTORISE
 * (9CR-CI-CLOISONNEMENT-CONNEXION).
 *
 * Prisma ouvre une connexion avec un délai par défaut de 5 s — une valeur
 * pensée pour un réseau local. Neon suspend un calcul inactif, et son réveil
 * par le point de mutualisation (`-pooler`) peut dépasser ce délai : c'est
 * l'HYPOTHÈSE que ce module rend vérifiable, pas encore une mesure (voir la
 * passation du lot). Le même dépassement a déjà produit un faux rouge de
 * SÉCURITÉ à la veille nocturne, pour une transaction entière cette fois
 * (`scripts/lib/veille-delais.ts`, incident du 12/09/2026) ; ici l'enjeu est
 * plus étroit — une seule connexion, un contrôle de CI — et le remède est à
 * l'échelle : un délai porté à 30 s (la même valeur qu'`ATTENTE_CONNEXION_MS`
 * de la veille, et pour la même raison), et UN SEUL nouvel essai, réservé à
 * l'erreur de liaison `P1001`. Toute autre erreur — un rôle refusé, un
 * cloisonnement en défaut — échoue comme aujourd'hui, du premier coup : ce
 * module ne retente rien qui ne soit un problème de LIAISON.
 */

/** Le paramètre de délai de connexion que Prisma lit dans l'URL. */
const PARAMETRE_DELAI = "connect_timeout";

/**
 * Ajoute `connect_timeout=<secondes>` à l'URL si l'appelant n'en a pas déjà
 * posé un — une valeur déjà présente est celle que quelqu'un a choisie, et
 * cette fonction ne l'écrase jamais. Tous les autres paramètres sont
 * conservés tels quels, et une URL sans aucun paramètre en reçoit un.
 */
export function avecDelaiDeConnexion(url: string, secondes: number): string {
  const analysee = new URL(url);
  if (!analysee.searchParams.has(PARAMETRE_DELAI)) {
    analysee.searchParams.set(PARAMETRE_DELAI, String(secondes));
  }
  return analysee.toString();
}

/** Le code Prisma porté par une erreur, qu'il soit sous `errorCode` ou `code`. */
export function codePrisma(erreur: unknown): string | undefined {
  const porteur = erreur as { errorCode?: unknown; code?: unknown } | null;
  if (typeof porteur?.errorCode === "string") {
    return porteur.errorCode;
  }
  if (typeof porteur?.code === "string") {
    return porteur.code;
  }
  return undefined;
}

/** Code Prisma d'une base injoignable — et le seul que ce module retente. */
export const CODE_LIAISON_RETENTABLE = "P1001";

/**
 * Faut-il un nouvel essai ? Oui une fois, et seulement sur `P1001`.
 *
 * `tentative` compte depuis 1 — le numéro de la tentative qui vient
 * d'échouer. Un deuxième `P1001` (`tentative` vaut alors 2) ne retente plus :
 * sans cette borne, une base durablement injoignable se cacherait derrière
 * une boucle plutôt que d'échouer franchement.
 */
export function doitReessayer(
  code: string | undefined,
  tentative: number,
): boolean {
  return code === CODE_LIAISON_RETENTABLE && tentative === 1;
}
