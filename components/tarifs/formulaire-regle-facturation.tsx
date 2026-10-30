"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { enDuree } from "@/lib/calendar/duree";
import { t } from "@/lib/i18n/fr";
import {
  arrondirSelonRegle,
  type RegleArrondi,
} from "@/lib/tarification/valorisation";

/**
 * L'EXEMPLE CITÉ PAR ALEXIS (9I8A1-REPRISE-9I8A, 29/10/2026) — 1 h 05, qui
 * facture 1 h 30 avec la règle 60/30/5. Fixe : c'est la valeur que
 * l'exploitation reconnaît, pas un cas quelconque.
 */
const EXEMPLE_MINUTES_REELLES = 65;

/**
 * LE RÉSULTAT DE L'EXEMPLE, PAR LA MÊME FORMULE QUE LA CLÔTURE —
 * `arrondirSelonRegle` est une fonction PURE de `lib/tarification/
 * valorisation.ts`, la même que le serveur appelle : un exemple qui
 * recalculerait sa propre formule divergerait en silence le jour où l'une
 * des deux change (§9, 01/09). `null` quand le réglage saisi est hors bornes
 * (le seuil doit être dans `[1, palier]`) : un exemple qui afficherait un
 * nombre sur un réglage que la base refuserait mentirait.
 */
function minutesFactureesExemple(regle: RegleArrondi): number | null {
  if (
    regle.palierMinutes < 1 ||
    regle.seuilPalierMinutes < 1 ||
    regle.seuilPalierMinutes > regle.palierMinutes ||
    regle.plancherMinutes < 0
  ) {
    return null;
  }
  return Math.max(
    arrondirSelonRegle(EXEMPLE_MINUTES_REELLES, regle),
    regle.plancherMinutes,
  );
}

const CLASSE_CHAMP =
  "border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold";
const CLASSE_ETIQUETTE = "flex flex-col gap-1 text-13 font-bold";

/**
 * LE FORMULAIRE DU RÉGLAGE DE SOCIÉTÉ (9I8A1-REPRISE-9I8A, décision
 * d'Alexis du 29/10/2026, confirmée « par société ») — trois entiers, et un
 * exemple qui se recalcule EN DIRECT (composant CLIENT, `useState`) à chaque
 * frappe, avant tout envoi au serveur. La route qui reçoit ce formulaire
 * revalide les mêmes bornes (`schemaRegleArrondi`,
 * `app/api/parametres/tarifs/regle-facturation/route.ts`) : ce composant
 * n'est qu'un aperçu, jamais la seule garde.
 */
export function FormulaireRegleFacturation({
  action,
  regle,
}: Readonly<{
  readonly action: string;
  readonly regle: RegleArrondi;
}>) {
  const idFormulaire = useId();
  const [plancher, setPlancher] = useState(regle.plancherMinutes);
  const [palier, setPalier] = useState(regle.palierMinutes);
  const [seuil, setSeuil] = useState(regle.seuilPalierMinutes);

  const resultat = minutesFactureesExemple({
    plancherMinutes: plancher,
    palierMinutes: palier,
    seuilPalierMinutes: seuil,
  });

  return (
    <form
      id={idFormulaire}
      method="post"
      action={action}
      className="flex flex-col gap-3 px-4 py-4"
    >
      <p className="text-app-encre-faible text-12 font-bold">
        {t("tarifs.regle_facturation.aide")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={CLASSE_ETIQUETTE}>
          {t("tarifs.regle_facturation.champ_plancher")}
          <input
            name="plancher_min"
            type="number"
            min={0}
            max={240}
            step={1}
            required
            value={plancher}
            onChange={(e) => setPlancher(Number(e.target.value))}
            className={CLASSE_CHAMP}
          />
        </label>
        <label className={CLASSE_ETIQUETTE}>
          {t("tarifs.regle_facturation.champ_palier")}
          <input
            name="palier_min"
            type="number"
            min={1}
            max={120}
            step={1}
            required
            value={palier}
            onChange={(e) => setPalier(Number(e.target.value))}
            className={CLASSE_CHAMP}
          />
        </label>
        <label className={CLASSE_ETIQUETTE}>
          {t("tarifs.regle_facturation.champ_seuil")}
          <input
            name="seuil_palier_min"
            type="number"
            min={1}
            max={120}
            step={1}
            required
            value={seuil}
            onChange={(e) => setSeuil(Number(e.target.value))}
            className={CLASSE_CHAMP}
          />
        </label>
      </div>
      <p className="text-13 font-bold">
        {t("tarifs.regle_facturation.exemple_titre")}
        {t("ponctuation.deux_points")}
        {enDuree(EXEMPLE_MINUTES_REELLES)}
        {resultat === null ? (
          <span className="text-app-oxyde">
            {t("ponctuation.fleche")}
            {t("tarifs.regle_facturation.exemple_invalide")}
          </span>
        ) : (
          <>
            {t("ponctuation.fleche")}
            {enDuree(resultat)}
          </>
        )}
      </p>
      <p className="text-app-encre-faible text-12 font-bold">
        {t("tarifs.regle_facturation.non_retroactive")}
      </p>
      <Button
        type="submit"
        variant="default"
        size="sm"
        className="self-start"
        disabled={resultat === null}
      >
        {t("tarifs.regle_facturation.enregistrer")}
      </Button>
    </form>
  );
}
