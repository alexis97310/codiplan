import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * Gardien n°3 du ticket L0-07 : **aucun nombre de décimales écrit en dur**, et
 * aucun formatage monétaire hors de `lib/money`.
 *
 * C'est l'invariant I3 rendu exécutable : « XPF : zéro décimale. EUR : deux.
 * Jamais de `toFixed(2)` en dur. Tout formatage passe par
 * `formatMoney(montant, devise)` ». La règle RG-TAR-03 dit d'où vient le
 * nombre : de la devise. Un `toFixed(2)` isolé produit `7000,00 XPF` sur une
 * facture calédonienne, et personne ne s'en aperçoit avant le client.
 *
 * Le formatage par la locale est visé au même titre : `Intl.NumberFormat` et
 * `toLocaleString` tirent le nombre de décimales d'ICU, c'est-à-dire du code
 * ISO de la devise tel qu'ICU le connaît — pas de la table `devise`, qui reste
 * ouverte (chapitre 4.3). Deux sources pour une même donnée, c'est déjà une
 * divergence en attente.
 *
 * **Périmètre.** Les chemins applicatifs. `lib/money/` est le point de passage
 * unique que I3 institue : c'est là, et là seulement, que le nombre de
 * décimales se lit et s'applique. `prisma/seed-data.ts` amorce la table
 * `devise` et porte donc, légitimement, les décimales de chaque devise.
 * `tests/` est hors périmètre : les scénarios doivent pouvoir fabriquer une
 * devise à trois décimales, ce que fait `tests/unit/money/format.test.ts`.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Le point de passage unique (I3), et le seed du référentiel qu'il consulte. */
const EXEMPTS_PREFIXES = ["lib/money/"];
const EXEMPTS_FICHIERS = ["prisma/seed-data.ts"];

const MARQUEURS: readonly RegExp[] = [
  // L'arrondi d'affichage fait main.
  /\.toFixed\s*\(/,
  // Le formatage par la locale.
  /\bIntl\.NumberFormat\b/,
  /\.toLocaleString\s*\(/,
  /\b(minimum|maximum)FractionDigits\b/,
  /style\s*:\s*["']currency["']/,
  // Un nombre de décimales AFFECTÉ depuis un littéral. Le `=` non suivi d'un
  // second écarte les comparaisons : lire `devise.decimales === 0` est
  // exactement ce qu'on demande au code de faire.
  /\bdecimales\s*(:|=(?!=))\s*[0-9]/,
];

describe("aucun nombre de décimales en dur (I3, RG-TAR-03)", () => {
  const fichiers = fichiersSource(REPERTOIRES).filter(
    (fichier) =>
      !EXEMPTS_FICHIERS.includes(fichier.chemin) &&
      !EXEMPTS_PREFIXES.some((prefixe) => fichier.chemin.startsWith(prefixe)),
  );

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier applicatif ne fixe lui-même les décimales d'un montant", () => {
    const fautifs = fichiers
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "un nombre de décimales est écrit en dur : il est une propriété de la " +
        "devise, et tout formatage passe par formatMoney (I3)",
    ).toEqual([]);
  });

  it("le gardien détecte réellement un formatage en dur — éprouvé sur des cas fabriqués", () => {
    const fautif = [
      "const affiche = `${(montant / 100).toFixed(2)} €`;",
      'const f = new Intl.NumberFormat("fr-FR", { style: "currency" });',
      "const texte = valeur.toLocaleString();",
      "const options = { minimumFractionDigits: 2 };",
      "const decimales = 2;",
      "const devise = { code, decimales: 0 };",
    ];
    for (const ligne of fautif) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `non détecté : ${ligne}`,
      ).toBe(true);
    }
  });

  it("le gardien laisse passer la lecture du référentiel — éprouvé sur des cas fabriqués", () => {
    const licite = [
      "const unite = uniteParDevise(devise);",
      "return formatMoney(total, devise);",
      "if (devise.decimales === 0) {",
      "const { decimales } = devise;",
    ];
    for (const ligne of licite) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `faux positif : ${ligne}`,
      ).toBe(false);
    }
  });
});
