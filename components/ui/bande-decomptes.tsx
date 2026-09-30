import Link from "next/link";

import { Icone } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

/**
 * LA BANDE DE DÉCOMPTES — `.strip`/`.strip-i` de la maquette du 28/09
 * (`bande()`, :2754-2758), pour le tableau de bord (D128, spec §3.4 :259).
 *
 * ## « Un décompte non nul est une porte, zéro est un état neutre »
 *
 * Commentaire de la maquette elle-même (:2753) : un total supérieur à zéro
 * est un LIEN (`<a class="strip-i">`) — il ouvre la liste qu'il compte, un
 * chevron le dit — un total à zéro est un `<div>` INERTE (`.strip-i.zero`),
 * jamais un lien vers une liste vide. C'est l'ordre exact de `bande()` :
 * le NOMBRE d'abord (`<b>`), le libellé ensuite (`<span>`), l'icône en
 * dernier.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.strip{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}` (:999) ;
 * `.strip-i{...border-radius:12px;padding:10px 12px;min-height:48px;
 * font-size:13px...}` (:615) — rayon 12 px est `--radius-md` (D124) ;
 * `.strip-i b{font-size:18px;font-weight:850;...font-variant-numeric:
 * tabular-nums}` (:617) — `850` n'a pas de classe Tailwind, `font-extrabold`
 * (800) est la plus proche (même écart que `Page`, `Priorite`) ;
 * `.strip-i.zero{background:var(--surface-2);border-style:dashed;
 * color:var(--muted)}` (:1000) ; `.strip-i.zero .ico{color:var(--green)}`
 * (:1002) — `--green` est `--app-vert-bord` (D124).
 *
 * ## Ce que la couleur du chevron au repos NE dit PAS
 *
 * `.strip-i .ico{color:var(--muted-2)}` (:616) — `--muted-2` n'a AUCUN jeton
 * (D124 ne le mesure pas) : le chevron hérite donc de l'encre du texte
 * environnant, jamais d'une valeur approchée. Valeur à fixer par Alexis.
 */
export type ElementDecompte = {
  /** Le total compté — zéro rend l'état neutre, jamais un lien. */
  readonly n: number;
  readonly libelle: string;
  readonly href: string;
  /** Le texte affiché à zéro, quand il diffère du libellé (« Aucune absence aujourd'hui »). */
  readonly libelleAJour?: string;
};

export function BandeDecomptes({
  elements,
}: Readonly<{ elements: readonly ElementDecompte[] }>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[10px]">
      {elements.map((element) => (
        <ElementDeBande key={element.href} element={element} />
      ))}
    </div>
  );
}

function ElementDeBande({ element }: Readonly<{ element: ElementDecompte }>) {
  const classesCommunes =
    "flex min-h-[48px] items-center gap-[10px] rounded-md border px-[12px] py-[10px] text-13 font-bold";

  if (element.n === 0) {
    return (
      <div
        data-n={0}
        className={cn(
          classesCommunes,
          "bg-app-surface-creuse border-app-bord border-dashed text-app-encre-faible",
        )}
      >
        <b className="text-18 font-extrabold tabular-nums">{0}</b>
        <span className="flex-1">
          {element.libelleAJour ?? element.libelle}
        </span>
        <Icone nom="check" taille={16} className="text-app-vert-bord" />
      </div>
    );
  }

  return (
    <Link
      href={element.href}
      data-n={element.n}
      className={cn(
        classesCommunes,
        "bg-app-surface border-app-bord text-app-gris-encre",
      )}
    >
      <b className="text-app-encre text-18 font-extrabold tabular-nums">
        {element.n}
      </b>
      <span className="flex-1">{element.libelle}</span>
      <Icone nom="chev-r" taille={16} />
    </Link>
  );
}
