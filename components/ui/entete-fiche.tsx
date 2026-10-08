import type { ReactNode } from "react";

import { Icone, type NomIcone } from "@/components/ui/icone";

/**
 * LA LIGNE DE FAITS DE L'EN-TÊTE D'UNE FICHE (9EE-TP-UX4-1-
 * FICHE-INTERVENTION-1, `fact()` de la maquette du 28/09, :1785) — une
 * icône, un petit libellé au-dessus, la valeur en dessous ; passée à la
 * ligne (`flex-wrap`) plutôt que compressée sur une seule.
 *
 * Posé comme VALEUR de la prop `faits` de `Page`
 * (`components/mise-en-page/page.tsx`), jamais un second mécanisme d'en-tête
 * : cette fiche n'invente rien que `Page` ne porte pas déjà.
 *
 * GÉNÉRIQUE comme tout `components/ui/` : `valeur` est un `ReactNode`
 * fourni déjà composé par l'appelant — un lien vers une autre fiche (un
 * seul endroit du dépôt écrit la classe du lien, et ce n'est pas ici) ou un
 * simple texte.
 */
export type FaitFiche = {
  readonly cle: string;
  readonly icone: NomIcone;
  readonly libelle: string;
  readonly valeur: ReactNode;
};

/**
 * `<dl>`, avec `<dt>`/`<dd>` par fait — PAS une paire de `<div>` muets :
 * plusieurs épreuves de bout en bout de la fiche cherchaient déjà le
 * `<dt>` « Technicien » (`intervention.technicien`) ou le `<dd>` d'une
 * machine n'importe où sur la page, et continuent de le trouver ici, sans
 * qu'aucune attente n'ait eu besoin de changer — seul le `<dt>` « Date
 * planifiée » devient « Créneau », renommage voulu par la maquette.
 */
export function EnTeteFiche({
  faits,
}: Readonly<{ faits: readonly FaitFiche[] }>) {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2">
      {faits.map((fait) => (
        <div key={fait.cle} className="flex min-w-0 items-start gap-2">
          <Icone
            nom={fait.icone}
            taille={16}
            className="text-app-encre-faible mt-0.5"
          />
          <div className="min-w-0 break-all">
            <dt className="text-app-encre-faible text-12 font-bold">
              {fait.libelle}
            </dt>
            <dd className="text-13 font-bold">{fait.valeur}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
