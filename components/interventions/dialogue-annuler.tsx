"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { useFermerMenuPlus } from "@/components/ui/menu-plus";
import { t } from "@/lib/i18n/fr";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « ANNULER <RÉF> ? » (9ES-TP-UX4-3-FICHE-GESTES-1, décision
 * n° 63 d'Alexis du 08/10/2026, AMENDE D183 R1 — « Aucun menu ⋯ » n'est
 * désormais vrai qu'EN DEHORS de ce lot, pour Annuler et Bon d'intervention).
 *
 * **Un seul geste explicite, danger** — le pied porte « Garder
 * l'intervention » (ferme, neutre) et « Annuler l'intervention » (danger,
 * désactivé tant que le motif est vide). *Une annulation n'efface rien : elle
 * se justifie* (`intervention.annulation.obligatoire`) — le motif reste
 * contrôlé ici en JS, comme dans l'ancien `BoutonAnnuler`, pour que le bouton
 * ne s'active qu'une fois la raison écrite ; le serveur refuse toujours sans
 * lui (`annulerIntervention`, `lib/interventions/depot.ts`).
 */
export function DialogueAnnuler({
  reference,
  action,
}: Readonly<{
  readonly reference: string;
  readonly action: string;
}>) {
  const idFormulaire = useId();
  const [motifRempli, setMotifRempli] = useState(false);
  // FERME LE MENU « ⋯ » QUI L'ENTOURE (`MenuPlus`) QUAND LUI SE FERME,
  // JAMAIS AVANT (`Dialogue.auFermer`) — le fermer AU CLIC qui ouvre ce
  // dialogue démontait `MenuPlus.children`, CE dialogue compris, avant qu'il
  // ait pu s'ouvrir (défaut mesuré, voir la docstring de `Dialogue`). Sans
  // effet quand ce dialogue n'est pas posé dans un menu.
  const fermerMenu = useFermerMenuPlus();

  return (
    <Dialogue
      auFermer={fermerMenu}
      declencheur={(ouvrir) => (
        <button
          type="button"
          role="menuitem"
          onClick={ouvrir}
          className="hover:bg-app-fond flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-13 font-bold"
        >
          {t("intervention.action.annuler")}
        </button>
      )}
      titre={
        <>
          {t("intervention.annulation.confirmation_avant")} {reference}
          {t("intervention.annulation.titre_suffixe")}
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
            {t("intervention.annulation.motif")}
            <textarea
              name="motif"
              required
              onChange={(evenement) =>
                setMotifRempli(evenement.target.value.trim().length > 0)
              }
              className={CLASSES_CHAMP}
            />
          </label>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("intervention.annulation.obligatoire")}
          </p>
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("intervention.annulation.garder")}
          </Button>
          <Button
            type="submit"
            form={idFormulaire}
            variant="destructive"
            size="sm"
            disabled={!motifRempli}
          >
            {t("intervention.action.annuler")}
          </Button>
        </>
      )}
    />
  );
}
