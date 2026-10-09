import { cn } from "@/lib/utils";

/**
 * LA JAUGE — « Mise en route » (administrateur, 9EG-TP-UX6-TABLEAU-DE-
 * BORD-2, PU-1). `meter()` de la maquette du 28/09 n'a PAS de composant posé
 * dans ce dépôt (D185 : aucun composant de pourcentage n'existe encore) —
 * celui-ci est NEUF, et minimal.
 *
 * **Jamais un pourcentage seul** (R2-13, D111) : l'étiquette dit toujours
 * « N sur 8 », numérateur ET dénominateur visibles — la barre n'est qu'une
 * illustration de ce que l'étiquette dit déjà en chiffres, jamais la seule
 * source de l'information.
 */
export function Jauge({
  etiquette,
  pourcentage,
}: Readonly<{
  /** « N sur 8 » — composée par `libelleJauge` (`./presentation.ts`). */
  etiquette: string;
  /** 0 à 100, dérivé du MÊME compte que l'étiquette — jamais un second calcul. */
  pourcentage: number;
}>) {
  return (
    <div data-bloc="jauge" className="flex flex-col gap-1.5">
      <p className="text-13 font-bold">{etiquette}</p>
      <div
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-app-surface-creuse h-[8px] overflow-hidden rounded-full"
      >
        <div
          className={cn("bg-app-marque h-full rounded-full")}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  );
}
