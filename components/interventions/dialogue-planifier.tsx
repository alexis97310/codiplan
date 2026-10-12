"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « PLANIFIER À LA MAIN » (9ES-TP-UX4-3-FICHE-GESTES-2, D195) —
 * la voie de repli du bloc « Planifier », à côté du bouton d'en-tête
 * « Trouver un créneau » (`TrouverCreneau`, inchangé). Même route, même
 * contenu que l'ancien bloc « Planifier » de la carte Actions (PARCOURS-1) :
 * les quatre valeurs — date, heure, durée, technicien — ensemble.
 */
export function DialoguePlanifier({
  action,
  note,
  options,
  libelleOptionVide,
  disponibilite,
}: Readonly<{
  readonly action: string;
  readonly note: string;
  readonly options: readonly {
    readonly valeur: string;
    readonly libelle: string;
    readonly bloque?: boolean;
  }[];
  readonly libelleOptionVide: string;
  readonly disponibilite?: ReactNode;
}>) {
  const idFormulaire = useId();

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button type="button" variant="outline" size="sm" onClick={ouvrir}>
          {t("intervention.action.planifier_a_la_main")}
        </Button>
      )}
      titre={t("intervention.action.planifier_a_la_main")}
      enfants={() => (
        <form
          id={idFormulaire}
          action={action}
          method="post"
          className="flex flex-col gap-3"
        >
          <p className="text-app-encre-faible text-12 font-bold">{note}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.date")}
            <input
              name="date_planifiee"
              type="date"
              required
              className={CLASSES_CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.deplacement.heure")}
            <input
              name="heure_debut"
              type="time"
              required
              className={CLASSES_CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.deplacement.duree")}
            <input
              name="duree_min"
              type="number"
              required
              min={1}
              className={CLASSES_CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.technicien")}
            <select name="technicien_id" required className={CLASSES_CHAMP}>
              <option value="">{libelleOptionVide}</option>
              {options.map((option) => (
                <option
                  key={option.valeur}
                  value={option.valeur}
                  {...(option.bloque === true
                    ? { "data-agenda-bloque": "" }
                    : {})}
                >
                  {option.libelle}
                </option>
              ))}
            </select>
          </label>
          {disponibilite}
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <Button type="submit" form={idFormulaire} size="sm">
            {t("intervention.action.planifier_a_la_main")}
          </Button>
        </>
      )}
    />
  );
}
