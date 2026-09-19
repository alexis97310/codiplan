import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE REGISTRE DES INTERVENTIONS RESTITUE CE QU'IL LIT DÉJÀ (audit du
 * 18/09/2026) — `priorite` et `machines` étaient lus par `CHAMPS_LIGNE`
 * (`lib/interventions/depot.ts`) et jamais montrés ; le bandeau de trois KPI
 * qu'`interventions()` de la maquette dessine était absent.
 *
 * **Preuve STATIQUE, faute de base joignable dans ce bac à sable** (réseau
 * sortant bloqué vers Neon — voir la proposition) : ce gardien lit le SOURCE
 * de l'écran plutôt que de le rendre, comme `tests/unit/machines/
 * composition-parc.test.ts` le fait déjà pour `/parc`.
 */

const SOURCE = readFileSync(
  join(process.cwd(), "app/(back-office)/interventions/page.tsx"),
  "utf8",
);

describe("le registre des interventions montre la priorité et les machines (audit 18/09/2026)", () => {
  it("la colonne « machine » existe, entre le site et le technicien", () => {
    const ordre = ['cle: "site"', 'cle: "machine"', 'cle: "technicien"'];
    const rangs = ordre.map((motif) => SOURCE.indexOf(motif));
    for (const rang of rangs) {
      expect(rang, "colonne introuvable").toBeGreaterThan(-1);
    }
    expect(rangs[0]).toBeLessThan(rangs[1]!);
    expect(rangs[1]).toBeLessThan(rangs[2]!);
  });

  it("la colonne « priorite » existe, entre la date et le statut", () => {
    const ordre = ['cle: "date"', 'cle: "priorite"', 'cle: "statut"'];
    const rangs = ordre.map((motif) => SOURCE.lastIndexOf(motif));
    for (const rang of rangs) {
      expect(rang, "colonne introuvable").toBeGreaterThan(-1);
    }
    expect(rangs[0]).toBeLessThan(rangs[1]!);
    expect(rangs[1]).toBeLessThan(rangs[2]!);
  });

  it("aucune colonne réelle (Site) n'a été retirée pour ressembler à la maquette (D128)", () => {
    expect(SOURCE).toContain('cle: "site"');
  });

  it("chaque ligne porte un badge de priorité, sur les QUATRE valeurs", () => {
    expect(SOURCE).toContain("TONS_PRIORITE");
    for (const priorite of ["p1", "p2", "p3", "p4"]) {
      expect(SOURCE, priorite).toContain(`${priorite}:`);
    }
  });

  it("les machines d'une ligne sans exemplaire affiché rendent le signe d'absence, jamais un vide", () => {
    expect(SOURCE).toContain("ligne.machines.length === 0");
    expect(SOURCE).toContain("return ABSENT;");
  });

  it("les trois KPI du bandeau sont rendus, avec leurs trois clés du dictionnaire", () => {
    expect(SOURCE).toContain("interventions.kpi_semaine");
    expect(SOURCE).toContain("interventions.kpi_en_cours");
    expect(SOURCE).toContain("interventions.kpi_en_attente");
    // Rendus comme un bandeau FIXE, jamais recalculés depuis les lignes
    // filtrées — la même règle que « sur N machines au total » sur /parc.
    expect(SOURCE).toContain("kpiDuRegistre(contexte)");
  });

  it("les trois KPI comptent un FAIT RÉEL, jamais les valeurs illustratives de la maquette (27, 2, 5)", () => {
    expect(SOURCE).toContain('statut: "en_cours"');
    expect(SOURCE).toContain('statut: "suspendue"');
    expect(SOURCE).toContain(
      "date_planifiee: { gte: debutSemaine, lt: finSemaine }",
    );
  });
});
