/**
 * DÉCRIRE UNE CONNEXION SANS JAMAIS EN RECOPIER LE SECRET
 * (9CR-CI-CLOISONNEMENT-CONNEXION).
 *
 * Les runs #80 et #82 de « DB migrate & seed » (cible production) ont rougi
 * sur « Can't reach database server » à l'étape « Contrôle de cloisonnement »,
 * alors que l'étape « Appliquer la migration », juste avant, avait joint LA
 * MÊME base sans incident. Avant de supposer un hôte, un rôle ou un point de
 * mutualisation différents entre les deux URL, il faut pouvoir les NOMMER —
 * et les nommer sans jamais faire courir le risque qu'une main future
 * recopie une URL entière, secret compris, dans un journal d'exécution public
 * (même famille que D50, voir `tests/unit/ci/url-hors-journal.test.ts`).
 *
 * Cette fonction ne lit que ce qui identifie une connexion sans l'ouvrir :
 * l'hôte, le port, la base, les NOMS des paramètres de requête — jamais leur
 * valeur, qui peut porter un délai ou un mode de confiance mais dont la
 * prudence ne coûte rien. L'utilisateur et le mot de passe n'existent même
 * pas dans le type qu'elle rend.
 */

/** Ce que `decrireConnexion` peut dire d'une URL, sans jamais la recopier. */
export type DescriptionConnexion =
  | {
      readonly lisible: true;
      readonly hote: string;
      readonly port: string;
      /** L'hôte se termine par `-pooler` : point de mutualisation Neon. */
      readonly mutualise: boolean;
      /** Le segment qui suit le premier point de l'hôte (ex. `ap-southeast-2`), ou `null` s'il n'y en a pas. */
      readonly region: string | null;
      readonly base: string;
      /** Les NOMS des paramètres de requête — jamais leur valeur. */
      readonly parametres: readonly string[];
    }
  | { readonly lisible: false };

/**
 * Décrit une URL de connexion PostgreSQL sans jamais en recopier le contenu
 * sensible. Une URL vide, absente, ou que `URL` ne sait pas analyser rend
 * `{ lisible: false }` — jamais l'URL elle-même, même tronquée.
 */
export function decrireConnexion(
  url: string | undefined,
): DescriptionConnexion {
  if (url === undefined || url.trim().length === 0) {
    return { lisible: false };
  }

  let analysee: URL;
  try {
    analysee = new URL(url);
  } catch {
    return { lisible: false };
  }

  const segments = analysee.hostname.split(".");
  const premierSegment = segments[0] ?? "";

  return {
    lisible: true,
    hote: analysee.hostname,
    port: analysee.port,
    mutualise: premierSegment.endsWith("-pooler"),
    region: segments[1] ?? null,
    base: analysee.pathname.replace(/^\//, ""),
    parametres: [...analysee.searchParams.keys()],
  };
}
