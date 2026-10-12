"use client";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";

/**
 * LE DIALOGUE « TRANSMETTRE À <TECHNICIEN> ? » (9ES-TP-UX4-3-FICHE-GESTES-2,
 * D195) — `form#action-transmettre` ACTUEL : sans champ, un simple POST. Le
 * bouton reste visible même refusé (date/heure/durée/technicien manquants),
 * son motif s'affichant alors À CÔTÉ, comme `DialogueCloturer` le fait déjà.
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
          <form action={action} method="post">
            <Button type="submit" size="sm" disabled={verdict.refuse}>
              {t("intervention.action.transmettre")}
            </Button>
          </form>
        </>
      )}
    />
  );
}
