"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";

import { Button, type buttonVariants } from "@/components/ui/button";
import { CLASSES_FEUILLE_BASSE } from "@/components/ui/feuille-basse";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

/**
 * UN BOUTON QUI SOUMET SON FORMULAIRE APRÈS CONFIRMATION (extrait de
 * `BoutonAnnuler`, 84-FICHE-ANNULER, pour 99D-ABSENCES-1).
 *
 * **Le formulaire reste un POST natif** : ce bouton est `type="button"`,
 * jamais `type="submit"` — la soumission ne part QUE depuis le bouton de
 * confirmation, par `form.requestSubmit()`. `BoutonAnnuler` garde son propre
 * fichier : lui seul écoute le champ `motif` pour se désactiver, une
 * mécanique spécifique à l'annulation que ce composant générique n'a pas à
 * connaître.
 *
 * `dialogueActif` (99R-GR3-CLOTURE) — quand `false`, le clic soumet le
 * formulaire DIRECTEMENT, sans ouvrir le dialogue : la clôture ne peut pas
 * proposer « Clôturer avec … validées ? » quand le champ ne porte pas un
 * nombre de minutes exploitable, et le clic doit alors se comporter comme
 * un bouton `submit` ordinaire — le serveur refuse comme aujourd'hui.
 *
 * **FEUILLE BASSE AU TÉLÉPHONE** (9DV-TP-NAV4-TELEPHONE-GLOSSAIRE) —
 * `CLASSES_FEUILLE_BASSE` (`components/ui/feuille-basse.tsx`) colle ce
 * dialogue au bas de l'écran sous 901 px, et le recentre au-dessus.
 */
export function BoutonAvecConfirmation({
  ref,
  libelle,
  variant,
  disabled = false,
  dialogueActif = true,
  texteConfirmation,
  boutonConfirmer,
  boutonRevenir,
}: {
  ref?: Ref<HTMLButtonElement>;
  libelle: string;
  variant: VariantProps<typeof buttonVariants>["variant"];
  disabled?: boolean;
  dialogueActif?: boolean;
  texteConfirmation: ReactNode;
  boutonConfirmer: string;
  boutonRevenir: string;
}) {
  const boutonInterneRef = useRef<HTMLButtonElement>(null);
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const idTitreDialogue = useId();

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
        ref={(noeud: HTMLButtonElement | null) => {
          boutonInterneRef.current = noeud;
          if (typeof ref === "function") {
            ref(noeud);
          } else if (ref) {
            ref.current = noeud;
          }
        }}
        type="button"
        variant={variant}
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (!dialogueActif) {
            boutonInterneRef.current?.form?.requestSubmit();
            return;
          }
          setDialogueOuvert(true);
        }}
      >
        {libelle}
      </Button>
      <dialog
        ref={dialogueRef}
        onClose={() => setDialogueOuvert(false)}
        aria-labelledby={idTitreDialogue}
        className={cn(
          CLASSES_FEUILLE_BASSE,
          "bg-app-surface border-app-bord min-[901px]:max-w-sm",
        )}
      >
        <p id={idTitreDialogue} className="text-[13px] font-bold">
          {texteConfirmation}
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
            variant={variant}
            size="sm"
            onClick={() => {
              setDialogueOuvert(false);
              boutonInterneRef.current?.form?.requestSubmit();
            }}
          >
            {boutonConfirmer}
          </Button>
        </div>
      </dialog>
    </>
  );
}
