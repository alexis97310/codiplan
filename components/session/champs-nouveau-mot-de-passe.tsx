"use client";

import { useId, useState } from "react";

import { Icone } from "@/components/ui/icone";

/**
 * LES DEUX CHAMPS D'UN MOT DE PASSE NEUF, AVEC SES DEUX RÈGLES EN DIRECT
 * (9G6-FORMULAIRES, point 3) — `/premier-acces` montrait les deux coches
 * (« 8 caractères ou plus », « mots de passe identiques ») TOUJOURS vertes,
 * y compris avant toute saisie : elles ne reflétaient rien de ce qui venait
 * d'être tapé. Posées en client, elles reflètent maintenant l'état réel des
 * deux champs — et disparaissent tant qu'il n'est pas atteint, plutôt que de
 * mentir en vert.
 *
 * `longueurMinimale` est un PROP, jamais importé ici : `lib/auth/
 * premier-acces.ts` porte `auth()` (Better Auth), du code SERVEUR qu'un
 * composant client ne doit jamais empaqueter. La page serveur lit
 * `LONGUEUR_MINIMALE` et la passe en nombre nu — une seule source, jamais
 * une seconde constante qui pourrait diverger en silence (§9, 01/09).
 *
 * Les deux noms de champ (`motDePasse`, `confirmation`) restent ceux
 * qu'attend déjà `app/api/session/premier-acces/route.ts` : ce lot ne change
 * aucun contrat de soumission, seulement ce que l'écran montre avant l'envoi.
 */
export function ChampsNouveauMotDePasse({
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
        className="flex flex-col gap-1.5 text-sm font-medium"
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
          className="border-input bg-app-surface rounded-md border px-3 py-2 text-sm font-normal"
        />
      </label>
      <ul className="text-muted-foreground -mt-2 flex flex-wrap gap-4 text-14">
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
        className="flex flex-col gap-1.5 text-sm font-medium"
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
          className="border-input bg-app-surface rounded-md border px-3 py-2 text-sm font-normal"
        />
      </label>
    </>
  );
}
