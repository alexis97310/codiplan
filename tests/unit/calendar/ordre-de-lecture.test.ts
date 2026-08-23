import { describe, expect, it } from "vitest";

import { appliquerEcarts, estChome, lireCleJour } from "@/lib/calendar";

/**
 * **L'ordre de lecture : le fait public d'abord, l'écart local ensuite**
 * (ticket L0-08 ; D46, complément 2).
 *
 *   1. `jour_ferie` porte le **fait public du territoire** — ce qui EST férié ;
 *   2. `calendrier_ferie` porte **l'écart local** de l'agence — ce qu'elle en
 *      fait.
 *
 * **Jamais l'inverse.** Lire dans l'autre sens donnerait à une agence le
 * pouvoir de décréter un férié pour son territoire, ce qui n'appartient à
 * aucune entreprise — et que la base refuse déjà, puisque `jour_ferie` n'est
 * écrivable que par les rôles éditeur (D46).
 *
 * `appliquerEcarts` est le seul endroit du dépôt où les deux sources se
 * rencontrent. C'est donc là que l'ordre se prouve, et ce fichier ne fait que
 * cela.
 */

const NOEL = "2027-12-25";
const VEILLE = "2027-12-24";
const FAIT_PUBLIC = [{ date: NOEL, libelle: "Noël" }];

describe("le fait public seul", () => {
  it("un férié sans écart est chômé", () => {
    const jours = appliquerEcarts(FAIT_PUBLIC, []);

    expect(jours).toEqual([
      { date: NOEL, libelle: "Noël", ouvre: false, origine: "territoire" },
    ]);
  });

  it("un jour ordinaire n'apparaît pas", () => {
    expect(appliquerEcarts(FAIT_PUBLIC, [])).toHaveLength(1);
  });
});

describe("l'écart local, appliqué APRÈS", () => {
  it("un férié TRAVAILLÉ ouvre, et garde le libellé du fait public", () => {
    // L'écart tranche, il ne renomme pas : « Noël » reste « Noël », même
    // travaillé. Le motif de l'agence ne remplace pas le nom du jour.
    const jours = appliquerEcarts(FAIT_PUBLIC, [
      { date: NOEL, travaille: true, motif: "Astreinte de fin d'année" },
    ]);

    expect(jours).toEqual([
      { date: NOEL, libelle: "Noël", ouvre: true, origine: "agence" },
    ]);
  });

  it("un PONT chôme un jour qu'aucun fait public ne désigne", () => {
    const jours = appliquerEcarts(FAIT_PUBLIC, [
      { date: VEILLE, travaille: false, motif: "Pont de fin d'année" },
    ]);

    expect(jours).toEqual([
      {
        date: VEILLE,
        libelle: "Pont de fin d'année",
        ouvre: false,
        origine: "agence",
      },
      { date: NOEL, libelle: "Noël", ouvre: false, origine: "territoire" },
    ]);
  });

  it("le résultat est trié par date, quel que soit l'ordre des sources", () => {
    const jours = appliquerEcarts(
      [
        { date: NOEL, libelle: "Noël" },
        { date: "2027-01-01", libelle: "Jour de l'An" },
      ],
      [{ date: VEILLE, travaille: false, motif: "Pont" }],
    );

    expect(jours.map((jour) => jour.date)).toEqual([
      "2027-01-01",
      VEILLE,
      NOEL,
    ]);
  });
});

describe("l'ordre inverse donnerait un autre résultat — c'est pourquoi il est fixé", () => {
  /**
   * La démonstration par l'absurde. Composer l'écart PUIS le fait public
   * écraserait la décision de l'agence : le férié redeviendrait chômé, et
   * l'agence qui a décidé de travailler ce jour-là verrait son planning vidé
   * sans explication.
   */
  it("le fait public appliqué en dernier écraserait la décision de l'agence", () => {
    const ecart = [
      { date: NOEL, travaille: true, motif: "Astreinte de fin d'année" },
    ];

    const bonSens = appliquerEcarts(FAIT_PUBLIC, ecart);
    const sensInverse = appliquerEcarts(
      // Ce que produirait une composition à l'envers : le fait public repasse
      // par-dessus, et le jour redevient chômé.
      [],
      ecart,
    ).map((jour) =>
      jour.date === NOEL
        ? { ...jour, ouvre: false, origine: "territoire" as const }
        : jour,
    );

    expect(bonSens[0]?.ouvre).toBe(true);
    expect(sensInverse[0]?.ouvre).toBe(false);
    expect(bonSens).not.toEqual(sensInverse);
  });

  it("et `estChome` suit l'ordre, sans relire les deux sources", () => {
    const travaille = {
      code: "AGENCE",
      fuseau: "Pacific/Noumea",
      territoire: "NC",
      plages: [{ jour_semaine: 6, debut_minutes: 480, fin_minutes: 720 }],
      jours_particuliers: appliquerEcarts(FAIT_PUBLIC, [
        { date: NOEL, travaille: true, motif: "Astreinte" },
      ]),
    };
    const chome = {
      ...travaille,
      jours_particuliers: appliquerEcarts(FAIT_PUBLIC, []),
    };

    expect(estChome(travaille, lireCleJour(NOEL))).toBe(false);
    expect(estChome(chome, lireCleJour(NOEL))).toBe(true);
  });
});
