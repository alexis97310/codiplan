import { describe, expect, it } from "vitest";

import { SOCIETES } from "@/prisma/seed-data";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * Gardien n°1 du ticket L0-08 : **aucun identifiant de fuseau hors du schéma
 * et de son seed**.
 *
 * C'est le point 1 du ticket rendu exécutable : « le fuseau appartient à
 * l'agence, pas à la plateforme. Chaque agence porte son fuseau au format IANA
 * — Pacific/Noumea, Europe/Paris. Jamais de fuseau écrit en dur dans le code,
 * jamais de décalage numérique stocké : un décalage est une conséquence, pas
 * une donnée. »
 *
 * **Ce qu'un fuseau en dur coûte.** Écrire `Pacific/Noumea` dans une fonction,
 * c'est décider que la plateforme est calédonienne. La solution est destinée à
 * être vendue (chapitre 20) : la première agence métropolitaine verrait son
 * planning décalé de dix heures, et l'erreur ne se manifesterait qu'à
 * l'affichage, chez le client. C'est la même faute que `code_winpro`
 * (CLAUDE.md §9), sur une autre colonne.
 *
 * **Ce qu'un décalage stocké coûte.** `+11` décrit Nouméa toute l'année et
 * Paris jamais plus de la moitié. Un décalage est le RÉSULTAT d'un fuseau et
 * d'une date ; le stocker, c'est figer ce résultat au jour où on l'a calculé.
 *
 * **Périmètre.** Les chemins applicatifs. `prisma/seed-data.ts` est exempté :
 * c'est le seed des colonnes `societe.fuseau_horaire` et
 * `agence.fuseau_horaire`, c'est-à-dire l'endroit désigné par le ticket pour
 * que ces identifiants existent. `tests/` est hors périmètre — un scénario doit
 * pouvoir poser un appareil à Tokyo.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Le seed des colonnes de fuseau — le seul endroit où un IANA est une donnée. */
const EXEMPTS_FICHIERS = ["prisma/seed-data.ts"];

/**
 * Zones de la base IANA. La liste est celle des préfixes de la base, pas celle
 * des fuseaux : elle ne vieillit pas quand un pays crée un fuseau.
 */
const ZONES_IANA = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Etc",
  "Europe",
  "Indian",
  "Pacific",
].join("|");

const MARQUEURS: readonly RegExp[] = [
  // Un identifiant IANA écrit dans une chaîne : "Pacific/Noumea".
  new RegExp(`["'\`](${ZONES_IANA})/[A-Za-z_+-]`),
  // Un décalage numérique traité comme un fuseau.
  /["'`](UTC|GMT)[+-]\d/,
  /\bfuseau\w*\s*[:=]\s*["'`][+-]?\d/i,
  // Le fuseau de l'APPAREIL, pris pour celui de l'agence.
  /resolvedOptions\s*\(\s*\)\s*\.\s*timeZone/,
];

describe("aucun identifiant de fuseau en dur (I7, point 1 du ticket L0-08)", () => {
  const fichiers = fichiersSource(REPERTOIRES)
    .filter((fichier) => !EXEMPTS_FICHIERS.includes(fichier.chemin))
    .map((fichier) => ({
      chemin: fichier.chemin,
      contenu: sansCommentaires(fichier.contenu),
    }));

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier applicatif ne nomme un fuseau", () => {
    const fautifs = fichiers
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "un fuseau horaire est écrit en dur : il est une donnée de l'agence " +
        "(D5), et le code ne doit connaître aucun territoire (I7)",
    ).toEqual([]);
  });

  it("le gardien détecte réellement un fuseau en dur — éprouvé sur des cas fabriqués", () => {
    const fautif = [
      'const fuseau = "Pacific/Noumea";',
      'versLocal(instant, "Europe/Paris")',
      'const f = { timeZone: "America/New_York" };',
      'const fuseau = "UTC+11";',
      "const fuseauAgence = '+11:00';",
      "const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;",
    ];
    for (const ligne of fautif) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `non détecté : ${ligne}`,
      ).toBe(true);
    }
  });

  it("le gardien laisse passer la lecture de la donnée — éprouvé sur des cas fabriqués", () => {
    const licite = [
      "const fuseau = fuseauDeLAgence(agence);",
      "return versLocal(instant, calendrier.fuseau);",
      "const f = { timeZone: fuseau };",
      "const fuseau = agence.fuseau_horaire ?? societe.fuseau_horaire;",
    ];
    for (const ligne of licite) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `faux positif : ${ligne}`,
      ).toBe(false);
    }
  });

  /**
   * Le gardien tirerait ses fuseaux d'une liste écrite à la main qu'il
   * laisserait passer le premier fuseau absent de cette liste. Il part donc
   * des zones IANA — et ce scénario vérifie que les fuseaux réellement en
   * usage dans le dépôt, ceux du seed, seraient bien attrapés ailleurs.
   */
  it("les fuseaux du seed seraient détectés hors du seed", () => {
    const fuseaux = SOCIETES.map((societe) => societe.fuseau_horaire);
    expect(fuseaux.length).toBeGreaterThan(1);

    for (const fuseau of fuseaux) {
      const ligne = `const f = "${fuseau}";`;
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `le fuseau ${fuseau} passerait au travers du gardien`,
      ).toBe(true);
    }
  });

  it("les commentaires qui CITENT un fuseau ne sont pas des fuseaux en dur", () => {
    const documente = sansCommentaires(
      [
        '// Le fuseau vient de l\'agence — ex. "Pacific/Noumea".',
        "/** Identifiant IANA : `Europe/Paris`. */",
        "const fuseau = agence.fuseau_horaire;",
      ].join("\n"),
    );

    expect(MARQUEURS.some((marqueur) => marqueur.test(documente))).toBe(false);
  });
});
