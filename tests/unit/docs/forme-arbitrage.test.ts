import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SECTIONS_ARBITRAGE,
  ecartsFormeArbitrage,
} from "../../../scripts/lib/forme-arbitrage";
import { RACINE } from "../outils/fichiers-source";

const PROTOCOLE = readFileSync(
  join(RACINE, "docs", "protocole-session.md"),
  "utf8",
);

/**
 * R1-07 — LA FORME IMPOSÉE D'UN PARAGRAPHE D'ARBITRAGE.
 *
 * **Ce que ce gardien garde, et ce qu'il ne garde pas.** *La forme se garde ; le
 * contenu ne se garde pas.* Aucun motif statique ne peut dire si « ce que j'ai
 * mesuré » contient réellement une mesure — mais il peut dire que la section
 * existe, et qu'elle n'a pas été effacée par une réécriture du protocole.
 *
 * **Pourquoi cela vaut un gardien.** Un paragraphe d'arbitrage est **le seul
 * canal** entre une session automatique et Alexis, et il sera lu **sur un
 * téléphone, entre deux rendez-vous, par quelqu'un qui n'a pas le dépôt sous
 * les yeux**. Une section perdue dans une réécriture ne produirait aucun
 * signal : la question suivante serait simplement posée sans dire ce qu'elle
 * coûte, et personne ne saurait qu'il manque quelque chose.
 */
describe("le protocole impose la forme d'un paragraphe d'arbitrage (R1-07)", () => {
  it("les cinq sections y sont, chacune avec sa contrainte", () => {
    const ecarts = ecartsFormeArbitrage(PROTOCOLE);

    expect(
      ecarts,
      "le protocole de session ne porte plus la forme complète d'un " +
        "paragraphe d'arbitrage. C'est le seul canal vers Alexis, et il est lu " +
        "sur un téléphone : une section perdue ne produit aucun signal.",
    ).toEqual([]);
  });

  it("la population n'est pas vide : cinq sections sont exigées", () => {
    // TÉMOIN : un gardien qui n'exige rien passe au vert sans rien regarder.
    expect(SECTIONS_ARBITRAGE.length).toBe(5);
  });

  /**
   * LE CAS QUI DOIT ROUGIR — et il est joué sur le document RÉEL, amputé, pas
   * sur un texte fabriqué (§9, 21/08).
   */
  it("il rougit quand une section disparaît du document réel", () => {
    for (const section of SECTIONS_ARBITRAGE) {
      const ampute = PROTOCOLE.split(section.marque).join("(retiré)");
      const ecarts = ecartsFormeArbitrage(ampute);
      expect(
        ecarts.length,
        `le retrait de « ${section.nom} » n'a fait rougir personne`,
      ).toBeGreaterThan(0);
      expect(ecarts.join("\n")).toContain(section.nom);
    }
  });

  /**
   * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09).
   *
   * Sans lui, le gardien pourrait être vert parce qu'il cherche ses marques
   * n'importe où — y compris dans une phrase qui parle d'autre chose.
   */
  it("il ne se contente pas de trouver les mots quelque part", () => {
    const horsForme =
      "# Un document quelconque\n\n" +
      SECTIONS_ARBITRAGE.map((s) => `On y parle de ${s.nom}.`).join("\n");
    expect(ecartsFormeArbitrage(horsForme).length).toBeGreaterThan(0);
  });
});
