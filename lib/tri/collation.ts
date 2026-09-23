/**
 * LE TRI ALPHANUMÉRIQUE DES LISTES DE RÉFÉRENTIEL (LISTES-1, 23/09/2026).
 *
 * Alexis, en production : *« tous les classements doivent se faire par ordre
 * alphanumérique croissant. »* — arrêté pour les listes de RÉFÉRENTIEL
 * (clients, sites, parc, menus déroulants), jamais pour une liste DATÉE
 * (interventions, historiques), qui reste par date.
 *
 * ## MESURÉ AVANT DE CHOISIR
 *
 * `psql` contre la base de test locale (`en_US.utf8`) le 23/09/2026 : elle
 * ordonne déjà « Anse Vata » avant « AVIS SLAP LOCATOIN ». Le défaut mesuré
 * EN PRODUCTION — les majuscules d'abord — est donc une propriété de LA BASE
 * hébergée, pas de ce dépôt : tout indique une collation d'octets (`C`), que
 * ce ticket n'a ni les moyens de mesurer à distance ni le droit de changer —
 * `CLAUDE.md §2` interdit le SQL brut hors migration, et recréer une base
 * pour lui donner une autre collation est une migration qu'aucun ticket n'a
 * demandée (§8).
 *
 * **Le tri est donc fait ICI, en JavaScript, et jamais délégué à
 * `ORDER BY`** : c'est la seule garantie du MÊME ordre quelle que soit la
 * collation de la base qui répond. `Intl.Collator` fait exactement ce que la
 * demande décrit — insensible à la casse ET aux accents
 * (`sensitivity: "base"`), et « Site 2 » avant « Site 10 » plutôt que l'ordre
 * lexicographique (`numeric: true`), qu'aucune collation Postgres par défaut
 * ne rend sans extension ICU explicite.
 */

const COLLATEUR_REFERENTIEL = new Intl.Collator("fr", {
  sensitivity: "base",
  numeric: true,
});

/** Compare deux libellés dans l'ordre alphanumérique croissant du référentiel. */
export function comparerAlphanumerique(a: string, b: string): number {
  return COLLATEUR_REFERENTIEL.compare(a, b);
}

/**
 * Trie une liste de référentiel par une clé textuelle.
 *
 * `departager` lève l'indétermination quand deux clés sont égales à la
 * collation près (deux sites au même libellé) — sans elle, l'ordre d'un tri
 * instable dépendrait de la base, exactement ce que ce fichier existe pour
 * éviter. Par défaut, aucun départage : l'ordre relatif de deux clés égales
 * n'est alors pas garanti, ce qui suffit à une liste dont les clés ne se
 * répètent pas (une énumération, par exemple).
 */
export function trierAlphanumeriquement<T>(
  items: readonly T[],
  cle: (item: T) => string,
  departager?: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const ecart = comparerAlphanumerique(cle(a), cle(b));
    if (ecart !== 0 || departager === undefined) {
      return ecart;
    }
    return departager(a).localeCompare(departager(b));
  });
}
