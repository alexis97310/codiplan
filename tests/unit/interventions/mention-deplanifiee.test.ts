import { describe, expect, it } from "vitest";

import { mentionDeplanifiee } from "@/app/(back-office)/interventions/presentation";
import { type StatutIntervention } from "@/lib/interventions/saisie";

/**
 * LA MENTION « DÉPLANIFIÉE — ABSENCE DE X LE JJ/MM » (9CC-DEPLANIFIEE-1,
 * constat 38 de l'audit d'ergonomie du 25/09/2026).
 */

const FUSEAU = "Pacific/Noumea";

// Jeudi 24/09/2026, à minuit UTC — colonne `@db.Date`, lue sans fuseau.
const DEPLANIFIEE_DATE = new Date(Date.UTC(2026, 8, 24));
// 08:00 à Nouméa (UTC+11) est 21:00 UTC la veille.
const DEPLANIFIEE_CRENEAU_DEBUT = new Date(Date.UTC(2026, 8, 23, 21, 0));
// 10:00 à Nouméa est 23:00 UTC la veille.
const DEPLANIFIEE_CRENEAU_FIN = new Date(Date.UTC(2026, 8, 23, 23, 0));

const LIGNE_DE_BASE = {
  statut: "a_planifier" as StatutIntervention,
  deplanifiee_date: DEPLANIFIEE_DATE,
  deplanifiee_creneau_debut: DEPLANIFIEE_CRENEAU_DEBUT,
  deplanifiee_creneau_fin: DEPLANIFIEE_CRENEAU_FIN,
  duree_estimee_min: 120,
};

describe("mentionDeplanifiee", () => {
  it("`null` sans trace — `deplanifiee_date` nulle", () => {
    expect(
      mentionDeplanifiee(
        { ...LIGNE_DE_BASE, deplanifiee_date: null },
        "D. Garnier",
        FUSEAU,
      ),
    ).toBeNull();
  });

  it("`null` dès que la ligne n'est plus `a_planifier` — une repose l'a déjà quittée", () => {
    expect(
      mentionDeplanifiee(
        { ...LIGNE_DE_BASE, statut: "planifiee" as StatutIntervention },
        "D. Garnier",
        FUSEAU,
      ),
    ).toBeNull();
  });

  it("le titre nomme l'absent et le jour, le mois — jamais l'année", () => {
    const mention = mentionDeplanifiee(LIGNE_DE_BASE, "D. Garnier", FUSEAU);
    expect(mention?.titre).toBe("Déplanifiée — absence de D. Garnier le 24/09");
  });

  it("l'ancien créneau est composé par `resumeDuCreneau`, avec la durée GARDÉE", () => {
    const mention = mentionDeplanifiee(LIGNE_DE_BASE, "D. Garnier", FUSEAU);
    expect(mention?.ancienCreneau).toBe(
      "Ancien créneau : jeu. 24/09 · 08:00–10:00 (2 h 00)",
    );
  });

  it("sans ancien créneau (file d'attente datée sans heure) — le JJ/MM seul", () => {
    const mention = mentionDeplanifiee(
      {
        ...LIGNE_DE_BASE,
        deplanifiee_creneau_debut: null,
        deplanifiee_creneau_fin: null,
        duree_estimee_min: null,
      },
      "D. Garnier",
      FUSEAU,
    );
    expect(mention?.ancienCreneau).toBe(
      "Ancien créneau : jeu. 24/09 · heure non fixée",
    );
  });
});
