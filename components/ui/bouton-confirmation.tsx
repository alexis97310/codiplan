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
 *
 * **LE DIALOGUE OUVERT NE SE DÉMONTE JAMAIS SOUS LUI (9G4C-REPRISE-9G4A)** —
 * `majCorrespondance`, l'écouteur `matchMedia("change")` qui pilote
 * `coteLargeur`, ignore toute notification pendant que CETTE instance a son
 * dialogue ouvert (`dialogueOuvertRef`). Mesuré : `showModal()` lui-même
 * (perte du défilement de fond, reflux de la scrollbar) peut faire émettre
 * à Chromium un `change` avec la MÊME valeur juste après l'ouverture — un
 * appel à `setDialogueMontable` identique au précédent ne remonte rien,
 * mais sans cette garde, un VRAI redimensionnement de fenêtre pendant que
 * le dialogue est ouvert (l'utilisateur maximise, ou passe en demi-écran)
 * démonterait `<dialog>` — React retire le nœud encore ouvert, en remonte
 * deux (un par instance, avant que l'effet matchMedia de chacune ne
 * retranche la mauvaise), puis l'un des deux repart aussitôt. Ni un
 * `.close()`, ni Échap, ni la confirmation : le dialogue disparaissait sous
 * l'utilisateur. La largeur réelle (donc laquelle instance doit monter le
 * dialogue la PROCHAINE fois qu'on clique) continue d'être recalculée
 * normalement dès que ce dialogue se ferme.
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
  const dialogueOuvertRef = useRef(dialogueOuvert);
  dialogueOuvertRef.current = dialogueOuvert;

  useEffect(() => {
    if (coteLargeur === undefined) {
      return;
    }
    const media = window.matchMedia("(min-width: 901px)");
    function majCorrespondance() {
      if (dialogueOuvertRef.current) {
        return;
      }
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
