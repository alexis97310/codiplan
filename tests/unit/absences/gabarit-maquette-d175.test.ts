import { describe, expect, it } from "vitest";

import {
  absencesDeLOnglet,
  bandesDesQuatreSemaines,
  dureeEnJours,
  renduesParAbsence,
} from "@/app/(back-office)/absences/presentation";
import type { JourLocal } from "@/lib/calendar/fuseau";

/**
 * 9EC-TP-UX3-E-ABSENCES (D175) — les fonctions pures de la page Absences
 * reconstruite au gabarit de la maquette du 28/09 : durée, onglets,
 * rattachement des lignes rendues, bandes des 4 prochaines semaines.
 */

function jourLocal(annee: number, mois: number, jour: number): JourLocal {
  return { annee, mois, jour };
}

function dateCivile(annee: number, mois: number, jour: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jour));
}

describe("dureeEnJours", () => {
  it("un seul jour civil — « 1 jour », au singulier", () => {
    expect(dureeEnJours(dateCivile(2026, 10, 7), dateCivile(2026, 10, 7))).toBe(
      "1 jour",
    );
  });

  it("plusieurs jours, bornes comprises — « N jours »", () => {
    expect(dureeEnJours(dateCivile(2026, 10, 7), dateCivile(2026, 10, 9))).toBe(
      "3 jours",
    );
  });
});

describe("absencesDeLOnglet", () => {
  const AVENIR = {
    id: "a-venir",
    utilisateur_id: "u1",
    du: dateCivile(2026, 10, 10),
    au: dateCivile(2026, 10, 12),
  };
  const EN_COURS = {
    id: "en-cours",
    utilisateur_id: "u2",
    du: dateCivile(2026, 10, 5),
    au: dateCivile(2026, 10, 9),
  };
  const TERMINEE = {
    id: "terminee",
    utilisateur_id: "u3",
    du: dateCivile(2026, 9, 1),
    au: dateCivile(2026, 9, 5),
  };
  const ABSENCES = [AVENIR, EN_COURS, TERMINEE];
  const AUJOURDHUI = jourLocal(2026, 10, 7);

  it("« actuelles » exclut seulement les terminées", () => {
    const resultat = absencesDeLOnglet("actuelles", ABSENCES, AUJOURDHUI);
    expect(resultat.map((a) => a.id)).toEqual(["en-cours", "a-venir"]);
  });

  it("« aujourdhui » ne garde que celle qui couvre le jour civil", () => {
    const resultat = absencesDeLOnglet("aujourdhui", ABSENCES, AUJOURDHUI);
    expect(resultat.map((a) => a.id)).toEqual(["en-cours"]);
  });

  it("« terminees » ne garde que les terminées, triées DU DÉCROISSANT", () => {
    const AUTRE_TERMINEE = {
      id: "terminee-2",
      utilisateur_id: "u4",
      du: dateCivile(2026, 9, 15),
      au: dateCivile(2026, 9, 20),
    };
    const resultat = absencesDeLOnglet(
      "terminees",
      [...ABSENCES, AUTRE_TERMINEE],
      AUJOURDHUI,
    );
    expect(resultat.map((a) => a.id)).toEqual(["terminee-2", "terminee"]);
  });

  it("« actuelles » et « aujourdhui » trient par période CROISSANTE", () => {
    const resultat = absencesDeLOnglet("actuelles", ABSENCES, AUJOURDHUI);
    expect(resultat.map((a) => a.id)).toEqual(["en-cours", "a-venir"]);
  });
});

describe("renduesParAbsence", () => {
  const ABSENCE = {
    utilisateur_id: "u1",
    du: dateCivile(2026, 10, 10),
    au: dateCivile(2026, 10, 12),
  };

  it("garde une ligne de la MÊME personne, déplanifiée DANS la période", () => {
    const ligne = {
      deplanifiee_absent_id: "u1",
      deplanifiee_date: dateCivile(2026, 10, 11),
    };
    expect(renduesParAbsence(ABSENCE, [ligne])).toEqual([ligne]);
  });

  it("exclut une ligne d'une AUTRE personne", () => {
    const ligne = {
      deplanifiee_absent_id: "u2",
      deplanifiee_date: dateCivile(2026, 10, 11),
    };
    expect(renduesParAbsence(ABSENCE, [ligne])).toEqual([]);
  });

  it("exclut une date HORS de la période", () => {
    const ligne = {
      deplanifiee_absent_id: "u1",
      deplanifiee_date: dateCivile(2026, 10, 20),
    };
    expect(renduesParAbsence(ABSENCE, [ligne])).toEqual([]);
  });

  it("exclut une ligne reposée (trace effacée, `deplanifiee_date` nul)", () => {
    const ligne = { deplanifiee_absent_id: "u1", deplanifiee_date: null };
    expect(renduesParAbsence(ABSENCE, [ligne])).toEqual([]);
  });
});

describe("bandesDesQuatreSemaines", () => {
  const LUNDI_AFFICHE = jourLocal(2026, 9, 28);
  const PERSONNES = [{ utilisateurId: "u1" }];

  it("une absence qui chevauche le début de la fenêtre est bornée à elle", () => {
    const absence = {
      id: "chevauche-debut",
      utilisateur_id: "u1",
      du: dateCivile(2026, 9, 25),
      au: dateCivile(2026, 9, 30),
    };
    const resultat = bandesDesQuatreSemaines(
      LUNDI_AFFICHE,
      [absence],
      PERSONNES,
      jourLocal(2026, 9, 28),
    );
    const bande = resultat.lignes[0].bandes[0];
    expect(bande.debutPourcent).toBe(0);
    // 3 jours visibles (28, 29, 30 septembre) sur 28 — bornée au début.
    expect(bande.largeurPourcent).toBeCloseTo((3 / 28) * 100);
  });

  it("une absence hors fenêtre (avant OU après) ne produit aucune bande", () => {
    const avant = {
      id: "avant",
      utilisateur_id: "u1",
      du: dateCivile(2026, 9, 1),
      au: dateCivile(2026, 9, 10),
    };
    const apres = {
      id: "apres",
      utilisateur_id: "u1",
      du: dateCivile(2026, 11, 1),
      au: dateCivile(2026, 11, 5),
    };
    const resultat = bandesDesQuatreSemaines(
      LUNDI_AFFICHE,
      [avant, apres],
      PERSONNES,
      jourLocal(2026, 9, 28),
    );
    expect(resultat.lignes[0].bandes).toEqual([]);
  });

  it("le trait du jour est `null` quand aujourd'hui tombe hors des 28 jours", () => {
    const resultat = bandesDesQuatreSemaines(
      LUNDI_AFFICHE,
      [],
      PERSONNES,
      jourLocal(2026, 12, 1),
    );
    expect(resultat.traitAujourdHuiPourcent).toBeNull();
  });

  it("le trait du jour est positionné quand aujourd'hui est DANS la fenêtre", () => {
    const resultat = bandesDesQuatreSemaines(
      LUNDI_AFFICHE,
      [],
      PERSONNES,
      jourLocal(2026, 9, 29),
    );
    expect(resultat.traitAujourdHuiPourcent).toBeCloseTo((1 / 28) * 100);
  });
});
