/**
 * LES TEXTES DE LA SCÈNE 9L38-HISTORIQUE-EMPLACEMENTS-TOUS-ROLES — dans son
 * propre fichier, même discipline que `scene-9l34.ts` et `scene-9l20.ts` :
 * une donnée de scène n'est une chaîne visible écrite hors dictionnaire QUE
 * si elle est aussi déclarée là où l'écran est interrogé (L0-11, forme 3 du
 * §9).
 */
export const SCENE_9L38 = {
  // Ne contient JAMAIS la phrase du titre du bloc (« Historique des
  // emplacements ») : `getByText` est insensible à la casse et cherche une
  // sous-chaîne, et le nom du client apparaît dans le même DOM que ce titre
  // (fil d'Ariane, en-tête) — mesuré : la contenir rendait le sélecteur du
  // titre ambigu (3 correspondances).
  raisonSociale: "9L38-Client (lecture ouverte à tous les rôles)",
  libelleSiteDepart: "9L38-Site de départ",
  libelleSiteCible: "9L38-Site cible",
};
