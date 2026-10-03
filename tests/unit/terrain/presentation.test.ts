import { describe, expect, it } from "vitest";

import {
  contactAffiche,
  creneauDeLaFiche,
  premiereLignePanne,
} from "@/components/terrain/presentation";

/**
 * LES PRÉSENTATIONS DU TERRAIN (9DI-TP-TER1-JOURNEE-FICHE, QE-11) — la PART
 * PURE, éprouvée sans base ni navigateur (D-13), partagée par la fiche et la
 * carte de Ma journée.
 */

const FUSEAU_NC = "Pacific/Noumea";

describe("creneauDeLaFiche", () => {
  it("« HH:MM – HH:MM » quand le créneau est posé", () => {
    const texte = creneauDeLaFiche(
      {
        date_planifiee: new Date("2026-10-05T00:00:00.000Z"),
        creneau_debut: new Date("2026-10-04T22:00:00.000Z"), // 09:00 à Nouméa
        creneau_fin: new Date("2026-10-04T23:30:00.000Z"), // 10:30 à Nouméa
      },
      FUSEAU_NC,
    );
    expect(texte).toBe("09:00 – 10:30");
  });

  it("l'heure de début seule quand aucune fin n'est posée", () => {
    const texte = creneauDeLaFiche(
      {
        date_planifiee: new Date("2026-10-05T00:00:00.000Z"),
        creneau_debut: new Date("2026-10-04T22:00:00.000Z"),
        creneau_fin: null,
      },
      FUSEAU_NC,
    );
    expect(texte).toBe("09:00");
  });

  it("la date seule quand aucun créneau n'est posé", () => {
    const texte = creneauDeLaFiche(
      {
        date_planifiee: new Date("2026-10-05T00:00:00.000Z"),
        creneau_debut: null,
        creneau_fin: null,
      },
      FUSEAU_NC,
    );
    expect(texte).toBe("05/10/2026");
  });

  it("le signe d'absence quand ni créneau ni date ne sont posés", () => {
    const texte = creneauDeLaFiche(
      { date_planifiee: null, creneau_debut: null, creneau_fin: null },
      FUSEAU_NC,
    );
    expect(texte).toBe("—");
  });
});

describe("premiereLignePanne", () => {
  it("rend null quand la description est null", () => {
    expect(premiereLignePanne(null)).toBeNull();
  });

  it("rend null quand la description est vide ou blanche", () => {
    expect(premiereLignePanne("   ")).toBeNull();
  });

  it("ne garde que la première ligne, élaguée", () => {
    expect(
      premiereLignePanne("Filtre à air remplacé.\nRevoir dans 3 mois."),
    ).toBe("Filtre à air remplacé.");
  });

  it("rend la description entière quand elle ne porte qu'une ligne", () => {
    expect(premiereLignePanne("Fuite d'huile constatée.")).toBe(
      "Fuite d'huile constatée.",
    );
  });
});

describe("contactAffiche", () => {
  it("rend null quand aucun contact n'est désigné", () => {
    expect(contactAffiche(null)).toBeNull();
  });

  it("aucun numéro quand téléphone ET mobile sont absents", () => {
    expect(
      contactAffiche({ nom: "Jean Dupont", telephone: null, mobile: null }),
    ).toEqual({ nom: "Jean Dupont", numeros: [] });
  });

  it("un seul numéro quand un seul est renseigné", () => {
    expect(
      contactAffiche({
        nom: "Jean Dupont",
        telephone: "687 12.34.56",
        mobile: null,
      }),
    ).toEqual({ nom: "Jean Dupont", numeros: ["687 12.34.56"] });
  });

  it("les deux numéros, dans l'ordre téléphone puis mobile, quand ils diffèrent", () => {
    expect(
      contactAffiche({
        nom: "Jean Dupont",
        telephone: "26.00.00",
        mobile: "78.11.22",
      }),
    ).toEqual({ nom: "Jean Dupont", numeros: ["26.00.00", "78.11.22"] });
  });

  it("un seul numéro quand téléphone et mobile sont identiques", () => {
    expect(
      contactAffiche({
        nom: "Jean Dupont",
        telephone: "78.11.22",
        mobile: "78.11.22",
      }),
    ).toEqual({ nom: "Jean Dupont", numeros: ["78.11.22"] });
  });
});
