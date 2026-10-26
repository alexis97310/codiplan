/**
 * TERRITOIRE ET FUSEAU, EN LIBELLÉS LISIBLES (9G6-FORMULAIRES, point 6) —
 * `/parametres/agences/nouvelle` et la fiche d'une agence affichaient le
 * CODE brut du territoire (« FR », « NC ») et les ~400 identifiants IANA du
 * fuseau en anglais technique (`Pacific/Noumea`), jamais un nom lisible.
 *
 * ## Le territoire reste un référentiel OUVERT (`jour_ferie`, I1 2e catégorie)
 *
 * `territoiresConnus` lit les codes RÉELLEMENT présents en base — un code
 * absent de la liste ci-dessous (un territoire ajouté demain par migration)
 * retombe sur lui-même plutôt que de disparaître ou de lever : le gardien
 * de §8 n'invente jamais un libellé pour un code qu'il ne connaît pas.
 *
 * ## CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI (point ouvert en passation)
 *
 * La maquette citée par le ticket montre « Nouméa (UTC+11) » et les fuseaux
 * du territoire choisi en tête de liste. Les deux sont HORS DE PORTÉE ici :
 * un décalage UTC vient d'`Intl.DateTimeFormat(...).formatToParts(new
 * Date())`, que `tests/unit/calendar/sans-date-courante-implicite.test.ts`
 * interdit hors de `lib/calendar/fuseau.ts` (I7, D46) ; une liste de fuseaux
 * « du territoire » commencerait par ÉCRIRE un identifiant IANA en dur
 * (`"Pacific/Noumea"`), que `tests/unit/calendar/sans-fuseau-en-dur.test.ts`
 * interdit partout hors `prisma/seed-data.ts`. Les deux gardiens n'ont ni
 * exemption ouverte ni liste à étendre (interdit du lot : « aucune exemption
 * de gardien »). Ce fichier ne porte donc que le nom de ville lisible —
 * jamais un décalage, jamais un tri qui nommerait un fuseau.
 */
const LIBELLES_TERRITOIRE: Readonly<Record<string, string>> = {
  NC: "Nouvelle-Calédonie",
  FR: "France métropolitaine",
};

export function libelleTerritoire(code: string): string {
  return LIBELLES_TERRITOIRE[code] ?? code;
}

/**
 * Les quelques noms de ville que l'anglais sans accent écrit différemment
 * (`Noumea`) — jamais une liste de fuseaux : juste leur ORTHOGRAPHE
 * affichée, le reste de l'identifiant IANA restant la seule donnée stockée.
 */
const VILLES_ACCENTUEES: Readonly<Record<string, string>> = {
  Noumea: "Nouméa",
};

/**
 * « Nouméa » plutôt que « Pacific/Noumea » — un nom de ville à AFFICHER,
 * jamais une donnée qui gouverne un jour férié (gardien `tests/unit/
 * calendar/territoire-independant-du-fuseau.test.ts` : l'identifiant IANA
 * entier reste la seule chose stockée, ce qu'il en tire ici ne quitte jamais
 * l'écran).
 */
export function libelleFuseau(identifiantIana: string): string {
  const segments = identifiantIana.split("/");
  const dernier = segments[segments.length - 1] ?? identifiantIana;
  const nom = dernier.replace(/_/g, " ");
  return VILLES_ACCENTUEES[nom] ?? nom;
}
