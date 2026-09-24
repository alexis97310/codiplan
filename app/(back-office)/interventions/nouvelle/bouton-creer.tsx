"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * LE FILET VISUEL DU DOUBLE CLIC (55-FORMULAIRES-1, SAV-02 ;
 * 61-FORMULAIRES-1-REPRISE) — en plus de, jamais à la place de, la relecture
 * serveur sous `id` (`route.ts`).
 *
 * Ce formulaire est un POST natif (`<form action="..." method="post">`), pas
 * une action serveur React : `useFormStatus` ne verrait donc jamais son état
 * `pending`. **La désactivation se pose sur l'évènement `submit` DU
 * FORMULAIRE, jamais sur le `onClick` du bouton.** Mesuré (55-FORMULAIRES-1,
 * 25/09/2026) : désactiver via `disabled` posé dans `onClick` annule la
 * soumission native elle-même — le premier clic ne partait plus du tout. La
 * liste d'entrée d'un formulaire natif se construit APRÈS que `submit` s'est
 * déclenché (elle peut même être modifiée depuis ce gestionnaire, comportement
 * standard) : la soumission est donc déjà engagée quand ce gestionnaire
 * s'exécute, et la désactiver à ce moment-là ne l'annule jamais — seul un
 * second clic, qui tomberait sur un bouton déjà désactivé, l'est.
 */
export function BoutonCreer({ children }: { children: React.ReactNode }) {
  const [envoye, setEnvoye] = useState(false);
  const boutonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const formulaire = boutonRef.current?.form ?? null;
    if (formulaire === null) {
      return;
    }
    const surSoumission = () => setEnvoye(true);
    formulaire.addEventListener("submit", surSoumission);
    return () => formulaire.removeEventListener("submit", surSoumission);
  }, []);

  return (
    <Button ref={boutonRef} type="submit" disabled={envoye}>
      {children}
    </Button>
  );
}
