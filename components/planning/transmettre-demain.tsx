"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { CLASSES_FEUILLE_BASSE } from "@/components/ui/feuille-basse";
import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

import {
  texteCaseIntervention,
  texteLigneLaissee,
} from "@/app/(back-office)/planning/presentation";

/**
 * LE DIALOGUE « TRANSMETTRE DEMAIN » (QG-5, D141, spécification §3.13,
 * 9CP-PG-G14B-TRANSMETTRE-GROUPE) — `<dialog>` natif, même patron que
 * `components/ui/bouton-confirmation.tsx` et `components/planning/tiroir.tsx`.
 * Depuis 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE, feuille basse au téléphone,
 * centré au-dessus de 901 px — `CLASSES_FEUILLE_BASSE`
 * (`components/ui/feuille-basse.tsx`), partagée avec `bouton-confirmation.tsx`.
 *
 * **AUCUNE case n'est cochée d'avance** (choix du pilote, voir la passation) :
 * la liste se déplie, groupée par technicien, et « Tout cocher » n'agit que
 * sur SON groupe — jamais sur les autres, et jamais tout seul à l'ouverture.
 *
 * **Un POST natif vers `/api/interventions/transmettre`** — pas de JSON, pas
 * d'interception : la page `/planning` se recharge après soumission, avec le
 * compte-rendu porté par l'URL (nombres et clés fermées, jamais du texte).
 */

export type InterventionPreteAffichee = {
  readonly id: string;
  readonly reference: string;
  readonly heure: string | null;
  readonly client: string;
  readonly site: string;
};

export type GroupeTechnicienATransmettre = {
  readonly technicienId: string;
  readonly technicienNom: string;
  readonly interventions: readonly InterventionPreteAffichee[];
};

export type LigneLaisseeAffichee = {
  readonly id: string;
  readonly reference: string;
  readonly client: string;
  readonly site: string;
  readonly motifsLibelles: readonly string[];
};

export function DialogueTransmettreDemain({
  libelleBouton,
  titre,
  groupes,
  laissees,
}: Readonly<{
  libelleBouton: string;
  /** Composé par `titreDialogueTransmettreDemain` (`../../app/(back-office)/planning/presentation.ts`), jamais ici (L0-11). */
  titre: string;
  groupes: readonly GroupeTechnicienATransmettre[];
  laissees: readonly LigneLaisseeAffichee[];
}>) {
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const dialogue = dialogueRef.current;
    if (dialogue === null) {
      return;
    }
    if (ouvert) {
      dialogue.showModal();
    } else if (dialogue.open) {
      dialogue.close();
    }
  }, [ouvert]);

  function toutCocher(technicienId: string): void {
    const fieldset = dialogueRef.current?.querySelector(
      `fieldset[data-groupe="${technicienId}"]`,
    );
    fieldset
      ?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((case_) => {
        case_.checked = true;
      });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOuvert(true)}
      >
        {libelleBouton}
      </Button>
      <dialog
        ref={dialogueRef}
        onClose={() => setOuvert(false)}
        className={cn(
          CLASSES_FEUILLE_BASSE,
          "bg-app-surface border-app-bord min-[901px]:max-w-lg",
        )}
      >
        <form method="POST" action="/api/interventions/transmettre">
          <h2 className="text-[14px] font-bold">{titre}</h2>
          <div className="mt-3 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {groupes.map((groupe) => (
              <fieldset
                key={groupe.technicienId}
                data-groupe={groupe.technicienId}
                className="border-app-bord rounded-md border p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <legend className="text-13 font-bold">
                    {groupe.technicienNom}
                  </legend>
                  <button
                    type="button"
                    onClick={() => toutCocher(groupe.technicienId)}
                    className="text-app-encre-faible text-12 font-bold underline"
                  >
                    {t("planning.transmettre_demain.tout_cocher")}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {groupe.interventions.map((intervention) => (
                    <CaseACocher
                      key={intervention.id}
                      name="id"
                      value={intervention.id}
                      libelle={texteCaseIntervention(intervention)}
                      className="flex items-center gap-2 text-13 font-bold"
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {laissees.length === 0 ? null : (
            <div className="border-app-bord mt-3 border-t pt-2.5">
              <p className="text-12 font-bold">
                {t("planning.transmission.laissees_titre")}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {laissees.map((ligne) => (
                  <li
                    key={ligne.id}
                    className="text-app-encre-faible text-12 font-bold"
                  >
                    <a
                      href={`/interventions/${ligne.id}`}
                      className="text-app-encre font-bold underline"
                    >
                      {ligne.reference}
                    </a>{" "}
                    {texteLigneLaissee(ligne)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOuvert(false)}
            >
              {t("planning.transmettre_demain.fermer")}
            </Button>
            <Button type="submit" variant="default" size="sm">
              {t("planning.transmettre_demain.transmettre_la_selection")}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
