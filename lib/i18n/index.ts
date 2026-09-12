/**
 * Point d'entrée du dictionnaire français (D26, ticket L0-11).
 *
 * Tout ce qui atteint l'écran passe par ici : `t` pour une chaîne, `mot` et
 * `definition` pour le vocabulaire imposé. Le gardien des chaînes visibles
 * DÉDUIT de ce module la liste des formes autorisées dans un emplacement
 * visible — il ne l'énumère pas. Ajouter ici un accesseur l'autorise du même
 * coup ; ne rien ajouter le laisse fermé.
 */
export { fr, t, type CleTraduction } from "./fr";
export {
  PREFIXE_VOCABULAIRE,
  VOCABULAIRE,
  definition,
  mot,
  // `motDansUnePhrase` est la MÊME source sous une autre casse : le mot y
  // descend en minuscule initiale pour tomber au milieu d'une phrase. Il est
  // déclaré ici DÉLIBÉRÉMENT — c'est ce qui l'autorise dans un emplacement
  // visible, et le laisser dehors l'aurait fermé (voir l'en-tête).
  motDansUnePhrase,
  type NotionImposee,
  type TermeImpose,
} from "./vocabulaire";
