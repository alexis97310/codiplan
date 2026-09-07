import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyserCablage,
  type Analyse,
} from "../../../scripts/lib/cablage-arbitrages";

/**
 * Ticket R0-b — écart É8 de la revue R0.
 *
 * Neuf règles du chapitre 10 avaient été réécrites par une décision de rang 1
 * sans que le texte bouge. Le mécanisme manquant n'était pas la rigueur, c'était
 * la RÉCIPROCITÉ VÉRIFIABLE : une décision qui prescrit une réécriture sans
 * moyen de constater qu'elle a eu lieu est une décision qu'on croit prise.
 *
 * Ce gardien est ce moyen. Trois précautions, toutes tirées du §9 :
 *
 * 1. LA POPULATION. Il part de TOUTES les règles et de TOUTES les décisions.
 *    Sélectionner « les règles qui portent une mention » exclurait exactement
 *    les neuf règles cassées — la population auto-sélectionnée du 31/08.
 * 2. LES TÉMOINS. Zéro paire, zéro règle, zéro décision, zéro affirmation en
 *    prose sont autant d'échecs : un décompte nul ressemble à un sans-faute.
 * 3. LES ÉPREUVES DANS LES DEUX SENS. Chaque refus a son jumeau qui défait
 *    réellement le câblage, sur les documents réels, et montre l'écart nommé.
 */

const racine = process.cwd();
const CDC = readFileSync(join(racine, "docs/cahier-des-charges.md"), "utf8");
const ARBITRAGES = readFileSync(join(racine, "docs/arbitrages.md"), "utf8");

const analyse: Analyse = analyserCablage(CDC, ARBITRAGES);

/**
 * Planchers. Ils ne se baissent jamais — même mécanique que `EXIGENCES_L0_05`.
 * Ils sont là pour qu'un parseur qui cesse de reconnaître le document échoue au
 * lieu de passer au vert sur une observation vide.
 */
const PLANCHER_REGLES = 40;
const PLANCHER_DECISIONS = 50;
const PLANCHER_PAIRES = 17;
const PLANCHER_PROSE = 15;

/** Le câblage attendu, écrit ici pour être lu — et non déduit du document. */
const CABLAGE_ATTENDU: ReadonlyArray<readonly [string, string]> = [
  ["D6", "RG-PAR-02"],
  ["D9", "RG-PLA-04"],
  ["D15", "RG-IMP-02"],
  ["D16", "RG-INT-01"],
  ["D22", "RG-DRO-02"],
  ["D23", "RG-PLA-05"],
  ["D25", "RG-INT-10"],
  ["D29", "RG-IMP-05"],
  ["D30", "RG-CON-03"],
  ["D32", "RG-DRO-04"],
  ["D40", "RG-DRO-05"],
  ["D47", "RG-PLA-01"],
  ["D47", "RG-PLA-02"],
  ["D52", "RG-DRO-04"],
  ["D53", "RG-DRO-04"],
  ["D54", "RG-IMP-02"],
  ["D55", "RG-DRO-04"],
  // D56 (ticket L1-02) : le temps de trajet est mesuré depuis l'agence de
  // rattachement du site, et il perd son sens si ce rattachement change sans
  // être revu. C'est une réécriture de RG-PLA-05, donc une paire — et c'est ce
  // scénario qui l'a réclamée, pas une relecture.
  ["D56", "RG-PLA-05"],
  // D57 tranche l'arrondi au quart d'heure : PAR INTERVENTION (07/09/2026).
  ["D57", "RG-TAR-05"],
];

describe("câblage bidirectionnel entre le chapitre 10 et les arbitrages", () => {
  it("n'observe aucun écart", () => {
    expect(analyse.ecarts, analyse.ecarts.join("\n")).toEqual([]);
  });

  it("a réellement regardé des règles, des décisions et des paires", () => {
    // Témoins. Sans eux, un parseur devenu aveugle serait vert.
    expect(analyse.regles.length).toBeGreaterThanOrEqual(PLANCHER_REGLES);
    expect(analyse.decisions.length).toBeGreaterThanOrEqual(PLANCHER_DECISIONS);
    expect(analyse.pairesAccordees.length).toBeGreaterThanOrEqual(
      PLANCHER_PAIRES,
    );
    expect(analyse.pairesDepuisRegles.length).toBeGreaterThan(0);
    expect(analyse.pairesDepuisArbitrages.length).toBeGreaterThan(0);
  });

  it("relève les affirmations d'amendement écrites en prose", () => {
    const enProse = analyse.decisions.flatMap((d) =>
      d.reglesAffirmeesEnProse.map((r) => `${d.ref} ↔ ${r}`),
    );
    expect(enProse.length).toBeGreaterThanOrEqual(PLANCHER_PROSE);
  });

  it("câble exactement les paires attendues", () => {
    const observees = analyse.pairesAccordees
      .map((p) => `${p.decision} ↔ ${p.regle}`)
      .sort();
    const attendues = CABLAGE_ATTENDU.map(([d, r]) => `${d} ↔ ${r}`).sort();
    expect(observees).toEqual(attendues);
  });

  it("porte le témoin de son adossement : chaque règle et chaque décision citée existe", () => {
    const refsRegles = new Set(analyse.regles.map((r) => r.ref));
    const refsDecisions = new Set(analyse.decisions.map((d) => d.ref));
    for (const [decision, regle] of CABLAGE_ATTENDU) {
      expect(refsDecisions, `décision inconnue : ${decision}`).toContain(
        decision,
      );
      expect(refsRegles, `règle inconnue : ${regle}`).toContain(regle);
    }
  });
});

/**
 * Les jumeaux. Le contrôle ci-dessus prouve que le câblage tient AUJOURD'HUI ;
 * seuls ceux-ci prouvent qu'il MORD. Chaque rupture est écrite dans le document
 * réel — pas dans un document fabriqué — et l'assertion nomme la paire.
 */
describe("jumeaux — le gardien mord dans les deux sens", () => {
  it("refuse un arbitrage qui nomme une règle sans réciprocité", () => {
    // Rupture réelle : on retire la mention `*(amendée par D6)*` de RG-PAR-02.
    const cdcRompu = CDC.replace(" *(amendée par D6)*", "");
    expect(cdcRompu, "la mention visée n'a pas été retirée").not.toEqual(CDC);

    const rompue = analyserCablage(cdcRompu, ARBITRAGES);
    expect(rompue.ecarts).toContain(
      "D6 déclare amender RG-PAR-02, mais RG-PAR-02 ne cite pas D6 au chapitre 10",
    );
    // La paire disparaît des accords : la violation a bien eu lieu.
    expect(rompue.pairesAccordees.map((p) => p.regle)).not.toContain(
      "RG-PAR-02",
    );
  });

  it("refuse une règle qui nomme un arbitrage sans réciprocité", () => {
    // Rupture réelle : on retire la ligne de déclaration de D6.
    const arbitragesRompus = ARBITRAGES.replace(
      "\n**Règles amendées :** RG-PAR-02\n",
      "\n",
    );
    expect(
      arbitragesRompus,
      "la déclaration visée n'a pas été retirée",
    ).not.toEqual(ARBITRAGES);

    const rompue = analyserCablage(CDC, arbitragesRompus);
    expect(rompue.ecarts).toContain(
      "RG-PAR-02 cite D6, mais D6 ne déclare pas amender RG-PAR-02",
    );
    // Et la prose de D6 continue d'affirmer l'amendement : deuxième prise.
    expect(rompue.ecarts).toContain(
      "D6 affirme en prose amender RG-PAR-02 mais ne la déclare pas — ajouter « **Règles amendées :** RG-PAR-02 »",
    );
  });

  it("refuse une décision qui affirme réécrire une règle sans la déclarer", () => {
    // C'est le défaut d'É8 lui-même : la prose annonce, rien ne suit.
    const arbitragesRompus = ARBITRAGES.replace(
      "\n**Règles amendées :** RG-CON-03\n",
      "\n",
    );
    expect(arbitragesRompus).not.toEqual(ARBITRAGES);

    const rompue = analyserCablage(CDC, arbitragesRompus);
    expect(rompue.ecarts).toContain(
      "D30 affirme en prose amender RG-CON-03 mais ne la déclare pas — ajouter « **Règles amendées :** RG-CON-03 »",
    );
  });

  it("refuse une référence qui ne s'adosse à rien", () => {
    const cdcRompu = CDC.replace(
      "*(amendée par D30)*",
      "*(amendée par D30, D999)*",
    );
    expect(cdcRompu).not.toEqual(CDC);
    expect(analyserCablage(cdcRompu, ARBITRAGES).ecarts).toContain(
      "RG-CON-03 cite D999, qui n'existe pas dans docs/arbitrages.md",
    );

    const arbitragesRompus = ARBITRAGES.replace(
      "**Règles amendées :** RG-CON-03",
      "**Règles amendées :** RG-CON-03, RG-ZZZ-99",
    );
    expect(arbitragesRompus).not.toEqual(ARBITRAGES);
    expect(analyserCablage(CDC, arbitragesRompus).ecarts).toContain(
      "D30 déclare amender RG-ZZZ-99, qui n'existe pas au chapitre 10",
    );
  });

  it("refuse une mention mal formée plutôt que de la lire comme une absence", () => {
    // Forme voisine : celle qu'un rédacteur bien intentionné écrirait.
    const cdcRompu = CDC.replace(
      "*(amendée par D22)*",
      "*(amendée par l'arbitrage D22)*",
    );
    expect(cdcRompu).not.toEqual(CDC);
    const rompue = analyserCablage(cdcRompu, ARBITRAGES);
    expect(rompue.ecarts).toContain(
      "RG-DRO-02 : mention d'amendement mal formée — la forme attendue est « *(amendée par D6, D47 — commentaire)* »",
    );
  });

  it("échoue sur zéro paire observée", () => {
    // Un document vidé de son chapitre 10 ne doit pas passer pour un document
    // sans écart : la vacuité est le mode de défaillance dominant (§9, 30/08).
    const cdcVide = CDC.replace(/^\|\s*RG-[A-Z]{3}-[0-9]{2}\s*\|.*$/gm, "");
    const rompue = analyserCablage(cdcVide, ARBITRAGES);
    expect(rompue.regles).toEqual([]);
    expect(rompue.pairesAccordees).toEqual([]);
    expect(rompue.regles.length).toBeLessThan(PLANCHER_REGLES);
    expect(rompue.pairesAccordees.length).toBeLessThan(PLANCHER_PAIRES);
  });
});
