import { describe, expect, it } from "vitest";

import { appliquerEcarts, estChome, lireCleJour } from "@/lib/calendar";
import { SOCIETES, schemaTerritoireValide } from "./territoire-outils";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * Gardien n°4 du ticket L0-08 : **le territoire n'est pas le fuseau, et ne s'en
 * déduit jamais** (D46, complément 1).
 *
 * **Le défaut que ce gardien interdit.** `Europe/Paris` couvre plusieurs
 * territoires aux jours fériés différents — l'Alsace-Moselle y chôme le
 * Vendredi saint et le 26 décembre, le reste de la métropole non. Un code qui
 * écrirait `territoire = fuseau.startsWith("Pacific") ? "NC" : "FR"` aurait
 * l'air juste sur les deux sociétés du jeu de démonstration, et se tromperait
 * chez le premier client strasbourgeois. Pire : il se tromperait en silence,
 * puisque le planning proposerait simplement des créneaux un jour chômé.
 *
 * **Deux attributs, deux questions distinctes.** Le fuseau dit QUELLE HEURE il
 * est ; le territoire dit QUELS JOURS SONT FÉRIÉS. Ils sont portés par l'agence
 * séparément, écrits séparément dans le seed, et lus séparément par
 * `chargerCalendrierAgence`. Aucun des deux ne se calcule à partir de l'autre.
 *
 * Trois éprouvés ici : la forme du code (gardien statique), la forme de la
 * donnée (ISO 3166-1 alpha-2), et le comportement (même fuseau, deux
 * territoires, deux jeux de fériés).
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/**
 * Motifs de dérivation. Ils cherchent la RENCONTRE des deux mots dans une même
 * expression : c'est là que la faute se commet, et nulle part ailleurs.
 */
const MARQUEURS: readonly RegExp[] = [
  // Un territoire calculé depuis un fuseau, ou l'inverse, dans une affectation.
  /\bterritoire\w*\s*[:=](?!=)[^;\n]*\bfuseau/i,
  /\bfuseau\w*\s*[:=](?!=)[^;\n]*\bterritoire/i,
  // Une fonction qui prend l'un et rend l'autre.
  /\bfuseau\w*\s*:[^)]*\)\s*:\s*\w*territoire/i,
  /\bterritoire\w*\s*:[^)]*\)\s*:\s*\w*fuseau/i,
  // Un fuseau découpé pour en tirer autre chose que lui-même.
  /\bfuseau\w*\s*\.\s*(split|slice|substring|startsWith|endsWith|replace)\s*\(/i,
  // Une table de correspondance de l'un vers l'autre.
  /\b(territoire\w*ParFuseau|fuseau\w*ParTerritoire|territoireDu?Fuseau|fuseauDu?Territoire)\b/i,
];

describe("le territoire ne se déduit jamais du fuseau (D46, complément 1)", () => {
  const fichiers = fichiersSource(REPERTOIRES).map((fichier) => ({
    chemin: fichier.chemin,
    contenu: sansCommentaires(fichier.contenu),
  }));

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier ne dérive l'un de l'autre", () => {
    const fautifs = fichiers
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "le territoire et le fuseau sont deux attributs INDÉPENDANTS de " +
        "l'agence (D46) : Europe/Paris couvre plusieurs territoires aux " +
        "fériés différents. Aucun ne se calcule à partir de l'autre.",
    ).toEqual([]);
  });

  it("le gardien détecte réellement une dérivation — éprouvé sur des cas fabriqués", () => {
    const fautif = [
      'const territoire = fuseau.startsWith("Pacific") ? "NC" : "FR";',
      "const territoire = TERRITOIRES[fuseau];",
      'const fuseau = territoire === "NC" ? "Pacific/Noumea" : "Europe/Paris";',
      "const zone = fuseau.split('/')[0];",
      "function territoireDuFuseau(f: string): string { return f; }",
      "const table = { territoireParFuseau };",
    ];
    for (const ligne of fautif) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `non détecté : ${ligne}`,
      ).toBe(true);
    }
  });

  it("le gardien laisse passer la lecture séparée — éprouvé sur des cas fabriqués", () => {
    const licite = [
      "const fuseau = fuseauDeLAgence(agence);",
      "const territoire = agence.territoire;",
      "const { fuseau, territoire } = calendrier;",
      "if (agence.territoire === null) { return null; }",
      "where: { territoire: agence.territoire, date: { gte: du } }",
      "expect(a.territoire).not.toBe(b.territoire);",
    ];
    for (const ligne of licite) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `faux positif : ${ligne}`,
      ).toBe(false);
    }
  });
});

describe("le territoire est un code ISO 3166-1 alpha-2", () => {
  it("chaque agence du jeu de démonstration en porte un", () => {
    const agences = SOCIETES.flatMap((societe) => societe.agences);
    expect(agences.length).toBeGreaterThan(3);

    for (const agence of agences) {
      expect(
        schemaTerritoireValide(agence.territoire),
        `${agence.code} : « ${agence.territoire} » n'est pas un code alpha-2`,
      ).toBe(true);
    }
  });

  it("refuse un nom de territoire ou un fuseau déguisé en territoire", () => {
    for (const faux of [
      "NOUVELLE_CALEDONIE",
      "Nouvelle-Calédonie",
      "Pacific/Noumea",
      "nc",
      "FRA",
      "",
    ]) {
      expect(schemaTerritoireValide(faux), faux).toBe(false);
    }
  });
});

describe("même fuseau, deux territoires, deux jeux de fériés", () => {
  /**
   * Le comportement, et pas seulement la forme. Deux calendriers partagent le
   * fuseau `Europe/Paris` et relèvent de territoires différents : le premier
   * chôme un jour que le second travaille. Un code qui déduirait le territoire
   * du fuseau rendrait ces deux calendriers identiques.
   */
  const VENDREDI_SAINT = "2027-03-26";

  const alsaceMoselle = {
    code: "FR-ALSACE",
    fuseau: "Europe/Paris",
    territoire: "QM",
    plages: [{ jour_semaine: 5, debut_minutes: 480, fin_minutes: 720 }],
    jours_particuliers: appliquerEcarts(
      [{ date: VENDREDI_SAINT, libelle: "Vendredi saint" }],
      [],
    ),
  };

  const resteDeLaMetropole = {
    code: "FR-RESTE",
    fuseau: "Europe/Paris",
    territoire: "QN",
    plages: [{ jour_semaine: 5, debut_minutes: 480, fin_minutes: 720 }],
    jours_particuliers: appliquerEcarts([], []),
  };

  it("le même fuseau ne dit rien des jours chômés", () => {
    const jour = lireCleJour(VENDREDI_SAINT);

    expect(alsaceMoselle.fuseau).toBe(resteDeLaMetropole.fuseau);
    expect(estChome(alsaceMoselle, jour)).toBe(true);
    expect(estChome(resteDeLaMetropole, jour)).toBe(false);
  });
});
