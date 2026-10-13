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
 * (`CLASSES_FEUILLE_BASSE`, `components/ui/feuille-basse.tsx`) : Escape ferme
 * NATIVEMENT (`showModal`/`close`), et le focus revient au déclencheur de la
 * même façon, pour la même raison.
 *
 * **Le clic sur le fond ferme, et Escape AUSSI PEUT NE PAS FERMER — SAUF
 * formulaire déjà commencé** (solde 164, 9EU-SOLDE-FICHE-PLANNING ; restreint
 * au solde 178, 9EW-SOLDE-DIALOGUES-FICHE ; Escape aligné dessus par la
 * régression 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) — le clic PAS
 * nativement : un `<dialog>` modal ne ferme jamais tout seul sur un clic
 * extérieur, seul Escape l'est nativement. Le clic ferme quand la cible du
 * clic est l'ÉLÉMENT `<dialog>` lui-même (jamais un enfant — titre, corps,
 * pied), ET qu'aucun champ du formulaire n'a été modifié depuis l'ouverture ;
 * Escape, lui, ferme toujours NATIVEMENT SAUF que `onCancel` — posé sur
 * l'évènement natif `cancel`, que le navigateur déclenche avant `close` et qui
 * reste ANNULABLE, contrairement à `close` — appelle `preventDefault()` dans
 * ce même cas, et la fermeture native n'a jamais lieu. Un clic dans la marge
 * de la feuille basse ou un Échap, avec un motif déjà tapé, ne doivent pas
 * faire perdre ce motif. L'état INITIAL de chaque champ (`input`, `textarea`,
 * `select`) est capturé à l'ouverture (`showModal`), y compris sa valeur
 * PRÉ-REMPLIE (`DialogueCloturer` pose un `defaultValue`) — seul un écart avec
 * CETTE valeur bloque la fermeture, jamais la présence d'une valeur par
 * défaut déjà là avant que l'utilisateur n'y touche ; un champ monté APRÈS
 * cet instantané (absent de la carte) vaut une valeur initiale vide, pour
 * qu'une saisie dans un tel champ compte aussi.
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
type ChampDeFormulaire =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function valeurDuChamp(champ: ChampDeFormulaire): string {
  if (
    champ instanceof HTMLInputElement &&
    (champ.type === "checkbox" || champ.type === "radio")
  ) {
    return String(champ.checked);
  }
  return champ.value;
}

function capturerValeurs(
  dialogue: HTMLDialogElement,
): Map<ChampDeFormulaire, string> {
  const valeurs = new Map<ChampDeFormulaire, string>();
  dialogue
    .querySelectorAll<ChampDeFormulaire>("input, textarea, select")
    .forEach((champ) => {
      valeurs.set(champ, valeurDuChamp(champ));
    });
  return valeurs;
}

function formulaireModifie(
  dialogue: HTMLDialogElement,
  valeursInitiales: Map<ChampDeFormulaire, string> | null,
): boolean {
  if (valeursInitiales === null) {
    return false;
  }
  // UN CHAMP MONTÉ APRÈS `showModal()` N'EST JAMAIS DANS CET INSTANTANÉ
  // (solde 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) — relire les champs
  // ACTUELS du dialogue, pas seulement ceux de l'instantané, pour qu'un tel
  // champ compte aussi : sa valeur initiale, absente de la carte, vaut alors
  // une chaîne vide (aucun champ posé dans un `Dialogue` n'est aujourd'hui
  // une case à cocher ou un bouton radio, dont l'état par défaut ne serait
  // pas une chaîne vide).
  for (const champ of dialogue.querySelectorAll<ChampDeFormulaire>(
    "input, textarea, select",
  )) {
    const valeurInitiale = valeursInitiales.get(champ) ?? "";
    if (valeurDuChamp(champ) !== valeurInitiale) {
      return true;
    }
  }
  return false;
}

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
  const valeursInitialesRef = useRef<Map<ChampDeFormulaire, string> | null>(
    null,
  );
  const [ouvert, setOuvert] = useState(false);
  const idTitre = useId();

  useEffect(() => {
    const dialogue = dialogueRef.current;
    if (dialogue === null) {
      return;
    }
    if (ouvert) {
      dialogue.showModal();
      valeursInitialesRef.current = capturerValeurs(dialogue);
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
        onCancel={(evenement) => {
          // ÉCHAP DÉCLENCHE `cancel` AVANT `close` (restreint comme le clic
          // sur le fond, régression 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) —
          // empêcher `cancel` empêche la fermeture native tout entière, le
          // dialogue reste ouvert avec le champ modifié intact.
          if (
            dialogueRef.current !== null &&
            formulaireModifie(dialogueRef.current, valeursInitialesRef.current)
          ) {
            evenement.preventDefault();
          }
        }}
        onClick={(evenement) => {
          if (
            evenement.target === dialogueRef.current &&
            dialogueRef.current !== null &&
            !formulaireModifie(dialogueRef.current, valeursInitialesRef.current)
          ) {
            fermer();
          }
        }}
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
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {pied(fermer)}
        </div>
      </dialog>
    </>
  );
}
