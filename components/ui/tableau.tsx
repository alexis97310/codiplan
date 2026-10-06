/**
 * LE TABLEAU DENSE DE LA MAQUETTE (R2-05, R2-06 ; D95).
 *
 * ## Pourquoi un composant plutôt que deux fois les mêmes classes
 *
 * R2-05 et R2-06 visent le MÊME écran de la maquette — « Sociétés & tarifs » —
 * et l'acceptation de R2-06 le dit : *les deux écrans partagent leur forme de
 * tableau plutôt que d'en écrire deux, deux implémentations d'un même critère
 * divergeant en silence* (§9, 01/09). Ce fichier est cette forme unique.
 *
 * ## Les valeurs viennent de la maquette, LUES et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html`, règles `table`, `th` et `td` :
 * tableau à `width:100%` et `border-collapse:collapse`, corps à **13 px** ;
 * en-tête à **10,5 px**, capitales, interlettrage **0,6 px**, gris, gras,
 * `padding: 9px 16px`, filet inférieur ; cellules `padding: 11px 16px` avec
 * filet inférieur. *Ce qu'elle montre se suit ; ce qu'elle ne dit pas reste
 * libre* (§1 du CLAUDE.md).
 *
 * **L'en-tête se rend à 12 px, pas les 10,5 px de la maquette** — D138
 * (`docs/arbitrages.md`, 29/09/2026) : plancher de 12 px, amende D124 et D95.
 *
 * ## Aucune couleur écrite ici
 *
 * Les classes nomment des JETONS d'apparence — `bg-app-surface-creuse`,
 * `text-app-encre-faible`, `border-app-bord`. Ajouter un thème sera un bloc de
 * style, et aucun écran à rouvrir.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne trie pas, ne pagine pas, ne filtre pas. Un tableau qui déciderait de
 * l'ordre de ses lignes prendrait une décision qui appartient à l'écran — et le
 * planning, qui a sa propre grille agissante, ne passe pas par ici : *sa
 * structure porte les cases de dépôt du glisser-déposer*, et l'unifier
 * casserait un mécanisme pour gagner une ressemblance.
 *
 * ## L'indice de défilement (9AS-CG3, 28/09/2026)
 *
 * Le conteneur qui défile est un `CadreDefilant` (`components/ui/
 * cadre-defilant.tsx`), pas un `<div className="overflow-x-auto">` nu : il
 * pose un voile dégradé sur le bord où il reste du contenu à découvrir.
 */

import { CadreDefilant } from "./cadre-defilant";

/** Une colonne : son libellé, et si elle s'aligne à droite (les montants). */
export type Colonne = {
  readonly cle: string;
  readonly libelle: string;
  /** Les nombres se lisent alignés à droite — la maquette le fait pour eux. */
  readonly droite?: boolean;
  readonly largeur?: string;
};

export function Tableau({
  colonnes,
  children,
  minimum,
  libelle,
  compact = false,
}: Readonly<{
  colonnes: readonly Colonne[];
  children: React.ReactNode;
  /** Largeur minimale avant défilement horizontal, si l'écran en a besoin. */
  minimum?: string;
  /**
   * LE NOM ACCESSIBLE DU TABLEAU (99E-EVITEMENT, audit du 25/09, constat 39)
   * — `aria-label`, absent tant qu'un appelant ne le passe pas : ce
   * composant sert des dizaines d'écrans, et seuls ceux que l'audit nomme
   * (le registre, la grille du planning) le passent aujourd'hui.
   */
  libelle?: string;
  /**
   * LA DENSITÉ « COMPACT » (TP-UX3-1-REGISTRE-1) — moins de rembourrage
   * VERTICAL sur l'en-tête, jamais sous 12 px de police (QE-1) : seul
   * `py` change, `text-12` reste. Les cellules du corps (`Cellule`
   * ci-dessous) portent leur PROPRE `compact`, l'appelant devant déjà
   * composer chaque ligne — ce booléen-ci ne gouverne que ce que `Tableau`
   * rend lui-même.
   */
  compact?: boolean;
}>) {
  return (
    // Le défilement horizontal est BORNÉ à ce conteneur : le corps de la page
    // ne défile jamais latéralement. `CadreDefilant` y ajoute l'indice de
    // défilement (9AS-CG3) sans changer cette classe, lue par ailleurs
    // (`tests/e2e/planning-largeur-et-carte.spec.ts:159`, un écran étranger
    // à `Tableau`).
    <CadreDefilant className="overflow-x-auto">
      <table
        aria-label={libelle}
        className="w-full border-collapse text-[13px] font-bold"
        style={minimum === undefined ? undefined : { minWidth: minimum }}
      >
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                className={`bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-4 text-12 font-bold tracking-[0.6px] uppercase ${
                  compact ? "py-1" : "py-[9px]"
                } ${colonne.droite === true ? "text-right" : "text-left"}`}
                style={
                  colonne.largeur === undefined
                    ? undefined
                    : { width: colonne.largeur }
                }
              >
                {colonne.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </CadreDefilant>
  );
}

/** Une cellule ordinaire. */
export function Cellule({
  droite,
  mono,
  fort,
  etendue,
  compact,
  children,
}: Readonly<{
  droite?: boolean;
  /** Les codes se lisent en chasse fixe — la maquette le fait pour eux. */
  mono?: boolean;
  fort?: boolean;
  /**
   * LE NOMBRE DE COLONNES COUVERTES (9AT-CG6, audit C-G7) — `colSpan`,
   * absent tant qu'un appelant ne le passe pas : une cellule qui porte un
   * motif valable pour plusieurs colonnes le dit une fois, sur toute leur
   * largeur, plutôt que de le répéter dans chacune.
   */
  etendue?: number;
  /** LA DENSITÉ « COMPACT » (TP-UX3-1-REGISTRE-1) — moins de `py`, police inchangée (QE-1). */
  compact?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <td
      colSpan={etendue}
      className={`border-app-bord border-b px-4 align-top ${
        compact === true ? "py-1.5" : "py-[11px]"
      } ${droite === true ? "text-right" : "text-left"} ${
        mono === true ? "font-mono text-[12px] font-bold" : ""
      } ${fort === true ? "font-bold" : ""}`}
    >
      {children}
    </td>
  );
}

/**
 * Une ligne qui occupe toute la largeur — un tableau vide, un message.
 *
 * **Elle existe pour que « rien » se DISE.** Un tableau qui rend zéro ligne
 * sans un mot se lit comme un tableau cassé, et c'est la même faute que le
 * zéro affiché à la place de « sans information » (D88).
 */
export function LignePleine({
  colonnes,
  children,
}: Readonly<{ colonnes: number; children: React.ReactNode }>) {
  return (
    <tr>
      <td
        colSpan={colonnes}
        className="border-app-bord text-app-encre-faible border-b px-4 py-[11px]"
      >
        {children}
      </td>
    </tr>
  );
}
