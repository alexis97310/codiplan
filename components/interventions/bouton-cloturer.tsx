"use client";

import { useEffect, useRef, useState } from "react";

import { dureeCarteAffichee } from "@/app/(back-office)/planning/carte";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { t } from "@/lib/i18n/fr";

/**
 * LE TEXTE DE CONFIRMATION AVANT CLÔTURE — « Clôturer avec 1 h 30 validées ? »
 * (99R-GR3-CLOTURE).
 *
 * Fonction PURE, éprouvée seule : elle ne juge pas si `minutesValidees` est
 * exploitable, c'est au bouton de ne l'appeler qu'avec une valeur positive
 * (`dureeCarteAffichee` rendrait `null` sinon, et ce texte deviendrait faux).
 */
export function texteConfirmationCloture(minutesValidees: number): string {
  return `${t("intervention.cloture.confirmation_avant")} ${dureeCarteAffichee(minutesValidees)} ${t("intervention.cloture.confirmation_apres")}`;
}

/**
 * LE BOUTON « CLÔTURER », DEMANDANT COMBIEN DE TEMPS AVANT DE FIGER
 * (99R-GR3-CLOTURE) — frère de `BoutonAnnuler` (`bouton-annuler.tsx`), même
 * mécanique de dialogue (`BoutonAvecConfirmation`).
 *
 * Le champ `temps_valide_min` DU MÊME formulaire reste la seule source, lu à
 * chaque `input` — jamais recopié dans une prop (même discipline que le motif
 * de `BoutonAnnuler`). Une valeur vide ou non numérique n'ouvre pas le
 * dialogue : `dialogueActif` vaut alors `false`, et le clic soumet le
 * formulaire directement — le serveur refuse comme aujourd'hui.
 */
export function BoutonCloturer({
  libelle,
  variant,
  boutonConfirmer,
  boutonRevenir,
}: {
  libelle: string;
  variant: "default" | "outline";
  boutonConfirmer: string;
  boutonRevenir: string;
}) {
  const boutonRef = useRef<HTMLButtonElement>(null);
  const [minutesValidees, setMinutesValidees] = useState<number | null>(null);

  useEffect(() => {
    const formulaire = boutonRef.current?.form ?? null;
    const champ = formulaire?.elements.namedItem("temps_valide_min") ?? null;
    if (!(champ instanceof HTMLInputElement)) {
      return;
    }
    const surSaisie = () => {
      const valeur = champ.value.trim();
      const minutes = Number(valeur);
      setMinutesValidees(
        valeur === "" || !Number.isFinite(minutes) || minutes <= 0
          ? null
          : minutes,
      );
    };
    surSaisie();
    champ.addEventListener("input", surSaisie);
    return () => champ.removeEventListener("input", surSaisie);
  }, []);

  return (
    <BoutonAvecConfirmation
      ref={boutonRef}
      libelle={libelle}
      variant={variant}
      dialogueActif={minutesValidees !== null}
      texteConfirmation={
        minutesValidees === null
          ? ""
          : texteConfirmationCloture(minutesValidees)
      }
      boutonConfirmer={boutonConfirmer}
      boutonRevenir={boutonRevenir}
    />
  );
}
