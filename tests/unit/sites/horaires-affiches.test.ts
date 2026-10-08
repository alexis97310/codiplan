import { describe, expect, it } from "vitest";

import { horairesAffiches } from "../../../app/(back-office)/sites/presentation";

import { t } from "@/lib/i18n/fr";

/**
 * LES HORAIRES D'ACCÈS, AFFICHÉS (9EE-TP-UX4-1-FICHE-INTERVENTION-2, carte
 * « Sur place ») — `null` et `[]` ne disent pas la même chose (voir
 * `lib/sites/saisie.ts`), et une forme inattendue ne fait jamais tomber la
 * fiche.
 */
describe("horairesAffiches", () => {
  it("null (rien renseigné) → null", () => {
    expect(horairesAffiches(null)).toBeNull();
  });

  it("[] (renseigné comme fermé) → une liste vide, distincte de null", () => {
    expect(horairesAffiches([])).toEqual([]);
  });

  it("une forme inattendue → null, jamais une exception", () => {
    expect(horairesAffiches("pas un tableau")).toBeNull();
    expect(horairesAffiches([{ jour_semaine: 1 }])).toBeNull();
    expect(
      horairesAffiches([
        { jour_semaine: 8, debut_minutes: 360, fin_minutes: 840 },
      ]),
    ).toBeNull();
  });

  it("une seule plage → un jour, une heure", () => {
    expect(
      horairesAffiches([
        { jour_semaine: 1, debut_minutes: 360, fin_minutes: 840 },
      ]),
    ).toEqual([
      {
        jours: t("intervention.resume.jour_abrege.lundi"),
        heures: "06:00–14:00",
      },
    ]);
  });

  it("des jours consécutifs aux mêmes heures se regroupent", () => {
    expect(
      horairesAffiches([
        { jour_semaine: 1, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 2, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 3, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 4, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 5, debut_minutes: 360, fin_minutes: 840 },
      ]),
    ).toEqual([
      {
        jours: `${t("intervention.resume.jour_abrege.lundi")}–${t(
          "intervention.resume.jour_abrege.vendredi",
        )}`,
        heures: "06:00–14:00",
      },
    ]);
  });

  it("des jours non consécutifs, ou à des heures différentes, restent séparés", () => {
    expect(
      horairesAffiches([
        { jour_semaine: 1, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 3, debut_minutes: 360, fin_minutes: 840 },
        { jour_semaine: 6, debut_minutes: 480, fin_minutes: 720 },
      ]),
    ).toEqual([
      {
        jours: t("intervention.resume.jour_abrege.lundi"),
        heures: "06:00–14:00",
      },
      {
        jours: t("intervention.resume.jour_abrege.mercredi"),
        heures: "06:00–14:00",
      },
      {
        jours: t("intervention.resume.jour_abrege.samedi"),
        heures: "08:00–12:00",
      },
    ]);
  });
});
