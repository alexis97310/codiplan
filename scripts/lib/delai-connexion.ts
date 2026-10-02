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
 *
 * Resserré le 02/10/2026 (relecture 9CR, lot 9CV-RETOUCHES-6) : la version
 * précédente passait par `URL`/`URLSearchParams`, qui RÉ-ENCODENT toute la
 * requête au passage (`options=-c%20x` devenait `options=-c+x` — mesure
 * relecture). Sans effet sur les URL Neon d'aujourd'hui, mais un piège pour
 * le jour où un `options=` y apparaîtrait. Cette version ne touche QUE la
 * chaîne d'origine : elle cherche `connect_timeout=` par une recherche
 * textuelle (donc insensible à tout encodage déjà présent), et concatène le
 * nouveau paramètre par `?` ou `&` selon qu'il existe déjà une requête,
 * avant un éventuel `#` de fragment — jamais après.
 *
 * `new URL(url)` sert de GARDE — une URL non analysable lève — mais son
 * résultat n'est jamais utilisé pour reconstruire la chaîne : ce serait
 * exactement le ré-encodage que le resserrement du 02/10/2026 a retiré
 * (constat du 03/10/2026, relecture 9CY, lot 9CZ-RETOUCHES-9 : la version
 * resserrée avait perdu, avec `URL`/`URLSearchParams`, la validation que
 * l'ancienne portait aussi).
 */
export function avecDelaiDeConnexion(url: string, secondes: number): string {
  new URL(url);

  const finFragment = url.indexOf("#");
  const corps = finFragment === -1 ? url : url.slice(0, finFragment);
  const fragment = finFragment === -1 ? "" : url.slice(finFragment);

  const indexRequete = corps.indexOf("?");
  const requete = indexRequete === -1 ? "" : corps.slice(indexRequete + 1);
  if (new RegExp(`(^|[?&])${PARAMETRE_DELAI}=`).test(requete)) {
    return url;
  }

  const separateur = indexRequete === -1 ? "?" : "&";
  return `${corps}${separateur}${PARAMETRE_DELAI}=${secondes}${fragment}`;
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

/** Le délai, en millisecondes, avant le seul nouvel essai autorisé. */
export const DELAI_NOUVEL_ESSAI_MS = 10_000;

/**
 * Ouvre une connexion ; sur `P1001`, UN nouvel essai après `attendre`, et
 * plus aucun ensuite (`doitReessayer`). Dépendances INJECTÉES — `connecter`,
 * `attendre`, `ecrire` — pour que cette boucle réelle (et non la seule
 * fonction pure `doitReessayer`) soit éprouvable sans jamais ouvrir de
 * connexion ni attendre 10 s (déplacée de `scripts/controle-cloisonnement.mts`
 * le 02/10/2026, relecture 9CR, lot 9CV-RETOUCHES-6 : la boucle elle-même
 * n'était testée que par un gardien statique sur le SOURCE du script, qui ne
 * peut rien dire d'une exécution réelle).
 */
export async function connecterAvecReessai(
  tentative: number,
  connecter: () => Promise<void>,
  attendre: (ms: number) => Promise<void>,
  ecrire: (message: string) => void,
): Promise<void> {
  try {
    await connecter();
  } catch (erreur) {
    if (doitReessayer(codePrisma(erreur), tentative)) {
      ecrire(
        "Base injoignable, nouvel essai dans 10 s (P1001) : Neon endort un " +
          "calcul inactif, et le réveil par le point de mutualisation peut " +
          "dépasser le délai de connexion.\n",
      );
      await attendre(DELAI_NOUVEL_ESSAI_MS);
      await connecterAvecReessai(tentative + 1, connecter, attendre, ecrire);
      return;
    }
    throw erreur;
  }
}
