/**
 * Thématisation par société (ticket L0-09) — point d'entrée du module.
 *
 * La thématisation est par SOCIÉTÉ, jamais par agence : les agences partagent
 * l'identité de leur société. Le thème appliqué est celui de la société ACTIVE
 * de la session, et le portail client affiche donc le thème de la société qui
 * le sert, jamais celui du client (I1 ; `session.ts` en fait la démonstration
 * en s'appuyant sur la politique RLS plutôt que sur un filtre de confort).
 */
export {
  estCouleurHex,
  luminanceRelative,
  normaliserHex,
  rapportDeContraste,
  schemaCouleurHex,
  type CouleurSrgb,
} from "./couleur";
export {
  ENCRE_CLAIRE,
  ENCRE_SOMBRE,
  PLANCHER_ENCRE,
  SEUIL_NON_TEXTE,
  SEUIL_TEXTE,
  ajusterPourContraste,
  encreLisible,
  type Ajustement,
} from "./contraste";
export { SURFACE_APPLICATION } from "./defaut";
export {
  NOM_NEUTRE,
  THEME_DEFAUT,
  themeDeSociete,
  themeLisible,
  type CouleurDeTheme,
  type OrigineTheme,
  type SourceTheme,
  type ThemeSociete,
} from "./theme";
export { VARIABLES, variablesCss, type NomVariable } from "./variables";

// `session.ts` n'est PAS réexporté ici : il ouvre une transaction Prisma, et ce
// point d'entrée est importé par des composants. Les chemins serveur qui ont
// besoin du thème de la session l'importent nommément.
