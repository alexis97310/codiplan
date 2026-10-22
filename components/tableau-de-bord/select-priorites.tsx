"use client";

/**
 * LE FILTRE DES PRIORITÉS, DANS L'EN-TÊTE DE LA CARTE (D122,
 * 9EG-TP-UX6-TABLEAU-DE-BORD-1) — `prioritesCard()` de la maquette pose son
 * `<select>` dans `card-h`, jamais sous elle.
 *
 * Soumet le formulaire GET au changement, par `requestSubmit()` — jamais un
 * état React : le paramètre `priorite` reste dans l'URL, et le bouton
 * « Filtrer » du formulaire (masqué visuellement, voir la page) continue de
 * marcher sans JavaScript.
 *
 * `idFormulaire` relie le `<select>` au formulaire par l'attribut HTML
 * `form=` (9G1-CORRECTIFS-AUDIT-URGENTS, point 1) : l'en-tête de la carte qui
 * porte ce `<select>` (`enTeteDroite`, `components/ui/carte.tsx`) est un
 * frère du `<form>`, jamais son enfant — `evenement.currentTarget.form`
 * valait donc `null`, et le changement de valeur ne soumettait rien.
 */
export function SelectPriorites({
  id,
  idFormulaire,
  defaultValue,
  options,
  libelleAria,
}: Readonly<{
  id: string;
  idFormulaire: string;
  defaultValue: string;
  options: readonly { readonly valeur: string; readonly libelle: string }[];
  libelleAria: string;
}>) {
  return (
    <select
      id={id}
      name="priorite"
      form={idFormulaire}
      aria-label={libelleAria}
      defaultValue={defaultValue}
      onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
      className="border-app-bord bg-app-surface h-[32px] rounded-md border px-2 text-12 font-bold"
    >
      {options.map((option) => (
        <option key={option.valeur} value={option.valeur}>
          {option.libelle}
        </option>
      ))}
    </select>
  );
}
