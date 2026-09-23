import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * TABLEAU-1 (23/09/2026) — LE TABLEAU DE BORD NE MONTRE PLUS DE JARGON
 * INTERNE NI DE CASE VIDE.
 *
 * Deux zones mesurées en ligne le 23/09 : la tuile « Taux d'occupation »
 * portait la référence de ticket interne « R2-13 », et la carte « Activité
 * récente » citait l'invariant « I8 » et disait en toutes lettres qu'elle
 * n'affichait rien. Ni l'un ni l'autre n'apporte quoi que ce soit à un
 * opérateur qui lit l'écran.
 *
 * Ce gardien lit les VALEURS du dictionnaire — ce qu'un humain voit —, jamais
 * les commentaires du code source : c'est la coupure de L0-11, *la
 * destination du texte qui décide*. « R2-13 » et « I8 » restent légitimes
 * dans un commentaire qui explique une décision ; ils ne le sont plus dans
 * une chaîne qu'un écran affiche.
 */
describe("le tableau de bord n'affiche plus de jargon interne (TABLEAU-1)", () => {
  const valeursDuTableauDeBord = Object.entries(fr)
    .filter(([cle]) => cle.startsWith("tableau_de_bord."))
    .map(([, valeur]) => valeur);

  it("réellement lu des valeurs — témoin de non-vacuité", () => {
    expect(valeursDuTableauDeBord.length).toBeGreaterThan(0);
  });

  it("aucune valeur ne cite un ticket ou un invariant interne (« R2-13 », « I8 »)", () => {
    const fautives = valeursDuTableauDeBord.filter(
      (valeur) => /R2-13/.test(valeur) || /\bI8\b/.test(valeur),
    );
    expect(fautives).toEqual([]);
  });

  it("aucune valeur ne dit plus qu'elle n'affiche rien (« Aucune activité… »)", () => {
    const fautives = valeursDuTableauDeBord.filter((valeur) =>
      /Aucune activit.* n'est encore rejou/.test(valeur),
    );
    expect(fautives).toEqual([]);
  });

  it("ÉPREUVE — le gardien reconnaît bien la forme qu'il refuse", () => {
    expect(/R2-13/.test("Pas de règle de consolidation (R2-13).")).toBe(true);
    expect(
      /Aucune activit.* n'est encore rejou/.test(
        "Aucune activité n'est encore rejouée ici : rien dans CODIPLAN…",
      ),
    ).toBe(true);
  });
});
