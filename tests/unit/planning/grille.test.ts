import { describe, expect, it } from "vitest";

import { type Calendrier } from "@/lib/calendar";
import {
  PAS_MINUTES,
  grilleDuJour,
  libelleMinutes,
  positionner,
} from "@/lib/planning/grille";

/**
 * LA GÉOMÉTRIE DU PLANNING (L2-11, D72).
 *
 * Elle s'éprouve **sans navigateur et sans base** : c'est tout l'intérêt d'avoir
 * séparé la géométrie du rendu. Les trois exigences de D72 se mesurent ici — le
 * pas de quinze minutes, les bornes tirées du calendrier, et le fait qu'aucun
 * horaire ne soit écrit en dur (I7).
 */

const FUSEAU = "Pacific/Noumea";

/** Un calendrier d'essai. Les heures sont des DONNÉES, jamais des constantes. */
function calendrier(
  plages: ReadonlyArray<[jour: number, debut: number, fin: number]>,
): Calendrier {
  return {
    code: "ESSAI",
    fuseau: FUSEAU,
    territoire: "NC",
    plages: plages.map(([jour_semaine, debut_minutes, fin_minutes]) => ({
      jour_semaine,
      debut_minutes,
      fin_minutes,
    })),
    jours_particuliers: [],
  };
}

/** Un mercredi — jour ISO 3. */
const MERCREDI = { annee: 2026, mois: 9, jour: 9 };
/** Un dimanche — jour ISO 7. */
const DIMANCHE = { annee: 2026, mois: 9, jour: 13 };

describe("la grille du jour", () => {
  it("prend ses bornes des PLAGES, jamais d'un horaire écrit en dur (I7)", () => {
    // Deux calendriers différents donnent deux grilles différentes : c'est la
    // seule mesure qui prouve qu'aucune heure n'est gravée dans le module.
    const ducos = grilleDuJour(calendrier([[3, 7 * 60, 16 * 60]]), MERCREDI);
    const kone = grilleDuJour(calendrier([[3, 8 * 60, 15 * 60]]), MERCREDI);

    expect(ducos.debutMinutes).toBe(7 * 60);
    expect(ducos.finMinutes).toBe(16 * 60);
    expect(kone.debutMinutes).toBe(8 * 60);
    expect(kone.finMinutes).toBe(15 * 60);
    expect(ducos.lignes.length).not.toBe(kone.lignes.length);
  });

  it("avance d'un PAS DE QUINZE MINUTES, et le pas est nommé", () => {
    const grille = grilleDuJour(calendrier([[3, 8 * 60, 9 * 60]]), MERCREDI);

    expect(PAS_MINUTES).toBe(15);
    expect(grille.lignes.map((ligne) => ligne.libelle)).toEqual([
      "08:00",
      "08:15",
      "08:30",
      "08:45",
    ]);
    expect(grille.lignes.filter((ligne) => ligne.heurePleine)).toHaveLength(1);
  });

  it("la COUPURE DE MIDI ne coupe pas la grille en deux", () => {
    // Un technicien peut intervenir sur l'heure du déjeuner ; masquer les
    // lignes rendrait son bloc invisible. La grille est l'UNION des plages.
    const grille = grilleDuJour(
      calendrier([
        [3, 7 * 60, 11 * 60 + 30],
        [3, 13 * 60, 16 * 60],
      ]),
      MERCREDI,
    );

    expect(grille.debutMinutes).toBe(7 * 60);
    expect(grille.finMinutes).toBe(16 * 60);
    expect(grille.ferme).toBe(false);
  });

  it("un jour SANS PLAGE est FERMÉ, et la grille est vide", () => {
    // Ce n'est pas la même chose qu'une journée sans intervention : l'écran
    // doit dire « fermé » plutôt que d'afficher une colonne vide.
    const grille = grilleDuJour(calendrier([[3, 7 * 60, 16 * 60]]), DIMANCHE);

    expect(grille.ferme).toBe(true);
    expect(grille.lignes).toEqual([]);
  });

  it("arrondit les bornes AU PAS, dans le bon sens chacune", () => {
    // 7 h 05 → 7 h 00 (vers le bas, sinon la première minute sort de la
    // grille) ; 15 h 50 → 16 h 00 (vers le haut, même raison à l'autre bout).
    const grille = grilleDuJour(
      calendrier([[3, 7 * 60 + 5, 15 * 60 + 50]]),
      MERCREDI,
    );

    expect(grille.debutMinutes).toBe(7 * 60);
    expect(grille.finMinutes).toBe(16 * 60);
  });
});

describe("la place d'un bloc dans la grille", () => {
  const grille = grilleDuJour(calendrier([[3, 7 * 60, 16 * 60]]), MERCREDI);

  /** Un instant local du mercredi, dans le fuseau du calendrier. */
  function a(heures: number, minutes = 0): Date {
    // Pacific/Noumea est à UTC+11 toute l'année (aucun changement d'heure).
    return new Date(Date.UTC(2026, 8, 9, heures - 11, minutes, 0, 0));
  }

  it("place un créneau au bon rang et sur la bonne hauteur", () => {
    const place = positionner(grille, a(8), a(9, 30));

    expect(place).not.toBeNull();
    // 8 h — 7 h = 60 minutes = 4 pas.
    expect(place?.depuis).toBe(4);
    // 90 minutes = 6 pas.
    expect(place?.pas).toBe(6);
    expect(place?.deborde).toBe(false);
  });

  it("un bloc plus court qu'un pas OCCUPE quand même un pas", () => {
    // Un bloc de hauteur nulle serait un bloc invisible : une intervention de
    // dix minutes existe, et elle doit se voir.
    const place = positionner(grille, a(8), a(8, 10));

    expect(place?.pas).toBeGreaterThanOrEqual(1);
  });

  it("SIGNALE un débordement plutôt que de tronquer en silence", () => {
    // Une intervention posée avant l'ouverture est une information de gestion
    // — c'est elle qui déclenche la majoration (I7) —, pas un défaut
    // d'affichage. La tronquer sans le dire la ferait disparaître.
    const place = positionner(grille, a(6), a(8));

    expect(place).not.toBeNull();
    expect(place?.deborde).toBe(true);
    expect(place?.depuis).toBe(0);
  });

  it("rend `null` pour ce qui ne rencontre PAS la grille", () => {
    // Un bloc entièrement hors des heures n'a pas de place, et l'inventer
    // serait pire que l'omettre.
    expect(positionner(grille, a(3), a(5))).toBeNull();
    expect(positionner(grille, a(18), a(19))).toBeNull();
  });

  it("rend `null` sur une grille FERMÉE, sans lever", () => {
    const fermee = grilleDuJour(calendrier([[3, 7 * 60, 16 * 60]]), DIMANCHE);
    expect(positionner(fermee, a(8), a(9))).toBeNull();
  });
});

describe("le libellé d'une minute", () => {
  it("est sur deux chiffres, en vingt-quatre heures", () => {
    expect(libelleMinutes(0)).toBe("00:00");
    expect(libelleMinutes(7 * 60 + 5)).toBe("07:05");
    expect(libelleMinutes(13 * 60 + 45)).toBe("13:45");
    expect(libelleMinutes(23 * 60 + 59)).toBe("23:59");
  });
});
