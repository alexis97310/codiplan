import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * Gardien n°1 du ticket L0-07 : **la fonction de conversion n'est atteignable
 * que depuis `lib/reporting`.**
 *
 * C'est la traduction exécutable de l'invariant I2 et de l'arbitrage D19
 * (« un test du gardien monétaire vérifie qu'aucun appel à
 * `convertForConsolidation` n'existe hors de `lib/reporting` »). Convertir
 * ligne à ligne ferait varier une facture au gré d'un taux : RG-TAR-02
 * l'interdit, et aucune signature ne peut l'empêcher — seule la lecture du
 * dépôt le peut.
 *
 * **Périmètre.** Les chemins APPLICATIFS. `tests/` en est exclu, comme pour le
 * gardien de la connexion de consolidation : les scénarios doivent pouvoir
 * éprouver la conversion, faute de quoi elle ne serait prouvée nulle part. Un
 * appel dans un test ne convertit aucune facture.
 *
 * **Mention et usage.** Les motifs ci-dessous visent l'usage — un appel, un
 * import — et non la simple mention : `lib/money/index.ts` explique en
 * commentaire pourquoi `marquerConsolide` n'y est pas réexportée, et c'est
 * exactement ce qu'on attend de lui.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Le seul répertoire autorisé à convertir (CLAUDE.md §6, I2). */
const TITULAIRE = "lib/reporting/";

/**
 * Le module qui DÉFINIT le marqueur de montant consolidé. Il ne convertit rien :
 * il donne son nom au résultat d'une conversion, et doit bien l'écrire quelque
 * part.
 */
const EXEMPTS = ["lib/money/consolide.ts"];

const MARQUEURS: readonly RegExp[] = [
  // Un appel, ou une déclaration générique — pas une mention en prose.
  /\bconvertForConsolidation\s*[(<]/,
  /\bresoudreParites\s*[(<]/,
  /\bmarquerConsolide\s*[(<]/,
  /from\s+["'][^"']*lib\/reporting\/consolidation["']/,
];

describe("la conversion de devise est réservée à lib/reporting (I2, D19)", () => {
  const fichiers = fichiersSource(REPERTOIRES).filter(
    (fichier) => !EXEMPTS.includes(fichier.chemin),
  );

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier hors de lib/reporting ne convertit", () => {
    const fautifs = fichiers
      .filter((fichier) => !fichier.chemin.startsWith(TITULAIRE))
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "une conversion de devise existe hors de lib/reporting : les montants " +
        "ne sont jamais convertis ligne à ligne (I2, RG-TAR-02)",
    ).toEqual([]);
  });

  it("lib/reporting, lui, convertit bien — le gardien porte sur quelque chose", () => {
    const titulaires = fichiers.filter(
      (fichier) =>
        fichier.chemin.startsWith(TITULAIRE) &&
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
    );

    expect(titulaires.map((fichier) => fichier.chemin)).toContain(
      "lib/reporting/consolidation.ts",
    );
  });

  it("le gardien détecte réellement un appel — éprouvé sur un cas fabriqué", () => {
    // Sans cette contre-épreuve, une expression régulière fautive rendrait le
    // gardien silencieux et vert pour toujours.
    const fautif = [
      "const total = convertForConsolidation(agregat, XPF, EUR, parites);",
      'import { convertForConsolidation } from "@/lib/reporting/consolidation";',
      "const marque = marquerConsolide(valeur, code, date);",
      "const p = resoudreParites(lignes, base, date);",
    ];
    for (const ligne of fautif) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `non détecté : ${ligne}`,
      ).toBe(true);
    }
  });

  it("le gardien laisse passer la simple mention — éprouvé sur un cas fabriqué", () => {
    const licite = [
      " * `marquerConsolide` n'est volontairement pas réexportée ici.",
      " * La conversion vit dans convertForConsolidation, et nulle part ailleurs.",
    ];
    for (const ligne of licite) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `faux positif : ${ligne}`,
      ).toBe(false);
    }
  });
});
