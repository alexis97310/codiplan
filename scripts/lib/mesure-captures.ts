/**
 * LA MESURE D'UNE CAPTURE — fonction PURE, extraite pour être éprouvée sans
 * navigateur (même discipline que `verdict-temoin.ts`, 99O-CAPTURES-TEMOIN) :
 * `scripts/captures.mts` lit ces seuils, cette fonction ne lit ni page ni
 * navigateur.
 *
 * ## Les seuils sont LUS, jamais inventés
 *
 * Chacun porte sa source en commentaire, à côté de sa constante — jamais un
 * nombre nu :
 * - texte < 12 px : D138 (`docs/arbitrages.md`, 29/09/2026) ;
 * - cible < 32×32 px au bureau, hors lien dans le texte : spec §10 :963 ;
 * - cible < 44×44 px au terrain : spec §10 :964 (CDC §13.4) ;
 * - défilement horizontal de la page : spec §10 :965 (PR-10) ;
 * - erreur de console : spec §10 :966.
 *
 * ## « Lien dans le texte »
 *
 * Un lien posé À L'INTÉRIEUR d'un paragraphe de texte courant (un renvoi, une
 * référence) n'est pas une CIBLE au sens de ce seuil : sa zone cliquable suit
 * la hauteur de ligne du texte qui l'entoure, et l'élargir romprait la lecture
 * du paragraphe. C'est `dansLeTexte`, posé par l'appelant (`captures.mts`),
 * qui le dit — cette fonction ne le déduit d'aucune mesure.
 */

export const SEUIL_TEXTE_PX = 12; // D138 (docs/arbitrages.md, 29/09/2026)
export const SEUIL_CIBLE_BUREAU_PX = 32; // spec ergonomie-graphisme-usage-2026-09-28.md §10 :963
export const SEUIL_CIBLE_TERRAIN_PX = 44; // spec §10 :964, CDC §13.4

export type TexteMesure = {
  readonly element: string;
  readonly taille: number;
  readonly debut: string;
};

export type CibleMesuree = {
  readonly element: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly debut: string;
  /** Un lien posé dans un paragraphe de texte courant — jamais compté. */
  readonly dansLeTexte: boolean;
};

export type MesuresBrutes = {
  readonly ecran: string;
  readonly largeur: number;
  /** Les seuils de cible du terrain (CDC §13.4) plutôt que ceux du bureau. */
  readonly terrain: boolean;
  readonly textes: readonly TexteMesure[];
  readonly cibles: readonly CibleMesuree[];
  /** `scrollWidth - clientWidth` de la page ; 0 ou moins : aucun débordement. */
  readonly debordement: number;
  readonly erreurs: readonly string[];
};

export type VerdictMesure = {
  readonly ecran: string;
  readonly largeur: number;
  readonly textesSousLeSeuil: readonly TexteMesure[];
  readonly ciblesSousLeSeuil: readonly CibleMesuree[];
  readonly debordement: number;
  readonly erreurs: readonly string[];
};

/** Le verdict d'une capture — ce qui compte, jamais une conclusion pour elle. */
export function mesurer(brutes: MesuresBrutes): VerdictMesure {
  const seuilCible = brutes.terrain
    ? SEUIL_CIBLE_TERRAIN_PX
    : SEUIL_CIBLE_BUREAU_PX;
  return {
    ecran: brutes.ecran,
    largeur: brutes.largeur,
    textesSousLeSeuil: brutes.textes.filter(
      (texte) => texte.taille < SEUIL_TEXTE_PX,
    ),
    ciblesSousLeSeuil: brutes.cibles.filter(
      (cible) =>
        !cible.dansLeTexte &&
        (cible.largeur < seuilCible || cible.hauteur < seuilCible),
    ),
    debordement: Math.max(0, brutes.debordement),
    erreurs: brutes.erreurs,
  };
}

function exemples<T>(
  items: readonly T[],
  rendre: (item: T) => string,
): readonly string[] {
  return items.slice(0, 5).map((item) => `  - ${rendre(item)}`);
}

/**
 * LES LIGNES DU README — jamais une porte : la mesure s'ÉCRIT, elle ne fait
 * pas échouer le script (scripts/captures.mts, comme le refus d'une capture).
 */
export function ligneMesureReadme(
  resultats: readonly VerdictMesure[],
): readonly string[] {
  const lignes: string[] = [
    "## Mesure",
    "",
    "**Une observation, pas une porte** : la mesure ne fait pas échouer le script, comme un refus de capture (voir plus haut). Seuils lus, jamais inventés : texte < 12 px (D138) ; cible < 32×32 px au bureau hors lien dans le texte (spec ergonomie-graphisme-usage-2026-09-28.md §10 :963) ; cible < 44×44 px au terrain (spec §10 :964, CDC §13.4) ; défilement horizontal de la page (spec §10 :965, PR-10) ; erreur de console (spec §10 :966).",
    "",
    "| Écran | Largeur | Textes < 12 px | Cibles sous le seuil | Débordement | Erreurs |",
    "|---|---|---|---|---|---|",
  ];
  for (const resultat of resultats) {
    lignes.push(
      `| \`${resultat.ecran}\` | ${resultat.largeur} | ${resultat.textesSousLeSeuil.length} | ${resultat.ciblesSousLeSeuil.length} | ${resultat.debordement > 0 ? `${resultat.debordement}px` : "0"} | ${resultat.erreurs.length} |`,
    );
  }
  lignes.push("");

  for (const resultat of resultats) {
    if (resultat.textesSousLeSeuil.length > 0) {
      lignes.push(
        `**\`${resultat.ecran}\` à ${resultat.largeur} px — textes < 12 px (5 premiers) :**`,
        "",
        ...exemples(
          resultat.textesSousLeSeuil,
          (texte) =>
            `${texte.element} — ${texte.taille}px — « ${texte.debut} »`,
        ),
        "",
      );
    }
    if (resultat.ciblesSousLeSeuil.length > 0) {
      lignes.push(
        `**\`${resultat.ecran}\` à ${resultat.largeur} px — cibles sous le seuil (5 premières) :**`,
        "",
        ...exemples(
          resultat.ciblesSousLeSeuil,
          (cible) =>
            `${cible.element} — ${cible.largeur}×${cible.hauteur}px — « ${cible.debut} »`,
        ),
        "",
      );
    }
    if (resultat.erreurs.length > 0) {
      lignes.push(
        `**\`${resultat.ecran}\` à ${resultat.largeur} px — erreurs de console (5 premières) :**`,
        "",
        ...exemples(resultat.erreurs, (erreur) => erreur),
        "",
      );
    }
  }
  return lignes;
}
