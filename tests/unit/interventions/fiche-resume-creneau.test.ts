import { describe, expect, it } from "vitest";

import { resumeDuCreneau } from "@/app/(back-office)/interventions/presentation";

/**
 * LE CRÉNEAU ET SA DURÉE, DANS LE RÉSUMÉ DE LA FICHE (PG-A5-FICHE-CRENEAU,
 * audit d'ergonomie du 27/09/2026, §4.4) — mesuré absent sur `main` : le
 * résumé montrait une date et une heure, jamais la durée, alors qu'elle est
 * obligatoire pour planifier.
 */

const FUSEAU = "Pacific/Noumea";

// Jeudi 24/09/2026, à minuit UTC — une colonne `@db.Date` telle qu'elle est
// stockée : `date_planifiee` se lit SANS fuseau, comme `dateCivile`.
const DATE_PLANIFIEE = new Date(Date.UTC(2026, 8, 24));

// 08:00 à Nouméa (UTC+11) est 21:00 UTC la veille.
const CRENEAU_DEBUT = new Date(Date.UTC(2026, 8, 23, 21, 0));
// 10:00 à Nouméa est 23:00 UTC la veille.
const CRENEAU_FIN = new Date(Date.UTC(2026, 8, 23, 23, 0));

describe("resumeDuCreneau", () => {
  it("sans date planifiée : le statut « à planifier »", () => {
    expect(
      resumeDuCreneau(
        {
          date_planifiee: null,
          creneau_debut: null,
          creneau_fin: null,
          duree_estimee_min: null,
        },
        FUSEAU,
      ),
    ).toBe("À planifier");
  });

  it("date, heure et durée connues : le jour abrégé, le créneau complet et la durée", () => {
    expect(
      resumeDuCreneau(
        {
          date_planifiee: DATE_PLANIFIEE,
          creneau_debut: CRENEAU_DEBUT,
          creneau_fin: CRENEAU_FIN,
          duree_estimee_min: 120,
        },
        FUSEAU,
      ),
    ).toBe("jeu. 24/09 · 08:00–10:00 (2 h 00)");
  });

  it("sans heure : l'absence se nomme, jamais un tiret", () => {
    expect(
      resumeDuCreneau(
        {
          date_planifiee: DATE_PLANIFIEE,
          creneau_debut: null,
          creneau_fin: null,
          duree_estimee_min: null,
        },
        FUSEAU,
      ),
    ).toBe("jeu. 24/09 · heure non fixée");
  });

  it("sans durée : le début seul, et l'absence nommée", () => {
    expect(
      resumeDuCreneau(
        {
          date_planifiee: DATE_PLANIFIEE,
          creneau_debut: CRENEAU_DEBUT,
          creneau_fin: null,
          duree_estimee_min: null,
        },
        FUSEAU,
      ),
    ).toBe("jeu. 24/09 · 08:00 · durée non renseignée");
  });
});
