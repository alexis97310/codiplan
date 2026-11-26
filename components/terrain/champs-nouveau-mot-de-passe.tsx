"use client";

import { useId, useState } from "react";

import { Icone } from "@/components/ui/icone";

/**
 * LE JUMEAU TERRAIN DE `components/session/champs-nouveau-mot-de-passe.tsx`
 * (9L49-TERRAIN-PROFIL-JETONS-EPURES) — MÊME comportement (les deux coches
 * qui ne reflètent la saisie qu'en direct, les deux mêmes noms de champ
 * `motDePasse`/`confirmation` attendus par `/api/session/mon-compte/
 * mot-de-passe`), seule l'habillage change.
 *
 * **Un jumeau, jamais une option sur l'original** — l'original est partagé
 * par trois écrans de bureau (`/mon-compte`, `/portail/mon-compte`,
 * `/premier-acces`, `/enrolement`) que la décision du 13/11/2026 ne touche
 * pas (« le bureau ne change pas ») : y poser un paramètre de zone aurait
 * fait porter à un composant de bureau une branche qui ne sert jamais le
 * bureau.
 *
 * Les jetons viennent des mêmes classes que les champs déjà épurés de la
 * fiche (`bg-app-terrain-champ-fond text-app-terrain-encre … border-none`,
 * `components/terrain/rapport-automatique.tsx`, `checklist-terrain.tsx`).
 */
export function ChampsNouveauMotDePasseTerrain({
  libelleMotDePasse,
  libelleConfirmation,
  texteRegleLongueur,
  texteRegleConfirmation,
  longueurMinimale,
}: Readonly<{
  libelleMotDePasse: string;
  libelleConfirmation: string;
  texteRegleLongueur: string;
  texteRegleConfirmation: string;
  longueurMinimale: number;
}>) {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const idMotDePasse = useId();
  const idConfirmation = useId();

  const longueurAtteinte = motDePasse.length >= longueurMinimale;
  const confirmationIdentique =
    confirmation !== "" && motDePasse === confirmation;

  return (
    <>
      <label
        htmlFor={idMotDePasse}
        className="flex flex-col gap-1.5 text-16 font-medium"
      >
        {libelleMotDePasse}
        <input
          id={idMotDePasse}
          name="motDePasse"
          type="password"
          required
          autoComplete="new-password"
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          className="bg-app-terrain-champ-fond text-app-terrain-encre w-full rounded-md border-none px-2 py-1.5 text-16 font-medium"
        />
      </label>
      <ul className="text-app-terrain-encre-secondaire -mt-2 flex flex-wrap gap-4 text-14">
        <li className="flex items-center gap-1.5">
          {longueurAtteinte ? (
            <Icone nom="check" className="text-app-vert-plein" />
          ) : null}
          {texteRegleLongueur}
        </li>
        <li className="flex items-center gap-1.5">
          {confirmationIdentique ? (
            <Icone nom="check" className="text-app-vert-plein" />
          ) : null}
          {texteRegleConfirmation}
        </li>
      </ul>
      <label
        htmlFor={idConfirmation}
        className="flex flex-col gap-1.5 text-16 font-medium"
      >
        {libelleConfirmation}
        <input
          id={idConfirmation}
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
          value={confirmation}
          onChange={(evenement) => setConfirmation(evenement.target.value)}
          className="bg-app-terrain-champ-fond text-app-terrain-encre w-full rounded-md border-none px-2 py-1.5 text-16 font-medium"
        />
      </label>
    </>
  );
}
