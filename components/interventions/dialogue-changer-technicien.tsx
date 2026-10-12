"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { useFermerMenuPlus } from "@/components/ui/menu-plus";
import { t } from "@/lib/i18n/fr";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « CHANGER DE TECHNICIEN » DU MENU « ⋯ » (9ES-TP-UX4-3-FICHE-
 * GESTES-2, D195) — « Affecter » n'existe pas dans la maquette ; le glossaire
 * (« Mettre un autre technicien sur une intervention » → « Changer de
 * technicien », jamais « réaffecter ») donne le mot de cette entrée, qui
 * ouvre le formulaire `affecter` ACTUEL (même route) — un seul champ, celui
 * qui fuyait (D120 : jamais pré-rempli sans pouvoir le changer).
 *
 * **L'entrée reste TOUJOURS visible, même sans la capacité** — contrairement
 * au régime D131 (capacité absente = bloc entier masqué) qu'applique
 * `DialogueSuspendre`/`DialogueCloturer` : l'ancien bloc « Affecter » de la
 * carte Actions montrait, lui, son refus À LA PLACE du champ pour CE refus
 * précis (`intervention.refus.qualification_requise`), comme « Transmettre »
 * le fait encore. Masquer l'entrée aurait changé ce régime sans que le
 * ticket ne le demande.
 */
export function DialogueChangerTechnicien({
  reference,
  action,
  options,
  libelleOptionVide,
  valeurParDefaut,
  verdict,
}: Readonly<{
  readonly reference: string;
  readonly action: string;
  readonly options: readonly {
    readonly valeur: string;
    readonly libelle: string;
    readonly bloque?: boolean;
  }[];
  readonly libelleOptionVide: string;
  readonly valeurParDefaut?: string;
  readonly verdict: { readonly refuse: boolean; readonly raison: string };
}>) {
  const idFormulaire = useId();
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
          {t("intervention.action.changer_technicien")}
        </button>
      )}
      titre={
        <>
          {t("intervention.action.changer_technicien")}
          {t("ponctuation.separateur")}
          {reference}
        </>
      }
      enfants={() =>
        verdict.refuse ? (
          <p className="text-app-rouge-encre text-13 font-bold">
            {verdict.raison}
          </p>
        ) : (
          <form
            id={idFormulaire}
            action={action}
            method="post"
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("intervention.technicien")}
              <select
                name="technicien_id"
                defaultValue={valeurParDefaut ?? ""}
                className={CLASSES_CHAMP}
              >
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
          </form>
        )
      }
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          {verdict.refuse ? null : (
            <Button type="submit" form={idFormulaire} size="sm">
              {t("intervention.action.changer_technicien")}
            </Button>
          )}
        </>
      )}
    />
  );
}
