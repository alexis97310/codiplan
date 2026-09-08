import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyserBacklog,
  type AnalyseBacklog,
} from "../../../scripts/lib/coherence-backlog";

/**
 * Ticket R0-b — le backlog (rang 4) cite des règles (rang 2) et des décisions
 * (rang 1), et rien ne vérifiait que ce qu'il en dit soit encore vrai.
 *
 * C'est É8 une catégorie plus bas, et il s'était déjà rejoué : L1-08b portait
 * « seul le dernier lot est annulable » après que D54 l'eut supprimé.
 *
 * **Ce que ce gardien tient, et ce qu'il ne tient pas.** La cohérence de sens
 * n'est pas décidable statiquement. Ce qui l'est, c'est que la relecture ait eu
 * lieu contre le TEXTE COURANT : l'estampille d'un ticket est l'empreinte des
 * sources qu'il cite, clôture des amendements comprise. Le gardien ne prouve
 * pas la cohérence — il force la relecture à l'instant où elle est due.
 */

const racine = process.cwd();
const BACKLOG = readFileSync(join(racine, "docs/backlog.md"), "utf8");
const CDC = readFileSync(join(racine, "docs/cahier-des-charges.md"), "utf8");
const ARBITRAGES = readFileSync(join(racine, "docs/arbitrages.md"), "utf8");

const analyse: AnalyseBacklog = analyserBacklog(BACKLOG, CDC, ARBITRAGES);

/**
 * Témoins de vacuité — PAS la parade contre l'auto-sélection : celle-ci est
 * structurelle (voir le module). Ils refusent un parseur devenu aveugle, pour
 * lequel « aucun écart » et « rien de lu » se ressemblent trait pour trait.
 */
const PLANCHER_TICKETS = 40;
const PLANCHER_COUVERTS = 25;
const PLANCHER_SOURCES = 80;

describe("le backlog est cohérent avec les sources qu'il cite", () => {
  it("n'observe aucun écart", () => {
    expect(analyse.ecarts, analyse.ecarts.join("\n")).toEqual([]);
  });

  it("a réellement lu des tickets, des citations et des sources", () => {
    expect(analyse.tickets.length).toBeGreaterThanOrEqual(PLANCHER_TICKETS);
    expect(analyse.couverts.length).toBeGreaterThanOrEqual(PLANCHER_COUVERTS);
    expect(analyse.sourcesConnues.length).toBeGreaterThanOrEqual(
      PLANCHER_SOURCES,
    );
    // Et il reste des tickets NON couverts : c'est l'état normal, assumé par la
    // décision. Zéro ici signifierait que la sélection ne sélectionne plus rien.
    expect(analyse.tickets.length).toBeGreaterThan(analyse.couverts.length);
  });

  it("déplie les plages de règles — c'est le cas qui a motivé le contrôle", () => {
    // « tests sur RG-IMP-01 à 05 » cite RG-IMP-02, la règle que D54 a changée.
    // Sans le dépliage, L1-08b serait resté vert sur la faute même qu'on corrige.
    const l108 = analyse.tickets.find((t) => t.ref === "L1-08b");
    expect(l108?.sourcesCitees).toContain("RG-IMP-02");
    expect(l108?.sourcesCitees).toContain("RG-IMP-05");

    const l207 = analyse.tickets.find((t) => t.ref === "L2-07");
    expect(l207?.sourcesCitees).toContain("RG-INT-10");
  });
});

/**
 * Les jumeaux. Chaque rupture est écrite dans les documents RÉELS, et
 * l'assertion nomme le ticket. Un contrôle vert ne prouve rien tant qu'on n'a
 * pas montré qu'il rougit sur la faute telle qu'elle se commettra.
 */
describe("jumeaux — le gardien mord sur des ruptures réelles", () => {
  it("refuse un ticket dont une RÈGLE citée a changé", () => {
    const cdcRompu = CDC.replace(
      "Chaque chargement est identifié, journalisé et",
      "Chaque chargement est identifié, journalisé, plafonné et",
    );
    expect(cdcRompu, "la règle visée n'a pas été modifiée").not.toEqual(CDC);

    const ecarts = analyserBacklog(BACKLOG, cdcRompu, ARBITRAGES).ecarts;
    const surL108 = ecarts.filter((e) => e.startsWith("L1-08b :"));
    expect(surL108, ecarts.join("\n")).toHaveLength(1);
    expect(surL108[0]).toContain("a CHANGÉ depuis la dernière relecture");
    expect(surL108[0]).toContain("RG-IMP-02");
  });

  it("refuse un ticket dont une DÉCISION citée a changé", () => {
    const arbitragesRompus = ARBITRAGES.replace(
      "**Quatre champs obligatoires**, et non trois",
      "**Cinq champs obligatoires**, et non trois",
    );
    expect(arbitragesRompus).not.toEqual(ARBITRAGES);

    const ecarts = analyserBacklog(BACKLOG, CDC, arbitragesRompus).ecarts;
    expect(ecarts.filter((e) => e.startsWith("L2-01 :"))).toHaveLength(1);
  });

  it("refuse un ticket qu'une décision NON CITÉE rend faux, par la clôture", () => {
    // L'angle mort qu'on ferme : L7-03 cite D32 et jamais D53, or D53 a
    // remplacé le périmètre que D32 énonçait. La clôture par « **Amendé par
    // Dxx.** » fait entrer D53 dans l'empreinte de L7-03.
    const l703 = analyse.tickets.find((t) => t.ref === "L7-03");
    expect(l703?.sourcesCitees).not.toContain("D53");

    const arbitragesRompus = ARBITRAGES.replace(
      "**La décision.** Le périmètre du journal d'audit s'écrit **une seule fois**",
      "**La décision.** Le périmètre du journal d'audit s'écrit **deux fois**",
    );
    expect(arbitragesRompus).not.toEqual(ARBITRAGES);

    const ecarts = analyserBacklog(BACKLOG, CDC, arbitragesRompus).ecarts;
    expect(ecarts.filter((e) => e.startsWith("L7-03 :")), ecarts.join("\n"))
      .toHaveLength(1);
  });

  it("refuse le RETRAIT d'une citation plutôt que de laisser le ticket sortir", () => {
    // Le piège de la population, éprouvé : retirer `[D31]` de L1-08b ne le fait
    // pas quitter le périmètre, cela change l'ensemble de ses sources — donc
    // son empreinte.
    const backlogRompu = BACKLOG.replace(
      "**L1-08b** Le MOTEUR d'import — lecture du classeur, rapport, application, annulation. **[D15] [D31] [D54]**",
      "**L1-08b** Le MOTEUR d'import — lecture du classeur, rapport, application, annulation. **[D15] [D54]**",
    );
    expect(backlogRompu).not.toEqual(BACKLOG);

    const ecarts = analyserBacklog(backlogRompu, CDC, ARBITRAGES).ecarts;
    expect(ecarts.filter((e) => e.startsWith("L1-08b :"))).toHaveLength(1);
  });

  it("refuse une estampille qui ne s'adosse plus à rien", () => {
    // Et les retirer TOUTES ne met pas non plus le ticket à l'abri.
    const backlogRompu = BACKLOG.replace(
      "**L2-08** Interventions multi-machines et multi-techniciens. Machine facultative pour `expertise`, `installation` et **`recensement`** [D16].",
      "**L2-08** Interventions multi-machines et multi-techniciens. Machine facultative pour trois types.",
    );
    expect(backlogRompu).not.toEqual(BACKLOG);

    const ecarts = analyserBacklog(backlogRompu, CDC, ARBITRAGES).ecarts;
    expect(ecarts).toContain(
      "L2-08 porte une estampille mais ne cite aucune règle ni décision — " +
        "l'estampille ne s'adosse à rien : la retirer, ou citer la source relue",
    );
  });

  it("refuse une citation qui ne s'adosse à rien", () => {
    const backlogRompu = BACKLOG.replace(
      "**L2-08** Interventions multi-machines",
      "**L2-08** [D999] Interventions multi-machines",
    );
    expect(backlogRompu).not.toEqual(BACKLOG);
    expect(analyserBacklog(backlogRompu, CDC, ARBITRAGES).ecarts).toContain(
      "L2-08 cite D999, qui n'existe ni au chapitre 10 ni dans docs/arbitrages.md",
    );
  });

  it("refuse une estampille mal formée plutôt que de la lire comme une absence", () => {
    // La forme voisine, celle qu'un rédacteur pressé écrirait.
    const backlogRompu = BACKLOG.replace(
      /^\*Relu contre les sources citées le 01\/09\/2026 — empreinte `88a7dc5a`\.\*$/m,
      "*Relu contre les sources citées le 01/09/2026.*",
    );
    expect(backlogRompu).not.toEqual(BACKLOG);

    const ecarts = analyserBacklog(backlogRompu, CDC, ARBITRAGES).ecarts;
    expect(ecarts.some((e) => e.includes("estampille mal formée"))).toBe(true);
  });

  it("échoue sur un backlog vide plutôt que de le prendre pour un sans-faute", () => {
    const vide = analyserBacklog("# vide\n", CDC, ARBITRAGES);
    expect(vide.tickets).toEqual([]);
    expect(vide.couverts).toEqual([]);
    expect(vide.tickets.length).toBeLessThan(PLANCHER_TICKETS);
    expect(vide.couverts.length).toBeLessThan(PLANCHER_COUVERTS);
  });

  it("échoue si le chapitre 10 devient illisible, en nommant la vraie cause", () => {
    const cdcVide = CDC.replace(/^\| RG-[A-Z]{3}-\d{2} \|.*$/gm, "");
    const ecarts = analyserBacklog(BACKLOG, cdcVide, ARBITRAGES).ecarts;
    expect(ecarts).toContain(
      "aucune règle lue au chapitre 10 : le contrôle ne peut pas s'exercer",
    );
  });
});
