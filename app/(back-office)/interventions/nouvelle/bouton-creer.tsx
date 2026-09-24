"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * LE FILET VISUEL DU DOUBLE CLIC (55-FORMULAIRES-1, SAV-02) — en plus de,
 * jamais à la place de, la relecture serveur sous `id` (`route.ts`).
 *
 * Ce formulaire est un POST natif (`<form action="..." method="post">`), pas
 * une action serveur React : `useFormStatus` ne verrait donc jamais son état
 * `pending`. Un état local, posé au CLIC, suffit — la navigation déclenchée
 * par ce même clic n'est jamais empêchée, seul un SECOND clic l'est.
 */
export function BoutonCreer({ children }: { children: React.ReactNode }) {
  const [envoye, setEnvoye] = useState(false);
  return (
    <Button type="submit" disabled={envoye} onClick={() => setEnvoye(true)}>
      {children}
    </Button>
  );
}
