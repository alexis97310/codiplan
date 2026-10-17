import { afterEach, describe, expect, it, vi } from "vitest";

import { jourDe, maintenant, type JourLocal } from "@/lib/calendar/fuseau";
import { jourCivilDeDatePlanifiee } from "@/lib/interventions/retard";
import { repartirJourneeTechnicien } from "@/lib/interventions/journee-technicien";

/**
 * 9F2B-TERRAIN-JOURS-EPREUVES, point 4 — LA BASCULE DE JOUR NOUMÉA/UTC.
 *
 * Nouméa est UTC+11 sans changement d'heure (I7, `CLAUDE.md` §1) : son jour
 * civil prend un jour d'avance sur le jour civil UTC entre 13:00 UTC et
 * 00:00 UTC. `tests/unit/interventions/journee-technicien.test.ts` reçoit
 * déjà `aujourdHui` CALCULÉ — il ne peut pas voir si CE calcul-là, fait par
 * `maintenant` puis `jourDe`, place la bascule au bon instant. Horloge
 * FIGÉE (`vi.setSystemTime`) : sans elle, ce fichier dépendrait de l'heure
 * de son propre lancement.
 */

const FUSEAU_NC = "Pacific/Noumea";

afterEach(() => {
  vi.useRealTimers();
});

describe("maintenant + jourDe — la bascule à Nouméa tombe à 13:00 UTC, jamais à minuit", () => {
  it("12:59:59 UTC est encore le jour civil UTC — veille de la bascule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:59:59.000Z"));
    const aujourdHui = jourDe(maintenant(FUSEAU_NC).local);
    expect(aujourdHui).toEqual({ annee: 2026, mois: 10, jour: 16 });
  });

  it("13:00:00 UTC bascule sur le jour civil suivant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T13:00:00.000Z"));
    const aujourdHui = jourDe(maintenant(FUSEAU_NC).local);
    expect(aujourdHui).toEqual({ annee: 2026, mois: 10, jour: 17 });
  });

  it("23:59:59 UTC reste le même jour civil que 13:00:00 UTC — pas de seconde bascule à minuit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T23:59:59.000Z"));
    const aujourdHui = jourDe(maintenant(FUSEAU_NC).local);
    expect(aujourdHui).toEqual({ annee: 2026, mois: 10, jour: 17 });
  });
});

describe("repartirJourneeTechnicien — la fenêtre suit la bascule, borne J+8 exclusive", () => {
  function ligneA(jourLocal: JourLocal): {
    readonly id: string;
    readonly date_planifiee: Date;
  } {
    return {
      id: `ligne-${jourLocal.annee}-${jourLocal.mois}-${jourLocal.jour}`,
      date_planifiee: new Date(
        Date.UTC(jourLocal.annee, jourLocal.mois - 1, jourLocal.jour),
      ),
    };
  }

  it("à 12:59:59 UTC (jour civil 16), une ligne du 23 (J+7) entre, une du 24 (J+8) reste hors fenêtre", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:59:59.000Z"));
    const aujourdHui = jourDe(maintenant(FUSEAU_NC).local);

    const jPlus7 = jourCivilDeDatePlanifiee(
      new Date("2026-10-23T00:00:00.000Z"),
    );
    const jPlus8 = jourCivilDeDatePlanifiee(
      new Date("2026-10-24T00:00:00.000Z"),
    );

    const resultat = repartirJourneeTechnicien(
      [ligneA(jPlus7), ligneA(jPlus8)],
      [],
      aujourdHui,
    );
    expect(resultat.suite.dates).toEqual([jPlus7]);
    expect(resultat.suite.nombre).toBe(1);
  });

  it("à 13:00:00 UTC (jour civil 17, un jour d'avance), la même ligne du 24 devient le J+7 qui entre", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T13:00:00.000Z"));
    const aujourdHui = jourDe(maintenant(FUSEAU_NC).local);

    const jPlus7 = jourCivilDeDatePlanifiee(
      new Date("2026-10-24T00:00:00.000Z"),
    );
    const jPlus8 = jourCivilDeDatePlanifiee(
      new Date("2026-10-25T00:00:00.000Z"),
    );

    const resultat = repartirJourneeTechnicien(
      [ligneA(jPlus7), ligneA(jPlus8)],
      [],
      aujourdHui,
    );
    expect(resultat.suite.dates).toEqual([jPlus7]);
    expect(resultat.suite.nombre).toBe(1);
  });
});
