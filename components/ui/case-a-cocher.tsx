import { cn } from "@/lib/utils";

/**
 * LA CASE À COCHER DES ÉCRANS DE PARAMÉTRAGE (CG8, constat C-G10).
 *
 * Huit `<input type="checkbox">` natifs, chacun recopié dans son `<label>`,
 * n'offraient sous 768 px qu'une cible de la taille du glyphe rendu par le
 * navigateur — mesurée sous la cible tactile de 44 px que ce constat exige.
 * Cette écriture unique porte la cible sur le `<label>` : `min-h-11 min-w-11`
 * sous 768 px, effacés par `md:min-h-0 md:min-w-0` — le rendu bureau ne
 * change pas. `className` porte les classes de mise en page de l'appelant
 * (`flex items-center gap-…`) et compose avec la cible via `cn`, jamais ne la
 * remplace.
 *
 * Aucune règle de gestion n'est touchée : `name`, `value` et
 * `defaultChecked` sont transmis tels quels, ce que les routes lisaient
 * avant continue de l'être à l'identique.
 */
export function CaseACocher({
  name,
  value,
  defaultChecked,
  libelle,
  className,
}: Readonly<{
  name: string;
  value?: string;
  defaultChecked?: boolean;
  libelle: string;
  className?: string;
}>) {
  return (
    <label className={cn("min-h-11 min-w-11 md:min-h-0 md:min-w-0", className)}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
      />
      {libelle}
    </label>
  );
}
