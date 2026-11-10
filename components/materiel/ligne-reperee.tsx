"use client";

import { useEffect } from "react";

/**
 * DÉFILER JUSQU'À LA LIGNE VISÉE, ET LA METTRE BRIÈVEMENT EN ÉVIDENCE
 * (9K18A-MATERIEL-RETOUR-ONGLET, point 3).
 *
 * Chaque ligne du référentiel se rend DEUX FOIS — une ligne de tableau dès
 * 901 px, une carte sous 900 px (`ListeCartes`) — et un `id` HTML ne peut pas
 * se dupliquer. `data-ligne` le peut : au montage, ce composant retient,
 * parmi les éléments qui le portent, celui dont `offsetParent` n'est pas nul
 * — visible à CETTE largeur, jamais le premier du document.
 *
 * `className` reste la seule retouche : `animation` n'a pas de `fill-mode`,
 * si bien que la mise en évidence s'efface d'elle-même vers le fond normal
 * de la ligne, sans qu'il faille revenir retirer la classe (`app/globals.css`,
 * `@keyframes surbrillance-ligne`).
 */
export function LigneReperee({
  id,
}: Readonly<{ readonly id: string | undefined }>) {
  useEffect(() => {
    if (id === undefined) {
      return;
    }
    const candidats = document.querySelectorAll<HTMLElement>(
      `[data-ligne="${id}"]`,
    );
    const visible = Array.from(candidats).find(
      (element) => element.offsetParent !== null,
    );
    if (visible === undefined) {
      return;
    }
    visible.scrollIntoView({ block: "center" });
    visible.classList.add("ligne-reperee-active");
  }, [id]);
  return null;
}
