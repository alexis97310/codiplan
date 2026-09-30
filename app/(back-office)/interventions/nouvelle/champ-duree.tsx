"use client";

import { useState } from "react";

import { t } from "@/lib/i18n/fr";

/**
 * LA DURÉE PRÉVUE, À LA CRÉATION (PG-B6-DUREE-A-LA-CREATION, audit du
 * 27/09/2026 §4.3 ; décision QG-12 d'Alexis : des choix rapides, AUCUNE
 * VALEUR PAR DÉFAUT).
 *
 * MÊMES PUCES QUE `FenetrePose` (`planning.pose.duree_*`) — la même durée se
 * lit pareil aux deux endroits, et deux lectures d'un même critère divergent
 * en silence (§9, 01/09). **Rien n'est coché par défaut** : `dureeMin`
 * démarre à `valeurInitiale` (reprise après un refus de saisie,
 * 56-FORMULAIRES-2) ou à `null`, jamais à la première puce.
 *
 * UN SEUL CHAMP SOUMIS, `duree_min` — un `<input type="hidden">` porte la
 * valeur choisie parmi les puces ; l'entrée « Autre » PREND SA PLACE (même
 * `name`) le temps qu'elle est active, pour qu'une seule valeur ne soit
 * jamais soumise deux fois sous le même nom.
 *
 * Elle ne pose ni date, ni heure, ni technicien (PARCOURS-1) : c'est
 * `schemaCreation.duree_min` qui l'écrit seule dans `duree_estimee_min`
 * (`creerIntervention`, `lib/interventions/depot.ts`).
 */
const DUREES_PROPOSEES = [30, 60, 90, 120, 180, 240] as const;

export function ChampDureePrevue({
  valeurInitiale = null,
}: Readonly<{
  /** Reprise après un refus de saisie (56-FORMULAIRES-2) — prime sur `null`. */
  valeurInitiale?: number | null;
}>) {
  const dureeConnue =
    valeurInitiale !== null &&
    (DUREES_PROPOSEES as readonly number[]).includes(valeurInitiale);
  const [dureeMin, setDureeMin] = useState<number | null>(valeurInitiale);
  const [autreActive, setAutreActive] = useState(
    valeurInitiale !== null && !dureeConnue,
  );
  const [autreTexte, setAutreTexte] = useState(
    valeurInitiale !== null && !dureeConnue ? String(valeurInitiale) : "",
  );

  function choisir(valeur: number) {
    setAutreActive(false);
    setDureeMin(valeur);
  }

  function choisirAutre(texte: string) {
    setAutreTexte(texte);
    const valeur = Number.parseInt(texte, 10);
    setDureeMin(Number.isFinite(valeur) && valeur > 0 ? valeur : null);
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">
        {t("intervention.creation.duree_prevue")}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {DUREES_PROPOSEES.map((valeur) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={!autreActive && dureeMin === valeur}
            onClick={() => choisir(valeur)}
            className={`min-h-11 rounded-md border px-2.5 text-13 font-semibold sm:min-h-0 sm:py-1 ${
              !autreActive && dureeMin === valeur
                ? "bg-app-marque text-app-marque-encre border-app-marque"
                : "border-app-bord"
            }`}
          >
            {t(`planning.pose.duree_${valeur}` as "planning.pose.duree_30")}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={autreActive}
          onClick={() => {
            setAutreActive(true);
            choisirAutre(autreTexte);
          }}
          className={`min-h-11 rounded-md border px-2.5 text-13 font-semibold sm:min-h-0 sm:py-1 ${
            autreActive
              ? "bg-app-marque text-app-marque-encre border-app-marque"
              : "border-app-bord"
          }`}
        >
          {t("planning.pose.duree_autre")}
        </button>
      </div>
      {autreActive ? (
        <input
          type="number"
          name="duree_min"
          min={1}
          inputMode="numeric"
          aria-label={t("planning.pose.duree_autre_libelle")}
          value={autreTexte}
          onChange={(evenement) => choisirAutre(evenement.target.value)}
          className="border-app-bord mt-1 w-28 rounded-md border px-2 py-1.5 text-13"
        />
      ) : (
        <input type="hidden" name="duree_min" value={dureeMin ?? ""} />
      )}
    </fieldset>
  );
}
