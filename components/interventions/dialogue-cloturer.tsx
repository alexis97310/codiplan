"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";
import { explicationRegle } from "@/lib/interventions/presentation-partagee";
import type { RegleArrondi } from "@/lib/tarification/valorisation";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « CLÔTURER <RÉF> » (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63
 * d'Alexis du 08/10/2026, AMENDE D183 R1).
 *
 * **Contenu ACTUEL du bloc Clôturer** (D120) : le champ temps validé,
 * pré-rempli depuis le temps mesuré, l'aide et l'explication. Le bouton
 * d'action est TOUJOURS visible — contrairement à l'ancien bloc replié, qui
 * n'affichait QUE le motif sur un refus — mais désactivé si `peutCloturer`
 * refuse, avec le motif écrit à la place : on voit le champ ET pourquoi on
 * ne peut pas encore valider.
 *
 * **Aucun second dialogue de confirmation** (contrairement à
 * `BoutonCloturer`, qui ouvrait sa propre fenêtre « Clôturer avec … validées
 * ? ») : ce dialogue EST la confirmation, et il n'y en a plus qu'une.
 */
export function DialogueCloturer({
  reference,
  action,
  tempsMesureMin,
  verdict,
  unSegmentHorsReseau,
  regle,
}: Readonly<{
  readonly reference: string;
  readonly action: string;
  readonly tempsMesureMin: number | null;
  readonly verdict: { readonly refuse: boolean; readonly raison: string };
  /**
   * 9F4H2-HORS-RESEAU-HEURE-ET-REJEU (décision n° 107 d'Alexis, 14/10/2026) —
   * au moins un segment de temps de CETTE intervention porte l'heure du
   * téléphone : le temps validé ci-dessous en dépend. Une LIGNE
   * d'avertissement, jamais un refus — le temps reste saisi par l'ADV comme
   * aujourd'hui.
   */
  readonly unSegmentHorsReseau: boolean;
  /**
   * LA RÈGLE COURANTE DE LA SOCIÉTÉ (9I8A1-REPRISE-9I8A) — celle qui
   * s'appliquera SI la clôture a lieu maintenant. `lireFicheIntervention` ne
   * rend encore aucune `ValorisationAffichee` à ce stade (`temps_valide_min`
   * n'est écrit qu'à la clôture) : c'est pourquoi ce dialogue reçoit la
   * règle séparément, lue par `lireRegleArrondi`
   * (`lib/societes/identite.ts`).
   */
  readonly regle: RegleArrondi;
}>) {
  const idFormulaire = useId();

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button
          type="button"
          size="sm"
          className="max-[900px]:h-11 max-[900px]:px-4"
          onClick={ouvrir}
        >
          {t("intervention.action.cloturer")}
        </Button>
      )}
      titre={
        <>
          {t("intervention.action.cloturer")} {reference}
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
            {t("intervention.cloture.temps_valide_saisie")}
            <input
              name="temps_valide_min"
              type="number"
              defaultValue={
                tempsMesureMin === null ? undefined : String(tempsMesureMin)
              }
              className={CLASSES_CHAMP}
            />
          </label>
          <p className="text-app-encre-faible text-12 font-bold">
            {explicationRegle(regle)}
          </p>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("intervention.cloture.aide_figee")}
          </p>
          {unSegmentHorsReseau ? (
            <p className="text-app-encre-faible text-12 font-bold">
              {t("intervention.cloture.avertissement_hors_reseau")}
            </p>
          ) : null}
          {verdict.refuse ? (
            <p className="text-app-rouge-encre text-13 font-bold">
              {verdict.raison}
            </p>
          ) : null}
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <Button
            type="submit"
            form={idFormulaire}
            size="sm"
            disabled={verdict.refuse}
          >
            {t("intervention.action.cloturer")}
          </Button>
        </>
      )}
    />
  );
}
