import { describe, expect, it } from "vitest";

import { trajetAffiche } from "@/app/(back-office)/sites/presentation";
import { enDuree } from "@/lib/calendar/duree";
import { t } from "@/lib/i18n/fr";

/**
 * 9AH-GR14-PRESTATIONS-SITES — le compteur de trajet de la carte
 * (`/sites`) s'écrit en heures (`enDuree`), plus jamais en minutes brutes
 * (audit GR du 26/09/2026, constat G17).
 */
describe("trajetAffiche", () => {
  it("rend la valeur mesurée en heures, sous le libellé de mesure", () => {
    expect(trajetAffiche({ minutes: 90, origine: "site" })).toEqual({
      valeur: enDuree(90),
      libelle: t("sites.colonne_trajet"),
      ton: "gris",
    });
  });

  it("rend une estimation en heures, sous le libellé d'estimation", () => {
    expect(trajetAffiche({ minutes: 90, origine: "defaut" })).toEqual({
      valeur: enDuree(90),
      libelle: t("sites.colonne_trajet_estimation"),
      ton: "gris",
    });
  });

  it("rend un tiret quand aucune valeur n'existe", () => {
    const resultat = trajetAffiche({ minutes: null, motif: "sans_zone" });
    expect(resultat.libelle).toBe(t("sites.colonne_trajet"));
    expect(resultat.valeur).not.toBe("");
  });
});
