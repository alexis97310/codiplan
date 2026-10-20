"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { activiteTerrainEnCours } from "@/lib/terrain/activite-saisie";
import { doitRafraichir } from "@/lib/terrain/rafraichissement";

const INTERVALLE_MS = 60_000;

/**
 * « MA JOURNÉE SE MET À JOUR SEULE » (9F4H5-TERRAIN-VIVANT, point 2) — posé
 * sur `/terrain` et sur `/terrain/[id]`, jamais sur la coquille hors réseau
 * (`/terrain-hors-reseau`, qui n'a rien à aller chercher — I4).
 *
 * Trois déclencheurs : l'appli redevient visible, le réseau revient, et une
 * minuterie de 60 s tant que l'onglet est visible. Chacun repose sur la MÊME
 * règle (`doitRafraichir`) — jamais trois conditions réécrites trois fois,
 * qui finiraient par diverger (§9, 01/09).
 *
 * Ne rend rien : seul l'effet de bord (`router.refresh()`) compte.
 */
export function RafraichissementAutomatique() {
  const router = useRouter();

  useEffect(() => {
    function rafraichirSiLaRegleLePermet(): void {
      if (
        doitRafraichir({
          visible: document.visibilityState === "visible",
          enLigne: navigator.onLine,
          activiteEnCours: activiteTerrainEnCours(),
        })
      ) {
        router.refresh();
      }
    }

    function surVisibilite(): void {
      if (document.visibilityState === "visible") {
        rafraichirSiLaRegleLePermet();
      }
    }

    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("online", rafraichirSiLaRegleLePermet);
    const minuterie = setInterval(rafraichirSiLaRegleLePermet, INTERVALLE_MS);

    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("online", rafraichirSiLaRegleLePermet);
      clearInterval(minuterie);
    };
  }, [router]);

  return null;
}
