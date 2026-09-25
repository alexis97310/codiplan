"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * LE BOUTON « ANNULER L'INTERVENTION » (84-FICHE-ANNULER) — danger, désactivé
 * tant que le motif est vide, et confirmé avant l'envoi.
 *
 * Ce composant ne reçoit que des chaînes déjà traduites (jamais une fonction),
 * même convention que `ChampSiteEtMachines` (`site-et-machines.tsx`) : c'est
 * la fiche, composant serveur, qui appelle `t(...)`.
 *
 * **Le formulaire reste un POST natif** (`Action`, dans la fiche) : ce bouton
 * est `type="button"`, jamais `type="submit"` — la soumission ne part QUE
 * depuis le bouton de confirmation, par `form.requestSubmit()`. Le piège de
 * 55-FORMULAIRES-1 / 61-FORMULAIRES-1-REPRISE (désactiver un bouton `submit`
 * dans son propre `onClick`, ce qui annule la soumission qu'il porte) ne
 * s'applique donc pas ici : ce bouton ne soumet jamais lui-même, et sa
 * désactivation vient d'un écouteur posé sur le champ motif, jamais sur son
 * propre clic.
 *
 * Le motif est lu sur le champ `motif` DU MÊME formulaire (rendu par
 * `Saisie`), écouté sur l'évènement `input` — jamais recopié dans une prop,
 * le champ reste la seule source.
 */
export function BoutonAnnuler({
  libelle,
  confirmationAvant,
  reference,
  confirmationApres,
  boutonConfirmer,
  boutonRevenir,
}: {
  libelle: string;
  confirmationAvant: string;
  reference: string;
  confirmationApres: string;
  boutonConfirmer: string;
  boutonRevenir: string;
}) {
  const boutonRef = useRef<HTMLButtonElement>(null);
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const [motifRempli, setMotifRempli] = useState(false);
  const [dialogueOuvert, setDialogueOuvert] = useState(false);

  useEffect(() => {
    const formulaire = boutonRef.current?.form ?? null;
    const motif = formulaire?.elements.namedItem("motif") ?? null;
    if (
      !(motif instanceof HTMLInputElement) &&
      !(motif instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    const surSaisie = () => setMotifRempli(motif.value.trim().length > 0);
    surSaisie();
    motif.addEventListener("input", surSaisie);
    return () => motif.removeEventListener("input", surSaisie);
  }, []);

  useEffect(() => {
    const dialogue = dialogueRef.current;
    if (dialogue === null) {
      return;
    }
    if (dialogueOuvert) {
      dialogue.showModal();
    } else if (dialogue.open) {
      dialogue.close();
    }
  }, [dialogueOuvert]);

  return (
    <>
      <Button
        ref={boutonRef}
        type="button"
        variant="destructive"
        size="sm"
        disabled={!motifRempli}
        onClick={() => setDialogueOuvert(true)}
      >
        {libelle}
      </Button>
      <dialog
        ref={dialogueRef}
        onClose={() => setDialogueOuvert(false)}
        aria-labelledby="confirmation-annulation"
        className="bg-app-surface border-app-bord max-w-sm rounded-lg border p-4 shadow-lg backdrop:bg-app-encre/40"
      >
        <p id="confirmation-annulation" className="text-[13px]">
          {confirmationAvant} {reference} {confirmationApres}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogueOuvert(false)}
          >
            {boutonRevenir}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setDialogueOuvert(false);
              boutonRef.current?.form?.requestSubmit();
            }}
          >
            {boutonConfirmer}
          </Button>
        </div>
      </dialog>
    </>
  );
}
