import { describe, expect, it } from "vitest";

import {
  cleJour,
  decalageMinutes,
  fuseauDeLAgence,
  instantAMinutes,
  jourSuivant,
  lireFuseau,
  maintenant,
  schemaFuseau,
  versInstant,
  versLocal,
} from "@/lib/calendar";

/**
 * Fuseaux et instants (ticket L0-08, points 1 et 2).
 *
 * Deux règles s'y jouent : le fuseau est une donnée de l'AGENCE, et un instant
 * est en UTC tandis qu'une lecture est locale. Les scénarios ci-dessous
 * éprouvent la conversion dans les deux sens, y compris là où elle est le plus
 * fragile — les deux changements d'heure de la métropole, que Nouméa ne connaît
 * pas.
 */

const NOUMEA = "Pacific/Noumea";
const PARIS = "Europe/Paris";

describe("un fuseau est un identifiant IANA, jamais un décalage", () => {
  it("accepte les fuseaux des deux sociétés du jeu de démonstration", () => {
    expect(lireFuseau(NOUMEA)).toBe(NOUMEA);
    expect(lireFuseau(PARIS)).toBe(PARIS);
  });

  /**
   * Point 1 du ticket : « jamais de décalage numérique stocké : un décalage est
   * une conséquence, pas une donnée ». `UTC+11` décrit Nouméa toute l'année et
   * Paris jamais plus de la moitié.
   */
  it("refuse un décalage numérique déguisé en fuseau", () => {
    for (const faux of ["UTC+11", "+11:00", "-05:00", "GMT+1"]) {
      expect(schemaFuseau.safeParse(faux).success, faux).toBe(false);
    }
  });

  it("refuse un identifiant inconnu de la base IANA", () => {
    expect(schemaFuseau.safeParse("Pacific/Noumea_Sud").success).toBe(false);
    expect(schemaFuseau.safeParse("").success).toBe(false);
  });
});

describe("le fuseau appartient à l'agence, hérité de la société (D5)", () => {
  it("prend le fuseau de l'agence quand elle en porte un", () => {
    expect(
      fuseauDeLAgence({
        fuseau_horaire: PARIS,
        societe: { fuseau_horaire: NOUMEA },
      }),
    ).toBe(PARIS);
  });

  it("hérite de celui de la société sinon", () => {
    expect(
      fuseauDeLAgence({
        fuseau_horaire: null,
        societe: { fuseau_horaire: NOUMEA },
      }),
    ).toBe(NOUMEA);
  });

  it("refuse un fuseau invalide plutôt que de retomber sur un défaut", () => {
    // Aucun repli implicite : un fuseau faux doit se voir au paramétrage, pas
    // produire un planning décalé de dix heures qui a l'air de fonctionner.
    expect(() =>
      fuseauDeLAgence({
        fuseau_horaire: "UTC+11",
        societe: { fuseau_horaire: NOUMEA },
      }),
    ).toThrow();
  });
});

describe("décalage — calculé, jamais stocké", () => {
  it("Nouméa vaut +11 h toute l'année", () => {
    const janvier = new Date("2026-01-15T00:00:00.000Z");
    const juillet = new Date("2026-07-15T00:00:00.000Z");
    expect(decalageMinutes(janvier, NOUMEA)).toBe(11 * 60);
    expect(decalageMinutes(juillet, NOUMEA)).toBe(11 * 60);
  });

  it("Paris vaut +1 h en hiver et +2 h en été", () => {
    expect(decalageMinutes(new Date("2026-01-15T00:00:00.000Z"), PARIS)).toBe(
      60,
    );
    expect(decalageMinutes(new Date("2026-07-15T00:00:00.000Z"), PARIS)).toBe(
      120,
    );
  });
});

describe("lecture locale d'un instant", () => {
  it("le même instant se lit à deux heures différentes selon le fuseau", () => {
    const instant = new Date("2026-08-21T00:00:00.000Z");

    expect(versLocal(instant, NOUMEA)).toEqual({
      annee: 2026,
      mois: 8,
      jour: 21,
      heures: 11,
      minutes: 0,
      secondes: 0,
    });
    expect(versLocal(instant, PARIS)).toEqual({
      annee: 2026,
      mois: 8,
      jour: 21,
      heures: 2,
      minutes: 0,
      secondes: 0,
    });
  });

  it("minuit se lit 0 h, jamais 24 h", () => {
    const instant = versInstant(
      { annee: 2026, mois: 8, jour: 21, heures: 0, minutes: 0, secondes: 0 },
      NOUMEA,
    );
    expect(versLocal(instant, NOUMEA).heures).toBe(0);
  });
});

describe("aller-retour entre heure locale et instant", () => {
  it("se referme sur lui-même, à Nouméa comme à Paris", () => {
    const heures = [
      { annee: 2026, mois: 3, jour: 29, heures: 12, minutes: 30, secondes: 0 },
      { annee: 2026, mois: 10, jour: 25, heures: 12, minutes: 30, secondes: 0 },
      { annee: 2026, mois: 12, jour: 31, heures: 23, minutes: 59, secondes: 0 },
    ];

    for (const fuseau of [NOUMEA, PARIS]) {
      for (const locale of heures) {
        expect(versLocal(versInstant(locale, fuseau), fuseau), fuseau).toEqual(
          locale,
        );
      }
    }
  });

  /**
   * Le dernier dimanche de mars, 2 h 30 n'existe pas à Paris : les horloges
   * passent de 2 h à 3 h. La convention retenue rend l'instant qui SUIT le
   * saut — un créneau récurrent ce jour-là se pose, il ne disparaît pas.
   */
  it("une heure locale inexistante se pose après le saut de printemps", () => {
    const inexistante = {
      annee: 2026,
      mois: 3,
      jour: 29,
      heures: 2,
      minutes: 30,
      secondes: 0,
    };
    const instant = versInstant(inexistante, PARIS);

    expect(versLocal(instant, PARIS)).toEqual({
      ...inexistante,
      heures: 3,
      minutes: 30,
    });
  });

  /**
   * Le dernier dimanche d'octobre, 2 h 30 existe deux fois. La convention
   * retenue rend la PREMIÈRE occurrence, encore à l'heure d'été (+2 h).
   */
  it("une heure locale ambiguë rend la première occurrence", () => {
    const ambigue = {
      annee: 2026,
      mois: 10,
      jour: 25,
      heures: 2,
      minutes: 30,
      secondes: 0,
    };
    expect(decalageMinutes(versInstant(ambigue, PARIS), PARIS)).toBe(120);
  });

  it("Nouméa ne connaît aucun de ces deux cas", () => {
    for (const jour of [29, 25]) {
      const locale = {
        annee: 2026,
        mois: jour === 29 ? 3 : 10,
        jour,
        heures: 2,
        minutes: 30,
        secondes: 0,
      };
      expect(versLocal(versInstant(locale, NOUMEA), NOUMEA)).toEqual(locale);
    }
  });
});

describe("minutes locales et report de jour", () => {
  it("1440 minutes désigne minuit du lendemain", () => {
    const jour = { annee: 2026, mois: 8, jour: 21 };
    const minuitSuivant = instantAMinutes(jour, 24 * 60, NOUMEA);

    expect(versLocal(minuitSuivant, NOUMEA)).toEqual({
      annee: 2026,
      mois: 8,
      jour: 22,
      heures: 0,
      minutes: 0,
      secondes: 0,
    });
  });

  it("le jour suivant franchit les mois et les années", () => {
    expect(cleJour(jourSuivant({ annee: 2026, mois: 12, jour: 31 }))).toBe(
      "2027-01-01",
    );
    expect(cleJour(jourSuivant({ annee: 2028, mois: 2, jour: 28 }))).toBe(
      "2028-02-29",
    );
  });
});

describe("la date courante ne se lit pas sans fuseau", () => {
  it("`maintenant` exige un fuseau et rend l'instant ET sa lecture locale", () => {
    const nc = maintenant(NOUMEA);
    const fr = maintenant(PARIS);

    expect(nc.local).toEqual(versLocal(nc.instant, NOUMEA));
    expect(fr.local).toEqual(versLocal(fr.instant, PARIS));
  });
});
