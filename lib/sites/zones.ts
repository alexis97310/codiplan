import { z } from "zod";

/**
 * Les ZONES GÉOGRAPHIQUES, énumération arrêtée par D23 (ticket L1-02).
 *
 * ## Ce que D23 arrête, et où cette liste est TENUE
 *
 * Six zones : `grand_noumea`, `sud`, `cote_est`, `cote_ouest`, `nord`, `iles`.
 * C'est un arbitrage de rang 1, et il est fermé — en ajouter une septième passe
 * par un arbitrage, jamais par un ticket.
 *
 * **Mais la liste est tenue ICI, à l'entrée serveur, et non en base.** C'est une
 * décision, et elle mérite d'être lue plutôt que devinée.
 *
 * Ces six valeurs sont la géographie d'UN territoire — la Nouvelle-Calédonie.
 * `grand_noumea` et `cote_est` n'ont aucun sens pour une société vendue en
 * métropole, et le jeu de démonstration en compte déjà une (CODIMA-EU, agence
 * « Siège »). Les figer en type énuméré PostgreSQL ou en contrainte `CHECK`
 * ferait de la carte de la Nouvelle-Calédonie une contrainte du produit, et il
 * faudrait une migration le jour du premier client hors territoire. C'est la
 * forme exacte de deux erreurs déjà commises et inscrites au §9 du CLAUDE.md :
 * `code_winpro`, une colonne nommée d'après l'outil d'un seul client (19/08), et
 * l'énumération des rôles fermée avant qu'on ait tranché à qui l'on vend
 * (20/08).
 *
 * Ce que le dépôt perd à ne pas la fermer en base : un `UPDATE` passé à la main
 * dans une console pourrait écrire `koumac`. Ce qu'il gagne : la table `site`
 * n'a pas d'opinion sur la géographie de son acheteur. Le point est porté au
 * registre des arbitrages du ticket, avec ses deux options.
 *
 * **Le rapport à `zone_geo` du chapitre 11.3** (`enum[]` sur `forfait`, RG-TAR-06)
 * est le même : c'est la MÊME énumération, et elle se lira ici quand L1-06
 * l'utilisera. Une seconde liste écrite là-bas serait la divergence silencieuse
 * du 01/09 — deux lectures d'un même critère, chacune juste sur la sienne.
 */

/** Les six zones de D23, dans l'ordre où l'arbitrage les écrit. */
export const ZONES_GEOGRAPHIQUES = [
  "grand_noumea",
  "sud",
  "cote_est",
  "cote_ouest",
  "nord",
  "iles",
] as const;

/** Une zone géographique, telle que D23 la ferme. */
export type ZoneGeographique = (typeof ZONES_GEOGRAPHIQUES)[number];

/**
 * Validation d'une zone à l'entrée serveur.
 *
 * `null` est une valeur légitime — un site dont la zone n'est pas renseignée
 * existe, et RG-PLA-05 le prévoit : l'estimation par zone n'est qu'un DÉFAUT,
 * appliqué en l'absence de `temps_trajet_min`. Refuser l'absence obligerait à
 * inventer une zone à l'import, ce que D29 a déjà refusé pour le code externe.
 */
export const schemaZoneGeographique = z.enum(ZONES_GEOGRAPHIQUES).nullable();

/** La valeur est-elle l'une des six zones arrêtées par D23 ? */
export function estZoneConnue(valeur: string | null): boolean {
  return (
    valeur !== null &&
    (ZONES_GEOGRAPHIQUES as readonly string[]).includes(valeur)
  );
}
