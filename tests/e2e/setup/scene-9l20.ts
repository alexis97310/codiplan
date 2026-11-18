/**
 * LES TEXTES DE LA SCÈNE 9L20-DEPLACER-MACHINE — dans leur propre fichier,
 * jamais déclarés dans le spec qui les emploie : ce module ne rend rien, n'
 * exporte aucune métadonnée et n'interroge pas l'écran, il ne porte donc
 * aucune des trois marques de `tests/unit/outils/rendu-visible.ts` — à la
 * différence du spec, où la même déclaration littérale, reprise dans un
 * `getByText(...)`, serait une chaîne visible écrite hors du dictionnaire
 * (L0-11, forme 3 du §9 : un identifiant se résout vers sa constante
 * littérale DU MÊME FICHIER). Une donnée de scène reste une donnée, mais
 * seulement si son texte n'est pas aussi déclaré là où l'écran est interrogé.
 */
export const SCENE_9L20 = {
  raisonSociale: "9L20-Client (déplacer machine)",
  libelleDepart: "9L20-Site de départ",
  libelleCible: "9L20-Site cible",
};
