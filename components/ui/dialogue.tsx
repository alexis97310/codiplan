"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { CLASSES_FEUILLE_BASSE } from "@/components/ui/feuille-basse";
import { cn } from "@/lib/utils";

/**
 * LE DIALOGUE GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63
 * d'Alexis du 08/10/2026) — le patron derrière « Suspendre… », « Clôturer… »
 * et « Annuler… » de l'en-tête de la fiche intervention.
 *
 * **Même `<dialog>` natif, même feuille basse que `BoutonAvecConfirmation`**
 * (`CLASSES_FEUILLE_BASSE`, `components/ui/feuille-basse.tsx`) : Escape et le
 * clic hors du dialogue le ferment NATIVEMENT (`showModal`/`close`), sans
 * écouteur posé à la main — et le focus revient au déclencheur de la même
 * façon, pour la même raison.
 *
 * **Ce composant ne porte AUCUN formulaire** — contrairement à
 * `BoutonAvecConfirmation`, qui soumet un formulaire EXTÉRIEUR au dialogue,
 * ici le corps (`enfants`) et le pied (`pied`) sont entièrement laissés à
 * l'appelant : un `<form method="post" action=…>` posé DANS `enfants` soumet
 * comme n'importe quel formulaire de page, et `pied` reçoit `fermer` pour
 * fermer le dialogue depuis son propre bouton (« Fermer », ou — pour
 * Annuler — « Garder l'intervention »).
 *
 * **`auFermer`, appelé à la fermeture, jamais à l'ouverture** (DÉFAUT mesuré
 * en adaptant `tests/e2e/fiche-annuler.spec.ts`, 9ES-TP-UX4-3-FICHE-GESTES-1A-
 * REPRISE) : `DialogueAnnuler` fermait le `MenuPlus` qui l'entoure DANS LE
 * MÊME geste que l'ouverture (`fermerMenu(); ouvrir();`) — React traite les
 * deux mises à jour dans UN SEUL rendu, et `MenuPlus` qui se referme démonte
 * tout son `children`, CE dialogue compris, avant qu'il ait pu s'ouvrir
 * (`[role="menu"]` disparaissait du DOM, aucun `<dialog>` jamais rendu). Un
 * menu qui entoure ce dialogue doit donc se fermer quand LUI se ferme, jamais
 * avant — `auFermer` porte ce geste différé.
 */
export function Dialogue({
  declencheur,
  titre,
  enfants,
  pied,
  classeDialogue,
  auFermer,
}: Readonly<{
  readonly declencheur: (ouvrir: () => void) => ReactNode;
  readonly titre: ReactNode;
  readonly enfants: (fermer: () => void) => ReactNode;
  readonly pied: (fermer: () => void) => ReactNode;
  readonly classeDialogue?: string;
  readonly auFermer?: () => void;
}>) {
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const idTitre = useId();

  useEffect(() => {
    const dialogue = dialogueRef.current;
    if (dialogue === null) {
      return;
    }
    if (ouvert) {
      dialogue.showModal();
    } else if (dialogue.open) {
      dialogue.close();
    }
  }, [ouvert]);

  const fermer = () => {
    setOuvert(false);
    auFermer?.();
  };

  return (
    <>
      {declencheur(() => setOuvert(true))}
      <dialog
        ref={dialogueRef}
        onClose={fermer}
        aria-labelledby={idTitre}
        className={cn(
          CLASSES_FEUILLE_BASSE,
          "bg-app-surface border-app-bord min-[901px]:max-w-sm",
          classeDialogue,
        )}
      >
        <h2 id={idTitre} className="text-[13px] font-bold">
          {titre}
        </h2>
        <div className="mt-2">{enfants(fermer)}</div>
        <div className="mt-4 flex justify-end gap-2">{pied(fermer)}</div>
      </dialog>
    </>
  );
}
