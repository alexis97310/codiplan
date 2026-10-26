import { describe, expect, it } from "vitest";

import {
  contactAffiche,
  creneauDeLaFiche,
  libelleCopieDu,
  libelleJourLong,
  libelleJourLongEnTeteDePhrase,
  libelleJoursSuivantsVide,
  premiereLignePanne,
} from "@/components/terrain/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * LES PRÉSENTATIONS DU TERRAIN (9DI-TP-TER1-JOURNEE-FICHE, QE-11) — la PART
 * PURE, éprouvée sans base ni navigateur (D-13), partagée par la fiche et la
 * carte de Ma journée.
 */

const FUSEAU_NC = "Pacific/Noumea";

describe("libelleCopieDu — « lecture seule » au-dessus d'une liste, jamais au-dessus d'une fiche (9F4H6, point 4)", () => {
  const GENERE_LE = "2026-10-18T08:15:00.000Z"; // 19:15 à Nouméa

  it("sans `fiche` (par défaut) : la liste reste « lecture seule »", () => {
    const texte = libelleCopieDu(GENERE_LE, FUSEAU_NC);
    expect(texte).toContain(t("terrain.bandeau.suffixe"));
    expect(texte).not.toContain(t("terrain.bandeau.suffixe_travail"));
  });

  it("`fiche=true` : jamais « lecture seule » au-dessus d'un compteur/rapport saisissable", () => {
    const texte = libelleCopieDu(GENERE_LE, FUSEAU_NC, true);
    expect(texte).toContain(t("terrain.bandeau.suffixe_travail"));
    expect(texte).not.toContain(t("terrain.bandeau.suffixe"));
  });
});

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

describe("libelleJoursSuivantsVide", () => {
  it("« Rien d'autre de transmis d'ici » suivi du jour civil à J+7", () => {
    // 2026-09-29, un mardi : J+7 est le 2026-10-06, un mardi.
    const texte = libelleJoursSuivantsVide({ annee: 2026, mois: 9, jour: 29 });
    expect(texte).toBe(
      `${t("terrain.jours_suivants.vide_prefixe")}mardi 6 octobre.`,
    );
  });

  it("franchit le changement d'année", () => {
    // 2026-12-28 : J+7 est le 2027-01-04.
    const texte = libelleJoursSuivantsVide({
      annee: 2026,
      mois: 12,
      jour: 28,
    });
    expect(texte).toBe(
      `${t("terrain.jours_suivants.vide_prefixe")}lundi 4 janvier.`,
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

describe("libelleJourLongEnTeteDePhrase — le titre de Ma journée porte le jour de la semaine (point 7, 9G5-TERRAIN-ERGONOMIE)", () => {
  // Le 28 septembre 2026 est un lundi — l'exemple même de la maquette.
  const LUNDI_28_SEPTEMBRE = { jour: 28, mois: 9, annee: 2026 };

  it("« Lundi 28 septembre », capitalisé en tête de phrase", () => {
    expect(libelleJourLongEnTeteDePhrase(LUNDI_28_SEPTEMBRE)).toBe(
      "Lundi 28 septembre",
    );
  });

  it("même forme que `libelleJourLong`, seule la première lettre diffère", () => {
    const miPhrase = libelleJourLong(LUNDI_28_SEPTEMBRE);
    const enTete = libelleJourLongEnTeteDePhrase(LUNDI_28_SEPTEMBRE);
    expect(miPhrase).toBe("lundi 28 septembre");
    expect(enTete).toBe(miPhrase.charAt(0).toUpperCase() + miPhrase.slice(1));
  });
});
