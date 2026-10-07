import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";

/**
 * UN GROUPE DE BOUTONS RADIO (QE-9, maquette du 28/09, `choices()` :3054) —
 * la Priorité d'une demande qu'on transforme se choisit par des boutons,
 * jamais un `<select>` : la maquette la montre ainsi, et les quatre valeurs
 * sont toujours visibles d'un coup (9ED-TP-UX3-D2-DEMANDES).
 *
 * Formulaire POST natif, comme `ChampDureePrevue` : des `<input
 * type="radio">` NATIFS, visuellement masqués (`sr-only`) et portés par un
 * `<label>` stylé — jamais un composant client qui réimplémenterait ce que le
 * navigateur fait déjà. **Rien n'est coché sans `valeurInitiale`** (IN-02,
 * IN-28) : un groupe de boutons radio ne présélectionne jamais sa première
 * valeur de lui-même, à la différence d'un `<select>` simple.
 */
export function Choix({
  nom,
  legende,
  options,
  valeurInitiale,
  obligatoire = false,
  aide,
  erreur,
  valeur,
  onChange,
}: Readonly<{
  nom: string;
  legende: string;
  options: readonly { readonly valeur: string; readonly libelle: string }[];
  /** Rien n'est coché sans elle — ignorée en mode CONTRÔLÉ (voir `valeur`). */
  valeurInitiale?: string;
  /** Marque la légende, et porte `required` sur chaque bouton du groupe. */
  obligatoire?: boolean;
  /** L'aide sous le groupe — décrite par `aria-describedby`. */
  aide?: string;
  /**
   * LE MESSAGE D'ERREUR SOUS LE GROUPE (TP-UX5-1-FORMULAIRES) — pose
   * `aria-invalid` sur le groupe, l'ajoute à `aria-describedby`, et focalise
   * le premier bouton.
   */
  erreur?: string;
  /**
   * REND LE GROUPE CONTRÔLÉ (TP-UX5-1-FORMULAIRES, le choix de la machine) —
   * absente, le groupe reste NATIF (`defaultChecked`, comme avant ce lot) ;
   * fournie, chaque bouton se coche selon `valeur` et `onChange` reçoit le
   * bouton choisi. Les deux formes restent exclusives : jamais `defaultChecked`
   * ET `checked` sur le même bouton.
   */
  valeur?: string;
  onChange?: (valeur: string) => void;
}>) {
  const idAide = `${nom}-aide`;
  const idErreur = `${nom}-erreur`;
  const describedBy =
    [aide === undefined ? null : idAide, erreur === undefined ? null : idErreur]
      .filter((id) => id !== null)
      .join(" ") || undefined;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">
        {obligatoire ? libelleChampObligatoire(legende) : legende}
      </legend>
      <div
        role="radiogroup"
        aria-describedby={describedBy}
        aria-invalid={erreur === undefined ? undefined : "true"}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option, index) => (
          <label key={option.valeur} className="relative">
            <input
              type="radio"
              name={nom}
              value={option.valeur}
              required={obligatoire}
              autoFocus={erreur !== undefined && index === 0}
              className="peer sr-only"
              {...(valeur === undefined
                ? { defaultChecked: valeurInitiale === option.valeur }
                : {
                    checked: valeur === option.valeur,
                    onChange: () => onChange?.(option.valeur),
                  })}
            />
            <span className="border-app-bord peer-checked:bg-app-marque peer-checked:text-app-marque-encre peer-checked:border-app-marque peer-focus-visible:ring-ring/50 peer-focus-visible:ring-[3px] flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2.5 text-13 font-bold sm:min-h-0 sm:py-1">
              {option.libelle}
            </span>
          </label>
        ))}
      </div>
      {aide === undefined ? null : (
        <p id={idAide} className="text-app-encre-faible text-12 font-bold">
          {aide}
        </p>
      )}
      {erreur === undefined ? null : (
        <p id={idErreur} className="text-app-rouge-encre text-12 font-bold">
          {erreur}
        </p>
      )}
    </fieldset>
  );
}
