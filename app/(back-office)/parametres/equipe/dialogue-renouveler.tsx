"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import type { JourLocal } from "@/lib/calendar/fuseau";
import type { LigneAttribution } from "@/lib/habilitations/depot";
import { t } from "@/lib/i18n/fr";

import {
  estExpiree,
  libelleRenouvelerHabilitation,
  titreDialogueRenouveler,
} from "./presentation";

/**
 * « RENOUVELER <CODE> » — une habilitation EXPIRÉE, dans le tableau et les
 * cartes de l'onglet Techniciens (point 3, 9EY-EQUIPE-ALERTE-TOUT-ENVOYER ;
 * maquette `habCell`, `maquette-toutes-pages.html:4627`).
 *
 * Un lien-bouton PAR habilitation expirée — jamais un geste groupé : chaque
 * attribution porte ses propres dates, qui ne se renouvellent pas ensemble.
 * Rendue deux fois dans le DOM (tableau ET carte, même piège déjà noté pour
 * `GesteAccesTechnicien`) — seule la largeur d'écran décide laquelle des deux
 * se voit (CSS), jamais ce composant.
 */
export function BoutonsRenouvelerExpirees({
  attributions,
  technicienNom,
  aujourdHui,
}: Readonly<{
  readonly attributions: readonly LigneAttribution[];
  readonly technicienNom: string;
  readonly aujourdHui: JourLocal;
}>) {
  const expirees = attributions.filter((attribution) =>
    estExpiree(attribution, aujourdHui),
  );
  if (expirees.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {expirees.map((attribution) => (
        <BoutonRenouveler
          key={attribution.id}
          attribution={attribution}
          technicienNom={technicienNom}
        />
      ))}
    </div>
  );
}

function BoutonRenouveler({
  attribution,
  technicienNom,
}: Readonly<{
  readonly attribution: LigneAttribution;
  readonly technicienNom: string;
}>) {
  const idFormulaire = useId();
  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <button
          type="button"
          onClick={ouvrir}
          className="text-app-marque text-[12px] font-bold underline"
        >
          {libelleRenouvelerHabilitation(attribution.code)}
        </button>
      )}
      titre={titreDialogueRenouveler(attribution.code, technicienNom)}
      enfants={() => (
        <form
          id={idFormulaire}
          action={`/api/habilitations/attributions/${attribution.id}/renouveler`}
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${attribution.id}-obtention`}
              className="text-app-encre-faible text-12 font-bold"
            >
              {t("habilitations.dialogue.renouveler.obtenue_le")}
            </label>
            <input
              id={`${attribution.id}-obtention`}
              name="date_obtention"
              type="date"
              required
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${attribution.id}-expiration`}
              className="text-app-encre-faible text-12 font-bold"
            >
              {t("habilitations.dialogue.renouveler.expire_le")}
            </label>
            <input
              id={`${attribution.id}-expiration`}
              name="date_expiration"
              type="date"
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
            />
          </div>
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("equipe.volet.annuler")}
          </Button>
          <Button type="submit" form={idFormulaire} variant="default" size="sm">
            {t("habilitations.enregistrer")}
          </Button>
        </>
      )}
    />
  );
}
