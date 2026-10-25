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
 *
 * `coteLargeur` (9G2A-REPRISE-9G2) — un écran qui rend la même ligne en
 * tableau ET en carte (`max-[900px]:hidden` / `min-[901px]:hidden`, 9G2) pose
 * DEUX instances de ce bouton pour la MÊME action : le bouton lui-même, cerné
 * par `display:none` côté CSS, ne l'est pas — mais chacune porte son propre
 * `<dialog>`, et deux `<dialog>` pour une seule action sont un doublon que la
 * présentation masquée ne doit pas exposer (gardien : aucun sélecteur
 * `dialog` ne doit en trouver deux pour une même ligne). Passé (`"large"`
 * pour l'instance posée à côté du tableau, visible à partir de 901 px ;
 * `"etroit"` pour celle posée dans la carte, visible jusqu'à 900 px), ce
 * prop retarde le montage du `<dialog>` jusqu'à ce qu'un effet CLIENT
 * confirme que CETTE instance correspond à la largeur réelle — les deux
 * instances démarrent sans `<dialog>` (SSR et avant hydratation : zéro
 * doublon), puis une seule le monte. Absent, le comportement est celui
 * d'avant ce prop.
 */
export function BoutonAvecConfirmation({
  ref,
  libelle,
  variant,
  disabled = false,
  dialogueActif = true,
  coteLargeur,
  texteConfirmation,
  boutonConfirmer,
  boutonRevenir,
}: {
  ref?: Ref<HTMLButtonElement>;
  libelle: string;
  variant: VariantProps<typeof buttonVariants>["variant"];
  disabled?: boolean;
  dialogueActif?: boolean;
  coteLargeur?: "large" | "etroit";
  texteConfirmation: ReactNode;
  boutonConfirmer: string;
  boutonRevenir: string;
}) {
  const boutonInterneRef = useRef<HTMLButtonElement>(null);
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const [dialogueMontable, setDialogueMontable] = useState(
    coteLargeur === undefined,
  );
  const idTitreDialogue = useId();

  useEffect(() => {
    if (coteLargeur === undefined) {
      return;
    }
    const media = window.matchMedia("(min-width: 901px)");
    function majCorrespondance() {
      setDialogueMontable(
        coteLargeur === "large" ? media.matches : !media.matches,
      );
    }
    majCorrespondance();
    media.addEventListener("change", majCorrespondance);
    return () => media.removeEventListener("change", majCorrespondance);
  }, [coteLargeur]);

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
      {!dialogueMontable ? null : (
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
      )}
    </>
  );
}
