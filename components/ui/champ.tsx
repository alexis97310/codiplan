import { cn } from "@/lib/utils";

/**
 * LE CHAMP DE FORMULAIRE — libellé et saisie, la sixième recopie évitée
 * (AT-04).
 *
 * ## La maquette est MUETTE sur un champ de saisie
 *
 * *Elle ne dessine aucun `<input>`* : c'est une maquette de disposition, pas
 * de formulaire. « Ce qu'elle ne dit pas reste libre » (§1 du `CLAUDE.md`), et
 * les valeurs ci-dessous ne sont donc pas lues d'un `<style>` mais reprises
 * telles quelles de `app/(back-office)/parametres/materiel/page.tsx`, où
 * L1-05b les avait posées en premier — cinquième recopie avant celle-ci
 * (`FormulaireFamille`, `FormulaireModele`, et les libellés de `CaseActive` et
 * du `<select>` de famille juste à côté). *La sixième recopie serait née
 * exactement de la même apparence* (§9, 01/09) : ce fichier l'arrête.
 *
 * Un écart de disposition ne se juge pas ici : aucun gardien ne confronte ce
 * composant à la maquette, faute de règle à lire.
 */
export function Champ({
  id,
  nom,
  libelle,
  valeur,
  large,
  nombre,
  autoFocus,
}: Readonly<{
  id: string;
  nom: string;
  libelle: string;
  valeur?: string;
  /** Une saisie longue — une référence, un libellé — plutôt qu'un code court. */
  large?: boolean;
  nombre?: boolean;
  autoFocus?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type={nombre === true ? "number" : "text"}
        min={nombre === true ? 1 : undefined}
        defaultValue={valeur}
        autoFocus={autoFocus}
        className={cn(
          "border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px]",
          large === true ? "min-w-64" : "w-36",
        )}
      />
    </div>
  );
}
