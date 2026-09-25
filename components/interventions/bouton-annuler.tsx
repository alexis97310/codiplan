"use client";

import { useEffect, useRef, useState } from "react";

import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";

/**
 * LE BOUTON « ANNULER L'INTERVENTION » (84-FICHE-ANNULER) — danger, désactivé
 * tant que le motif est vide, et confirmé avant l'envoi.
 *
 * Ce composant ne reçoit que des chaînes déjà traduites (jamais une fonction),
 * même convention que `ChampSiteEtMachines` (`site-et-machines.tsx`) : c'est
 * la fiche, composant serveur, qui appelle `t(...)`.
 *
 * La mécanique de confirmation (dialogue, `form.requestSubmit()`) vit dans
 * `BoutonAvecConfirmation` (`components/ui/bouton-confirmation.tsx`, extrait
 * d'ici pour 99D-ABSENCES-1) — ce fichier ne garde que ce qui est SPÉCIFIQUE
 * à l'annulation : la désactivation tant que le motif est vide. Le motif est
 * lu sur le champ `motif` DU MÊME formulaire (rendu par `Saisie`), écouté sur
 * l'évènement `input` — jamais recopié dans une prop, le champ reste la
 * seule source. Le piège de 55-FORMULAIRES-1 / 61-FORMULAIRES-1-REPRISE
 * (désactiver un bouton `submit` dans son propre `onClick`, ce qui annule la
 * soumission qu'il porte) ne s'applique pas ici : le bouton visible est
 * `type="button"`, et sa désactivation vient de cet écouteur, jamais de son
 * propre clic.
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
  const [motifRempli, setMotifRempli] = useState(false);

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

  return (
    <BoutonAvecConfirmation
      ref={boutonRef}
      libelle={libelle}
      variant="destructive"
      disabled={!motifRempli}
      texteConfirmation={
        <>
          {confirmationAvant} {reference} {confirmationApres}
        </>
      }
      boutonConfirmer={boutonConfirmer}
      boutonRevenir={boutonRevenir}
    />
  );
}
