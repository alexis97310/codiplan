"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  ecrireCopieEnRemplacantLidentite,
  type InstantaneTerrain,
} from "@/lib/terrain/copie-locale";

/** Deux rafraîchissements ne se suivent jamais à moins de 60 s (point 3). */
const DELAI_MIN_MS = 60_000;

/**
 * CHARGE LA COQUILLE SANS RÉSEAU DANS UN CADRE INVISIBLE (point 1,
 * 9F4H4B-OUVERTURE-A-FROID) — une fois par montage, jamais plus.
 *
 * ## POURQUOI UN CADRE, ET POURQUOI PAS `router.prefetch()`
 *
 * `/terrain-hors-reseau` est déjà dans `COQUILLE` de `public/sw.js` : son
 * document HTML est posé au CACHE dès l'installation. Ce qui lui manque tant
 * que personne ne l'a jamais OUVERTE est son propre script compilé
 * (`/_next/static/chunks/…`), que le service worker ne garde qu'« à l'usage »
 * (son en-tête, § ligne ~137) — jamais tiré par le seul document HTML.
 *
 * Un `<iframe>` chargé dans le DOM déclenche une VRAIE navigation de
 * document : le navigateur suit les `<script src>` qu'elle contient, chacun
 * passant par le service worker comme n'importe quelle ressource statique, et
 * s'y pose. `router.prefetch()` (App Router) irait plus vite, mais demande
 * la charge utile RSC — pas le document HTML complet que le repli hors
 * réseau sert ensuite (`caches.match("/terrain-hors-reseau")`) : l'écraser
 * par un fragment RSC casserait la coquille pour tout le monde.
 *
 * ## ELLE NE REND RIEN, ET N'ÉCHOUE JAMAIS BRUYAMMENT
 *
 * Même contrat que le reste de ce fichier : un cadre qui ne se charge pas
 * (hors réseau, navigateur qui le bloque) laisse simplement la coquille sans
 * script frais — jamais pire que l'état d'avant 9F4H4B.
 */
function PrechargementCoquille() {
  const dejaDemande = useRef(false);

  useEffect(() => {
    if (!navigator.onLine || dejaDemande.current) {
      return;
    }
    dejaDemande.current = true;
    const cadre = document.createElement("iframe");
    cadre.src = "/terrain-hors-reseau";
    cadre.setAttribute("aria-hidden", "true");
    cadre.tabIndex = -1;
    cadre.style.position = "absolute";
    cadre.style.width = "0";
    cadre.style.height = "0";
    cadre.style.border = "none";
    cadre.addEventListener("load", () => cadre.remove());
    document.body.appendChild(cadre);
  }, []);

  return null;
}

/**
 * LA PRISE DE COPIE — rend l'instantané disponible sans réseau (point 3,
 * 9F4H1-HORS-RESEAU-CONSULTATION).
 *
 * ## QUAND ELLE SOLLICITE LE RÉSEAU, ET QUAND ELLE SE TAIT
 *
 * À l'ouverture ET après chaque navigation DANS le segment terrain — jamais
 * plus d'une fois par 60 secondes (un `ref`, pas un état : une réécriture ne
 * doit pas redéclencher de rendu). **Jamais hors réseau** : `navigator.onLine`
 * fausse-négatif parfois (un portail captif se déclare « en ligne »), mais un
 * `fetch` qui échouerait de toute façon ne coûte qu'un essai silencieux — la
 * garde évite seulement le cas FRANC où le navigateur sait déjà qu'il n'y a
 * rien à tenter.
 *
 * ## ELLE NE REND RIEN, ET N'ÉCHOUE JAMAIS BRUYAMMENT
 *
 * Même contrat que `components/pwa/enregistrement.tsx` : une copie qui ne se
 * pose pas n'est jamais pire que l'absence de hors-ligne.
 */
export function CopieLocaleTerrain() {
  const chemin = usePathname();
  const derniereFois = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }
    // `performance.now()` — une DURÉE ÉCOULÉE, jamais un instant interprété :
    // ce n'est pas une date (gardien L0-08, `tests/unit/calendar/sans-date-
    // courante-implicite.test.ts`), c'est une horloge monotone pour un
    // simple débit.
    const maintenant = performance.now();
    if (
      derniereFois.current !== null &&
      maintenant - derniereFois.current < DELAI_MIN_MS
    ) {
      return;
    }
    derniereFois.current = maintenant;

    void (async () => {
      try {
        const reponse = await fetch("/api/terrain/instantane", {
          headers: { accept: "application/json" },
        });
        if (!reponse.ok) {
          return;
        }
        const instantane = (await reponse.json()) as InstantaneTerrain;
        await ecrireCopieEnRemplacantLidentite(instantane);
      } catch {
        /* pas de copie fraîche ; la copie précédente, s'il y en a une, reste */
      }
    })();
  }, [chemin]);

  return <PrechargementCoquille />;
}
