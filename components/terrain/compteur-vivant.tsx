"use client";

import { useEffect, useState } from "react";

import { enDureeHMS } from "@/lib/calendar/duree";
import {
  decalageHorloge,
  instantAppareil,
  secondesEcoulees,
} from "@/lib/terrain/compteur-vivant";

/**
 * LE COMPTEUR QUI DÉFILE (9F4H5-TERRAIN-VIVANT, point 1) — `HH:MM:SS`, mis à
 * jour chaque seconde pendant que le compteur tourne. Posé sur la fiche
 * (`/terrain/[id]`, segment ICI), sur le bandeau « Compteur en marche
 * depuis… » (`bandeau-compteur.tsx`) et sur le statut hors réseau
 * (`compteur-terrain.tsx`) — un seul composant pour les trois (§9, 01/09).
 *
 * N'écrit RIEN : l'affichage seul change, jamais ce qui est enregistré
 * (`lib/interventions/` n'est pas concerné par ce ticket).
 */
export function CompteurVivant({
  depart,
  minutesFermees = 0,
  instantServeur = null,
}: {
  readonly depart: Date;
  readonly minutesFermees?: number;
  readonly instantServeur?: Date | null;
}) {
  const [decalageMs] = useState(() =>
    decalageHorloge(instantServeur, instantAppareil()),
  );
  const [texte, setTexte] = useState(() =>
    enDureeHMS(
      secondesEcoulees({
        depart,
        minutesFermees,
        decalageHorlogeMs: decalageMs,
        maintenant: instantAppareil(),
      }),
    ),
  );

  useEffect(() => {
    function tic(): void {
      setTexte(
        enDureeHMS(
          secondesEcoulees({
            depart,
            minutesFermees,
            decalageHorlogeMs: decalageMs,
            maintenant: instantAppareil(),
          }),
        ),
      );
    }
    tic();
    const identifiant = setInterval(tic, 1000);
    return () => clearInterval(identifiant);
  }, [depart, minutesFermees, decalageMs]);

  return <>{texte}</>;
}
