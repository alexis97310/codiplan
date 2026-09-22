/**
 * LE PORTAIL DE PUBLICATION (RELEASE-1) — le verdict, et rien d'autre.
 *
 * ## Ce que ce module répond
 *
 * Une question unique : *le code que ce commit s'apprête à publier a-t-il, en
 * face de lui, une base de production qui porte les migrations qu'il attend ?*
 * Trois réponses, et jamais une quatrième :
 *   — `publier`  : la base porte tout ce que le dépôt attend ;
 *   — `bloquer`  : il manque au moins une migration — **nommée**, comme
 *     `/sante` le fait déjà (`lib/db/sante.ts`, `verdictDesMigrations`) ;
 *   — `illisible` : l'état des migrations appliquées n'a pas pu être obtenu.
 *     *Publier à l'aveugle est exactement l'incident du 23/09 au matin* — une
 *     base illisible bloque donc la publication, au même titre qu'une base en
 *     retard, mais le motif ne dit jamais « tout va bien » à sa place.
 *
 * ## Pourquoi `bloquer` et `illisible` ne se confondent jamais
 *
 * Le 23/09, l'étape « contrôle de cloisonnement » du flux de migration a
 * échoué sur *« Can't reach database server »* pendant que les migrations,
 * elles, passaient : la variable de connexion vue par l'un n'était pas celle
 * vue par l'autre. Un portail qui rendrait le même mot pour « la base est en
 * retard » et pour « je n'ai pas pu la lire » cacherait cette distinction-là
 * derrière un unique verdict — c'est pourquoi `illisible` porte son propre
 * motif, distinct du nom de la migration manquante.
 *
 * ## Une fonction pure, sans base
 *
 * Elle ne se connecte à rien : on lui donne la liste que le dépôt attend
 * (`lib/db/migrations-attendues.ts`, réutilisée telle quelle) et la liste que
 * la base porte réellement — ou `null` quand cette seconde liste n'a pas pu
 * être obtenue. C'est `scripts/portail-publication.mts` qui obtient cette
 * seconde liste, jamais ce module.
 */

export type VerdictPublication =
  | { readonly decision: "publier" }
  | {
      readonly decision: "bloquer";
      /** La PREMIÈRE migration manquante, dans l'ordre du dépôt. */
      readonly nom: string;
      readonly nombre: number;
    }
  | { readonly decision: "illisible"; readonly motif: string };

/**
 * `appliquees` vaut `null` quand l'état de la base n'a pas pu être obtenu —
 * et seulement dans ce cas. Une liste VIDE n'est pas `null` : c'est une base
 * qui répond et qui ne porte encore aucune migration, un état légitime avant
 * la toute première mise en ligne — elle se traite comme n'importe quelle
 * base en retard, en nommant la première migration attendue.
 */
export function verdictDePublication(
  attendues: readonly string[],
  appliquees: readonly string[] | null,
): VerdictPublication {
  if (appliquees === null) {
    return {
      decision: "illisible",
      motif:
        "L'état des migrations appliquées en production n'a pas pu être obtenu.",
    };
  }

  const posees = new Set(appliquees);
  // L'ORDRE est celui du dépôt : la première absente est celle par laquelle
  // la base a décroché (même lecture que `verdictDesMigrations`, `sante.ts`).
  const absentes = attendues.filter((nom) => !posees.has(nom));

  if (absentes.length === 0) {
    return { decision: "publier" };
  }
  return { decision: "bloquer", nom: absentes[0]!, nombre: absentes.length };
}
