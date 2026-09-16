/**
 * LA FICHE — `.dl` de la maquette (AT-04) : une liste de définitions,
 * libellé contre valeur.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` :
 * `.dl{display:grid;grid-template-columns:132px 1fr;gap:9px 12px;
 * font-size:13px}` ; `.dl dt{color:var(--gris);font-size:12px}` ;
 * `.dl dd{font-weight:600}`. Un gardien confronte ces trois règles au texte
 * de ce fichier (`tests/unit/ui/composants-maquette.test.ts`).
 *
 * ## `LigneFiche` rend un FRAGMENT, pas une balise
 *
 * `<dt>` et `<dd>` doivent être des enfants DIRECTS de `<dl>` pour occuper
 * chacun leur propre case de la grille : un conteneur intermédiaire romprait
 * les colonnes CSS, exactement comme une `<tr>` emballée casserait `Tableau`.
 * `React.Fragment` ne pose aucun élément — la contrainte est donc tenue sans
 * qu'aucun appelant ait à le savoir.
 */
export function Fiche({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <dl className="grid grid-cols-[132px_1fr] gap-x-[12px] gap-y-[9px] text-[13px]">
      {children}
    </dl>
  );
}

export function LigneFiche({
  libelle,
  children,
}: Readonly<{
  libelle: string;
  children: React.ReactNode;
}>) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold">{children}</dd>
    </>
  );
}
