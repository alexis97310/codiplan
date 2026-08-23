import { describe, expect, it } from "vitest";

import {
  deroulerOccurrences,
  lireRecurrence,
  versLocal,
  LUNDI,
  type Recurrence,
} from "@/lib/calendar";

/**
 * Récurrences et changements d'heure (ticket L0-08, point 3).
 *
 * **Le scénario qui justifie tout le module.** « Tous les lundis à 8 h » n'a pas
 * un décalage constant à Paris : figée en UTC à la création, l'occurrence se
 * décale d'une heure deux fois par an — 7 h en été, 9 h en hiver, ou l'inverse
 * selon la saison où le créneau a été posé. À Nouméa, rien ne bouge. Une
 * récurrence stockée sous forme d'instants serait donc juste sur un territoire
 * et fausse sur l'autre, ce qui est la définition d'un défaut qu'on ne voit
 * pas venir.
 *
 * L'année 2026 est parcourue en entier, et elle contient les deux bascules
 * métropolitaines : le 29 mars et le 25 octobre.
 */

const NOUMEA = "Pacific/Noumea";
const PARIS = "Europe/Paris";

/** « Tous les lundis à 8 h, pendant quatre heures » — la règle, pas l'instant. */
const LUNDI_HUIT_HEURES = {
  jour_semaine: LUNDI,
  debut_minutes: 8 * 60,
  duree_minutes: 4 * 60,
};

const ANNEE_2026 = {
  debut: new Date("2026-01-01T00:00:00.000Z"),
  fin: new Date("2026-12-31T23:59:59.000Z"),
};

function recurrence(fuseau: string): Recurrence {
  return lireRecurrence({ regle: LUNDI_HUIT_HEURES, fuseau });
}

describe("une récurrence stocke une règle locale et son fuseau", () => {
  it("refuse une règle sans fuseau", () => {
    expect(() => lireRecurrence({ regle: LUNDI_HUIT_HEURES })).toThrow();
  });

  it("refuse un jour de semaine hors de l'échelle ISO", () => {
    for (const jour of [0, 8, 1.5]) {
      expect(() =>
        lireRecurrence({
          regle: { ...LUNDI_HUIT_HEURES, jour_semaine: jour },
          fuseau: NOUMEA,
        }),
      ).toThrow();
    }
  });
});

describe("Paris — la récurrence traverse les DEUX changements d'heure", () => {
  const occurrences = deroulerOccurrences(recurrence(PARIS), ANNEE_2026);

  it("compte les 52 lundis de l'année", () => {
    expect(occurrences).toHaveLength(52);
  });

  it("chaque occurrence reste à 8 h LOCALES, toute l'année", () => {
    for (const occurrence of occurrences) {
      const local = versLocal(occurrence.debut, PARIS);
      expect(
        { heures: local.heures, minutes: local.minutes },
        occurrence.debut.toISOString(),
      ).toEqual({ heures: 8, minutes: 0 });
    }
  });

  /**
   * Le cœur du sujet : la même heure locale correspond à DEUX instants UTC
   * différents selon la saison. C'est exactement ce qu'un stockage en UTC
   * aurait perdu.
   */
  it("l'instant UTC, lui, change de part et d'autre des bascules", () => {
    const utc = (iso: string): number => {
      const occurrence = occurrences.find(
        (candidate) => candidate.debut.toISOString().slice(0, 10) === iso,
      );
      if (occurrence === undefined) {
        throw new Error(`Occurrence introuvable au ${iso}.`);
      }
      return versLocal(occurrence.debut, "UTC").heures;
    };

    // Heure d'hiver (UTC+1) : 8 h locales = 7 h UTC.
    expect(utc("2026-03-23")).toBe(7);
    // Lendemain de la bascule de printemps (UTC+2) : 8 h locales = 6 h UTC.
    expect(utc("2026-03-30")).toBe(6);
    // Dernier lundi avant la bascule d'automne, encore en heure d'été.
    expect(utc("2026-10-19")).toBe(6);
    // Après le retour à l'heure d'hiver.
    expect(utc("2026-10-26")).toBe(7);
  });

  it("la durée locale de quatre heures est tenue à chaque occurrence", () => {
    for (const occurrence of occurrences) {
      const local = versLocal(occurrence.fin, PARIS);
      expect({ heures: local.heures, minutes: local.minutes }).toEqual({
        heures: 12,
        minutes: 0,
      });
    }
  });
});

describe("Nouméa — la même règle ne bouge jamais", () => {
  const occurrences = deroulerOccurrences(recurrence(NOUMEA), ANNEE_2026);

  it("compte les mêmes 52 lundis", () => {
    expect(occurrences).toHaveLength(52);
  });

  /**
   * Nouméa est à UTC+11 sans changement d'heure : 8 h locales tombent
   * invariablement à 21 h UTC la veille. Un seul décalage, toute l'année.
   */
  it("l'instant UTC est le même écart, du 1er janvier au 31 décembre", () => {
    const heuresUtc = new Set(
      occurrences.map(
        (occurrence) => versLocal(occurrence.debut, "UTC").heures,
      ),
    );
    expect([...heuresUtc]).toEqual([21]);
  });
});

describe("bornes du déroulement", () => {
  it("retient une occurrence commencée AVANT l'intervalle mais qui court encore", () => {
    // Lundi 23 mars 2026 : Paris est encore à UTC+1, l'occurrence de 8 h – 12 h
    // locales couvre donc 07 h – 11 h UTC. L'intervalle demandé commence après
    // son début et se termine avant sa fin : elle doit être rendue quand même,
    // sans quoi un planning affiché en cours de matinée perdrait le créneau
    // déjà entamé.
    const enCours = deroulerOccurrences(recurrence(PARIS), {
      debut: new Date("2026-03-23T10:00:00.000Z"),
      fin: new Date("2026-03-23T10:30:00.000Z"),
    });
    expect(enCours).toHaveLength(1);
    expect(enCours[0]?.debut.toISOString()).toBe("2026-03-23T07:00:00.000Z");
  });

  it("écarte une occurrence entièrement passée", () => {
    // Même lundi, mais après 11 h UTC : le créneau est clos.
    const apres = deroulerOccurrences(recurrence(PARIS), {
      debut: new Date("2026-03-23T11:30:00.000Z"),
      fin: new Date("2026-03-23T12:00:00.000Z"),
    });
    expect(apres).toHaveLength(0);
  });

  it("refuse un intervalle inversé", () => {
    expect(() =>
      deroulerOccurrences(recurrence(PARIS), {
        debut: ANNEE_2026.fin,
        fin: ANNEE_2026.debut,
      }),
    ).toThrow(/inversé/);
  });
});
