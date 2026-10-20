"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Dialogue } from "@/components/ui/dialogue";
import { t } from "@/lib/i18n/fr";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * LE DIALOGUE « DÉPLACER — <CLIENT> » (9ES-TP-UX4-3-FICHE-GESTES-2, D195) —
 * contenu ACTUEL du bloc « Déplacer » de la carte Actions (R2-19 : même
 * route, même décision que le glisser-déposer du planning), avec
 * `TrouverCreneau` (inchangé) en raccourci au-dessus du formulaire.
 */
export function DialogueDeplacer({
  client,
  action,
  note,
  dateInitiale,
  heureInitiale,
  dureeInitiale,
  technicien,
  trouverCreneau,
  disponibilite,
}: Readonly<{
  readonly client: string;
  readonly action: string;
  readonly note: string;
  readonly dateInitiale?: string;
  readonly heureInitiale?: string;
  readonly dureeInitiale?: string;
  readonly technicien?: {
    readonly options: readonly {
      readonly valeur: string;
      readonly libelle: string;
      readonly bloque?: boolean;
    }[];
    readonly libelleOptionVide: string;
    readonly valeurParDefaut?: string;
  };
  readonly trouverCreneau: ReactNode;
  readonly disponibilite?: ReactNode;
}>) {
  const idFormulaire = useId();

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button type="button" variant="outline" size="sm" onClick={ouvrir}>
          {t("intervention.action.deplacer")}
        </Button>
      )}
      titre={
        <>
          {t("intervention.action.deplacer")}
          {t("ponctuation.separateur")}
          {client}
        </>
      }
      enfants={() => (
        <>
          {trouverCreneau}
          <form
            id={idFormulaire}
            action={action}
            method="post"
            className="mt-3 flex flex-col gap-3"
          >
            <p className="text-app-encre-faible text-12 font-bold">{note}</p>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("intervention.date")}
              <input
                name="date_planifiee"
                type="date"
                defaultValue={dateInitiale}
                className={CLASSES_CHAMP}
              />
            </label>
            {disponibilite}
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("intervention.deplacement.heure")}
              <input
                name="heure_debut"
                type="time"
                defaultValue={heureInitiale}
                className={CLASSES_CHAMP}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("intervention.deplacement.duree")}
              <input
                name="duree_min"
                type="number"
                min={1}
                defaultValue={dureeInitiale}
                className={CLASSES_CHAMP}
              />
            </label>
            <p className="text-app-encre-faible text-12 font-bold">
              {t("intervention.deplacement.vider_pour_la_file")}
            </p>
            {technicien === undefined ? null : (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("intervention.technicien")}
                <select
                  name="technicien_id"
                  defaultValue={technicien.valeurParDefaut ?? ""}
                  className={CLASSES_CHAMP}
                >
                  <option value="">{technicien.libelleOptionVide}</option>
                  {technicien.options.map((option) => (
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
            )}
            {/*
              LA CONFIRMATION D'UNE POSE HORS OUVERTURE (D93 d'Alexis,
              13/10/2026) — même garde que `DialoguePlanifier` : toujours
              présente, sans effet si la pose reste dans l'ouverture.
            */}
            <CaseACocher
              name="confirmer_hors_ouverture"
              value="1"
              libelle={t("intervention.confirmer_hors_ouverture")}
              className="flex items-center gap-2 text-sm font-medium"
            />
            {/*
              LA CONFIRMATION D'UNE DATE PASSÉE (D123 d'Alexis, 19/10/2026) —
              même garde que `DialoguePlanifier` : toujours présente, sans
              effet sur une date d'aujourd'hui ou future.
            */}
            <CaseACocher
              name="confirmer_date_passee"
              value="1"
              libelle={t("intervention.confirmer_date_passee")}
              className="flex items-center gap-2 text-sm font-medium"
            />
          </form>
        </>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <Button type="submit" form={idFormulaire} size="sm">
            {t("intervention.action.deplacer")}
          </Button>
        </>
      )}
    />
  );
}
