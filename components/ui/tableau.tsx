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
 */

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
}: Readonly<{
  colonnes: readonly Colonne[];
  children: React.ReactNode;
  /** Largeur minimale avant défilement horizontal, si l'écran en a besoin. */
  minimum?: string;
}>) {
  return (
    // Le défilement horizontal est BORNÉ à ce conteneur : le corps de la page
    // ne défile jamais latéralement.
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-[13px]"
        style={minimum === undefined ? undefined : { minWidth: minimum }}
      >
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                className={`bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-4 py-[9px] text-[10.5px] font-bold tracking-[0.6px] uppercase ${
                  colonne.droite === true ? "text-right" : "text-left"
                }`}
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
    </div>
  );
}

/** Une cellule ordinaire. */
export function Cellule({
  droite,
  mono,
  fort,
  children,
}: Readonly<{
  droite?: boolean;
  /** Les codes se lisent en chasse fixe — la maquette le fait pour eux. */
  mono?: boolean;
  fort?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <td
      className={`border-app-bord border-b px-4 py-[11px] align-top ${
        droite === true ? "text-right" : "text-left"
      } ${mono === true ? "font-mono text-[12px]" : ""} ${
        fort === true ? "font-bold" : ""
      }`}
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
