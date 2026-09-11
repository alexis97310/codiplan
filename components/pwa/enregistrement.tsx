"use client";

import { useEffect } from "react";

/**
 * L'ENREGISTREMENT DU SERVICE WORKER (L3-06).
 *
 * ## Pourquoi un composant client, et le plus petit possible
 *
 * `navigator.serviceWorker` n'existe que dans le navigateur. Ce composant ne
 * rend **rien** — il n'a ni balise, ni état, ni texte : *tout ce qu'il
 * afficherait serait une chaîne visible de plus à traduire, pour dire une chose
 * que personne n'a demandé à savoir.*
 *
 * ## IL N'ÉCHOUE JAMAIS BRUYAMMENT
 *
 * Un enregistrement refusé — navigateur trop ancien, contexte non sécurisé,
 * politique d'entreprise — **ne doit pas casser la page**. C'est la règle de
 * `lib/db/sante.ts`, appliquée ici : *une sonde qui tombe en même temps que ce
 * qu'elle surveille ne surveille rien*, et une application qui refuserait de
 * s'afficher parce qu'elle ne peut pas fonctionner hors ligne serait pire que
 * celle qui fonctionne en ligne seulement.
 *
 * **Le sens de défaillance est donc : pas de hors-ligne, mais l'application
 * marche.** C'est le seul acceptable ici.
 *
 * ## Il est posé à la RACINE, et c'est délibéré
 *
 * Le service worker sert la coquille, pas un écran : le poser dans un segment
 * l'attacherait à un groupe de routes, et il ne s'installerait pas depuis les
 * autres. *Ce qui décide ici n'est pas la page, c'est l'origine.*
 */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    // `void` et un `catch` vide : l'échec est une absence de hors-ligne, pas
    // une erreur à remonter. Voir l'entête.
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* pas de hors-ligne ; l'application fonctionne */
      });
  }, []);

  return null;
}
