"use client";

import { useState } from "react";
import Link from "next/link";

import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Champ } from "@/components/ui/champ";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Volet } from "@/components/ui/volet";
import { t } from "@/lib/i18n/fr";
import type { GabaritDeDepart } from "@/lib/checklists/gabarits-de-depart";
import {
  TYPES_INTERVENTION,
  type TypeIntervention,
} from "@/lib/interventions/saisie";
import type {
  LigneFamille,
  LigneModele,
  LigneSousType,
} from "@/lib/materiel/depot";
import { ChampsRattachement } from "./champs-rattachement";

/**
 * « PARTIR D'UN GABARIT DE DÉPART » (9K20-CHECKLIST-DUPLIQUER-DEPART, étendu
 * au 9K30A-CHECKLIST-GABARITS-VALIDES) — "use client" pour la SEULE raison
 * qui l'exige : le choix du gabarit doit RECOCHER les types suggérés et
 * RAFRAÎCHIR le texte de rattachement suggéré SANS recharger la page. Code
 * et libellé restent un formulaire HTML ordinaire, posté normalement — rien
 * d'autre n'a besoin de JavaScript ici.
 *
 * Les cases à cocher restent MODIFIABLES après leur pré-cochage : la
 * suggestion ne contraint jamais la société (voir le docblock de
 * `lib/checklists/gabarits-de-depart.ts`).
 *
 * RATTACHEMENT (9L04B-GABARIT-RATTACHEMENT) — le texte de suggestion reste un
 * texte libre, jamais un identifiant (un sous-type ou une famille n'existe
 * que dans le périmètre d'une société) : `ChampsRattachement`, le MÊME
 * composant que la création et la duplication, n'est donc JAMAIS
 * pré-sélectionné depuis ce texte — l'administrateur choisit lui-même parmi
 * les sous-types/familles/modèles de sa société, ou laisse vide (générique).
 */
export function VoletPartirGabarit({
  gabarits,
  sousTypes,
  familles,
  machinesModeles,
}: {
  readonly gabarits: readonly GabaritDeDepart[];
  readonly sousTypes: readonly LigneSousType[];
  readonly familles: readonly LigneFamille[];
  readonly machinesModeles: readonly LigneModele[];
}) {
  const premier = gabarits[0];
  const [gabaritId, setGabaritId] = useState(premier?.id);
  const gabarit = gabarits.find((candidat) => candidat.id === gabaritId);

  return (
    <Volet
      surtitre={t("checklist.parametrage.titre")}
      titre={t("checklist.parametrage.partir_gabarit")}
      hrefFermer="/parametres/checklists"
    >
      <form
        action="/api/parametres/checklists/gabarit"
        method="post"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="gabarit_id"
            className="text-app-encre-faible text-12 font-bold"
          >
            {t("checklist.parametrage.gabarit")}
          </label>
          <select
            id="gabarit_id"
            name="gabarit_id"
            value={gabaritId}
            onChange={(evenement) => setGabaritId(evenement.target.value)}
            className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
          >
            {gabarits.map((candidat) => (
              <option key={candidat.id} value={candidat.id}>
                {candidat.libelle}
              </option>
            ))}
          </select>
        </div>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.rattachement_suggere_prefixe")}
          {t("ponctuation.deux_points")}
          {gabarit?.rattachementSuggere ??
            t("checklist.parametrage.rattachement_suggere_aucun")}
        </p>
        <Champ id="code" nom="code" libelle={t("checklist.parametrage.code")} />
        <Champ
          id="libelle"
          nom="libelle"
          libelle={t("checklist.parametrage.libelle")}
          large
        />
        <fieldset key={gabaritId} className="flex basis-full flex-col gap-1">
          <legend className="text-app-encre-faible text-12 font-bold">
            {t("checklist.parametrage.types_intervention")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {TYPES_INTERVENTION.map((type: TypeIntervention) => (
              <CaseACocher
                key={type}
                name="types_intervention"
                value={type}
                defaultChecked={gabarit?.typesSuggeres.includes(type) ?? false}
                libelle={t(`type_intervention.${type}`)}
                className="flex items-center gap-1.5 text-13 font-bold"
              />
            ))}
          </div>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("checklist.parametrage.types_intervention_indice")}
          </p>
        </fieldset>
        <ChampsRattachement
          sousTypes={sousTypes}
          familles={familles}
          machinesModeles={machinesModeles}
        />
        <div className="flex justify-end gap-2">
          <Link
            href="/parametres/checklists"
            className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("checklist.parametrage.annuler")}
          </Link>
          <ActionPrimaire>
            {t("checklist.parametrage.partir_gabarit_action")}
          </ActionPrimaire>
        </div>
      </form>
    </Volet>
  );
}
