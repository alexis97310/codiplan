"use client";

import { useEffect } from "react";

/**
 * LE MOIS S'OUVRE SUR AUJOURD'HUI (9G4-PLANNING-JOUR-ET-MOIS, point 5) —
 * REVIENT sur l'ouverture figée au 1er du mois : `CadreDefilant` ouvrait
 * sans défiler, et aujourd'hui pouvait rester hors cadre jusqu'au jour 16
 * (mesuré : le 26 d'un mois de 31 jours n'apparaissait qu'après un geste de
 * défilement que rien n'indiquait). Monté une seule fois par `VueMois`, ce
 * composant CLIENT ne porte aucun état : il amène `[data-aujourdhui]` dans
 * le cadre visible au premier rendu, puis ne fait plus rien — la position
 * devient ensuite celle que l'utilisateur choisit lui-même.
 *
 * `scrollIntoView` plutôt qu'un calcul de `scrollLeft` : il résout LUI-MÊME
 * chaque ancêtre défilant qu'il traverse (ici le conteneur posé par
 * `CadreDefilant`), sans que ce composant ait besoin d'en connaître la
 * structure interne (`components/ui/cadre-defilant.tsx`, hors du territoire
 * de ce lot).
 */
export function DefilerVersAujourdhuiMois() {
  useEffect(() => {
    const cible = document.querySelector<HTMLElement>(
      '[data-maquette-bloc="tableau-mois"] [data-aujourdhui]',
    );
    cible?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  return null;
}
