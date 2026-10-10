"use client";

import { useEffect, useRef, useState } from "react";

import { indicesDeDefilement } from "./defilement";
import { Icone } from "./icone";

/**
 * LE CADRE QUI MONTRE QU'IL DÉFILE (9AS-CG3, 28/09/2026).
 *
 * Enveloppe le conteneur `overflow-x-auto` de `Tableau` et pose
 * `data-defile-gauche` / `data-defile-droite` sur lui quand il reste du
 * contenu à découvrir de ce côté — lus par `indicesDeDefilement`
 * (`components/ui/defilement.ts`), la même fonction éprouvée sans DOM. Un
 * voile `aria-hidden`, sans texte, marque chaque bord : décoratif, jamais
 * lu par un lecteur d'écran, jamais une clé `fr.ts`.
 */
export function CadreDefilant({
  children,
  className,
  indice,
}: Readonly<{
  children: React.ReactNode;
  className: string;
  /**
   * L'INDICE TEXTUEL DE DÉFILEMENT (9EH-TP-UX-PL-PLANNING-1, D190, gabarit
   * `.pgrid-hint` de la maquette du 28/09) — FACULTATIF, affiché seulement
   * quand il reste du contenu à découvrir À DROITE (même état que le voile
   * `opacity-100` ci-dessous) : `Tableau`, l'autre appelant, ne le pose pas.
   */
  indice?: React.ReactNode;
}>) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [{ gauche, droite }, setIndices] = useState({
    gauche: false,
    droite: false,
  });

  useEffect(() => {
    const element = conteneur.current;
    if (element === null) {
      return;
    }

    function mettreAJour() {
      if (element === null) {
        return;
      }
      setIndices(
        indicesDeDefilement({
          scrollLeft: element.scrollLeft,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }),
      );
    }

    mettreAJour();
    element.addEventListener("scroll", mettreAJour);
    const observateur = new ResizeObserver(mettreAJour);
    observateur.observe(element);

    return () => {
      element.removeEventListener("scroll", mettreAJour);
      observateur.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {indice === undefined || !droite ? null : (
        <div className="text-app-encre-faible mb-1.5 flex items-center gap-1.5 text-12 font-bold">
          <Icone nom="arrow-r" taille={16} />
          {indice}
        </div>
      )}
      <div
        ref={conteneur}
        className={className}
        data-defile-gauche={gauche ? "" : undefined}
        data-defile-droite={droite ? "" : undefined}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`from-app-surface pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r to-transparent transition-opacity ${
          gauche ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`from-app-surface pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l to-transparent transition-opacity ${
          droite ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
