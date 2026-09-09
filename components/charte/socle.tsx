import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * LES PIÈCES DE LA CHARTE — `docs/charte-visuelle.md`, rang 1.
 *
 * Aucune de ces pièces n'écrit une couleur : elles nomment des jetons
 * (`bg-plaque`, `border-trait`, `text-gris`), définis une seule fois dans
 * `app/jetons.css`. Aucune ne porte de chaîne visible : tout libellé lui est
 * passé, et vient du dictionnaire (L0-11).
 *
 * **Le rayon encode le type d'objet** (règle 3) : `rounded-sm` vaut 0 — c'est un
 * document —, `rounded-md` vaut 2 px — c'est un bloc de planning —, `rounded-xl`
 * vaut 26 px et n'est là que pour un cadre de téléphone. Il n'y a pas de
 * quatrième valeur, et c'est pour cela qu'on ne les écrit pas en pixels ici.
 */

/**
 * La page. Une largeur de ligne bornée (règle 10) et un rembourrage qui tient à
 * 390 px de large (règle 13).
 *
 * `large` sert aux écrans de GRILLE — le planning, un parc — dont le contenu
 * déborde par nature ; la prose, elle, reste sous 80 caractères.
 */
export function Page({
  children,
  large = false,
  className,
}: {
  children: ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-6",
        large ? "max-w-[1400px]" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

/**
 * Le titre d'un écran, et ce qui l'explique.
 *
 * Le filet sous le titre est NOIR et fin : c'est un filet structurant, pas une
 * décoration (règle 1) — il sépare, il ne colore pas.
 */
export function EnTete({
  titre,
  accroche,
  actions,
}: {
  titre: string;
  accroche?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-noir flex flex-wrap items-end justify-between gap-4 border-b pb-3">
      <div className="flex max-w-[65ch] flex-col gap-1.5">
        <h1 className="text-2xl sm:text-3xl">{titre}</h1>
        {accroche === undefined ? null : (
          <p className="text-gris text-sm">{accroche}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/**
 * Une surface. Un panneau de papier posé sur l'acier.
 *
 * **Aucune ombre** (règle 4) : un panneau n'est pas un objet physique, c'est une
 * zone. Ce qui le détache est le contraste de la plaque sur l'acier et un filet.
 */
export function Panneau({
  titre,
  children,
  className,
}: {
  titre?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-plaque border-trait rounded-sm border p-4 sm:p-5",
        className,
      )}
    >
      {titre === undefined ? null : (
        <h2 className="border-trait mb-3 border-b pb-2 text-base">{titre}</h2>
      )}
      {children}
    </section>
  );
}

/**
 * Un écran vide est une INVITATION À AGIR, pas un constat de vide (règle 9).
 *
 * D'où la forme imposée par le type : un `titre` qui dit ce qu'il y aurait ici,
 * et une `invitation` qui dit quoi faire. Aucun des deux n'est facultatif — on
 * ne peut donc pas rendre « Aucune donnée » et s'arrêter là.
 */
export function Vide({
  titre,
  invitation,
  action,
}: {
  titre: string;
  invitation: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-trait flex flex-col items-start gap-2 border border-dashed p-6">
      <p className="font-bold">{titre}</p>
      <p className="text-gris max-w-[60ch] text-sm">{invitation}</p>
      {action}
    </div>
  );
}

/**
 * Un couple libellé / valeur. La valeur est en chiffres tabulaires — c'est le
 * corps qui le pose (règle 12), rien à faire ici.
 */
export function Mesure({
  libelle,
  valeur,
  note,
  accent,
}: {
  libelle: string;
  valeur: ReactNode;
  note?: string;
  accent?: "bleu" | "vert" | "ambre" | "oxyde" | "gris";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-gris text-sm">{libelle}</dt>
      <dd
        className={cn(
          "font-bold",
          accent === "bleu" && "text-bleu",
          accent === "vert" && "text-vert",
          accent === "ambre" && "text-ambre",
          accent === "oxyde" && "text-oxyde",
          accent === "gris" && "text-gris font-normal",
        )}
      >
        {valeur}
        {note === undefined ? null : (
          <span className="text-gris ml-2 text-xs font-normal">{note}</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Une erreur RENDUE À L'ÉCRAN. Règle 8 : elle dit ce qui s'est passé et comment
 * le corriger, elle ne s'excuse pas et ne reste jamais vague.
 *
 * Le type l'impose : `quoi` et `remede` sont tous deux obligatoires. Une erreur
 * sans remède ne peut pas être écrite avec cette pièce, et c'est le but.
 */
export function Refus({ quoi, remede }: { quoi: string; remede: string }) {
  return (
    <p
      role="status"
      className="border-oxyde bg-oxyde-fond text-oxyde rounded-sm border px-3 py-2 text-sm"
    >
      <span className="font-bold">{quoi}</span>
      <span className="mt-0.5 block font-normal">{remede}</span>
    </p>
  );
}

/** Une étiquette d'état. Jamais en capitales espacées (règle 6). */
export function Etiquette({
  texte,
  ton,
}: {
  texte: string;
  ton: "bleu" | "vert" | "ambre" | "oxyde" | "neutre";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-bold",
        ton === "bleu" && "border-bleu bg-bleu-fond text-bleu",
        ton === "vert" && "border-vert bg-vert-fond text-vert",
        ton === "ambre" && "border-ambre bg-ambre-fond text-ambre",
        ton === "oxyde" && "border-oxyde bg-oxyde-fond text-oxyde",
        ton === "neutre" && "border-trait text-gris",
      )}
    >
      {texte}
    </span>
  );
}
