"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « SUSPENDRE <RÉF> » (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63
 * d'Alexis du 08/10/2026, AMENDE D183 R1).
 *
 * **Contenu ACTUEL du bloc Suspendre** (L2-10, RG-INT-06), posé dans un
 * `Dialogue` plutôt que dans la carte Actions : motif, référence de pièce,
 * date de disponibilité, aide. La route et la méthode ne changent pas — un
 * `<form>` POST ordinaire, soumis par le bouton du pied via l'attribut
 * `form` (le bouton vit dans le pied du dialogue, hors du `<form>`
 * lui-même).
 *
 * **Aucune désactivation JS du bouton** : le motif reste, comme aujourd'hui,
 * vérifié par le serveur (`peutSuspendre`), jamais par un état recopié ici —
 * ce dialogue ne fait qu'ouvrir, dans une fenêtre, exactement le formulaire
 * qui existait déjà.
 */
export function DialogueSuspendre({
  reference,
  action,
}: Readonly<{
  readonly reference: string;
  readonly action: string;
}>) {
  const idFormulaire = useId();

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-[900px]:h-11 max-[900px]:px-4"
          onClick={ouvrir}
        >
          {t("intervention.action.suspendre")}
        </Button>
      )}
      titre={
        <>
          {t("intervention.action.suspendre")} {reference}
        </>
      }
      enfants={() => (
        <form
          id={idFormulaire}
          action={action}
          method="post"
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.suspension.motif")}
            <input name="motif" className={CLASSES_CHAMP} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.suspension.piece")}
            <input name="piece_attendue_ref" className={CLASSES_CHAMP} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.suspension.date_dispo")}
            <input
              name="date_dispo_prevue"
              type="date"
              className={CLASSES_CHAMP}
            />
          </label>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("intervention.suspension.piece_aide")}
          </p>
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <Button type="submit" form={idFormulaire} size="sm">
            {t("intervention.action.suspendre")}
          </Button>
        </>
      )}
    />
  );
}
