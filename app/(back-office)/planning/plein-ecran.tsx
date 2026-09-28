"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * LA SORTIE AU CLAVIER DU « PLEIN ÉCRAN » (PG-C3-CARTES-COLONNES) — Échap
 * ramène l'état initial, exactement comme le bouton lui-même
 * (`BasculerPleinEcran`, `page.tsx`).
 *
 * **L'état reste dans l'URL**, comme `vue`, `annulees` et le reste de cet
 * écran (`?pleinEcran=1`) : c'est `page.tsx`, un composant SERVEUR, qui décide
 * de la mise en page à partir d'elle. Ce composant-ci ne fait que naviguer
 * vers l'URL sans le paramètre quand Échap est pressé — il ne porte aucun état
 * lui-même, pour ne jamais diverger de ce que l'URL dit déjà.
 *
 * N'est monté QUE lorsque le plein écran est actif (`page.tsx`) : un
 * écouteur clavier posé en permanence sur un écran qui ne l'utilise pas
 * serait du travail pour rien.
 */
export function EchapPleinEcran({ href }: { readonly href: string }) {
  const router = useRouter();

  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") {
        router.push(href);
      }
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [router, href]);

  return null;
}
