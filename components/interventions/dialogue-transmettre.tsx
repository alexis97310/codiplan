"use client";

import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";

/**
 * LE DIALOGUE « TRANSMETTRE À <TECHNICIEN> ? » (9ES-TP-UX4-3-FICHE-GESTES-2,
 * D195) — `form#action-transmettre` ACTUEL : un simple POST, plus la seule
 * case de confirmation D123 (voir ci-dessous). Le bouton reste visible même
 * refusé (date/heure/durée/technicien manquants), son motif s'affichant alors
 * À CÔTÉ, comme `DialogueCloturer` le fait déjà.
 */
export function DialogueTransmettre({
  client,
  creneau,
  technicien,
  action,
  verdict,
}: Readonly<{
  readonly client: string;
  readonly creneau: string;
  readonly technicien: string;
  readonly action: string;
  readonly verdict: { readonly refuse: boolean; readonly raison: string };
}>) {
  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button type="button" size="sm" onClick={ouvrir}>
          {t("intervention.action.transmettre")}
        </Button>
      )}
      titre={
        <>
          {t("intervention.transmission.verbe")}
          {t("ponctuation.a")}
          {technicien}
          {t("intervention.transmission.titre_suffixe")}
        </>
      }
      enfants={() => (
        <div className="flex flex-col gap-3">
          <p className="text-13 font-bold">
            {client}
            {t("ponctuation.point_median")}
            {creneau}
          </p>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("intervention.transmission.apparait_telephone")}
          </p>
          {verdict.refuse ? (
            <p className="text-app-rouge-encre text-13 font-bold">
              {verdict.raison}
            </p>
          ) : null}
        </div>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <form
            action={action}
            method="post"
            className="flex items-center gap-3"
          >
            {/*
              LA CONFIRMATION D'UNE DATE PASSÉE (D123 d'Alexis, 19/10/2026) —
              toujours présente, jamais conditionnée à un verdict lu avant
              soumission : un formulaire plein-page, sans JS, ne peut pas
              faire apparaître la case seulement quand elle sert. Même garde
              que `DialoguePlanifier`/`DialogueDeplacer`.
            */}
            <CaseACocher
              name="confirmer_date_passee"
              value="1"
              libelle={t("intervention.confirmer_date_passee")}
              className="flex items-center gap-2 text-12 font-bold"
            />
            <Button type="submit" size="sm" disabled={verdict.refuse}>
              {t("intervention.action.transmettre")}
            </Button>
          </form>
        </>
      )}
    />
  );
}
