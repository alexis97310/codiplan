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
}: Readonly<{
  nom: string;
  legende: string;
  options: readonly { readonly valeur: string; readonly libelle: string }[];
  /** Rien n'est coché sans elle. */
  valeurInitiale?: string;
  /** Marque la légende, et porte `required` sur chaque bouton du groupe. */
  obligatoire?: boolean;
  /** L'aide sous le groupe — décrite par `aria-describedby`. */
  aide?: string;
}>) {
  const idAide = `${nom}-aide`;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">
        {obligatoire ? libelleChampObligatoire(legende) : legende}
      </legend>
      <div
        role="radiogroup"
        aria-describedby={aide === undefined ? undefined : idAide}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option) => (
          <label key={option.valeur} className="relative">
            <input
              type="radio"
              name={nom}
              value={option.valeur}
              required={obligatoire}
              defaultChecked={valeurInitiale === option.valeur}
              className="peer sr-only"
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
    </fieldset>
  );
}
