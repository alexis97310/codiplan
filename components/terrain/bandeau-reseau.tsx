"use client";

import { useEffect, useState } from "react";

import { type Fuseau } from "@/lib/calendar/fuseau";

import { libelleCopieDu } from "./presentation";

/**
 * LE BANDEAU RÉSEAU (point 5, 9F4H1-HORS-RESEAU-CONSULTATION) — posé sur
 * `/terrain`, `/terrain/[id]` et la coquille `/terrain-hors-reseau`, un seul
 * composant pour les trois : un fait affiché de deux façons divergerait en
 * silence (§9, 01/09).
 *
 * ## UN SEUL MÉCANISME : `navigator.onLine` + `online`/`offline`
 *
 * 9F4 détecte le réseau par l'échec d'un `fetch` et par l'événement `online`
 * seul (`components/terrain/rapport-automatique.tsx`) — jamais `offline`,
 * dont il n'a pas besoin puisqu'il ne montre rien tant qu'un envoi n'a pas
 * échoué. Ce bandeau, lui, doit apparaître SANS attendre un envoi : il écoute
 * donc aussi `offline`. Les deux mécanismes cohabitent sans se remplacer.
 *
 * `genereLe` est `null` sur la coquille servie par le service worker QUAND
 * aucune copie n'existe encore (son composant affiche alors son propre
 * message, et ce bandeau ne s'affiche pas non plus — sans date, « copie du »
 * ne dirait rien).
 */
export function BandeauReseau({
  genereLe,
  fuseau,
}: {
  readonly genereLe: string | null;
  readonly fuseau: Fuseau;
}) {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    setHorsLigne(!navigator.onLine);
    const surEnLigne = () => setHorsLigne(false);
    const surHorsLigne = () => setHorsLigne(true);
    window.addEventListener("online", surEnLigne);
    window.addEventListener("offline", surHorsLigne);
    return () => {
      window.removeEventListener("online", surEnLigne);
      window.removeEventListener("offline", surHorsLigne);
    };
  }, []);

  if (!horsLigne || genereLe === null) {
    return null;
  }

  return (
    <p
      role="status"
      className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
    >
      {libelleCopieDu(genereLe, fuseau)}
    </p>
  );
}
