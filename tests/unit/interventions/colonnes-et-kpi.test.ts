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
 *
 * **L'ORDRE Site → Machine ci-dessous a été INVERSÉ par le lot A3 (D125,
 * D128, 19/09/2026)** : la maquette pose Machine juste après Client, et
 * Site (un ajout réel qu'elle ne dessine pas) s'intercalait AVANT Machine —
 * exactement l'inverse. `tests/unit/ui/lot-a3.test.ts` porte la mesure
 * complète (avant/après) ; ce fichier suit la correction, colonne par
 * colonne, sans rien retirer de ce qu'il gardait déjà.
 *
 * **`machinesAffichees` A DÉMÉNAGÉ dans `presentation.ts` (audit du
 * 19/09/2026)** : la fiche d'intervention la réutilise désormais elle aussi
 * (`[id]/page.tsx`), et une seule écriture de « quelles machines, avec quel
 * mot pour zéro » sert les deux écrans plutôt que d'en recopier une
 * cinquième. Le gardien du signe d'absence lit donc `presentation.ts`.
 *
 * **`TONS_PRIORITE` A DÉMÉNAGÉ dans `lib/theme/priorites.ts` (GR5, audit du
 * 26/09/2026, constat G6)** : la même correspondance priorité → ton sert
 * désormais cinq écrans (registre, planning, tableau de bord, demandes,
 * fiche d'intervention), pas seulement celui-ci. Le gardien du badge de
 * priorité lit donc `lib/theme/priorites.ts`, et vérifie ici que le registre
 * appelle bien la fonction partagée plutôt qu'une correspondance locale.
 */

const SOURCE = readFileSync(
  join(process.cwd(), "app/(back-office)/interventions/page.tsx"),
  "utf8",
);
const PRESENTATION = readFileSync(
  join(process.cwd(), "app/(back-office)/interventions/presentation.ts"),
  "utf8",
);
const TON_PRIORITE = readFileSync(
  join(process.cwd(), "lib/theme/priorites.ts"),
  "utf8",
);

describe("le registre des interventions montre la priorité et les machines (audit 18/09/2026)", () => {
  it("la colonne « machine » existe, entre le client et le site (D125/D128, lot A3)", () => {
    const ordre = ['cle: "client"', 'cle: "machine"', 'cle: "site"'];
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

  it("chaque ligne porte un badge de priorité, par la fonction PARTAGÉE (GR5)", () => {
    expect(SOURCE).toContain("tonDePriorite(ligne.priorite)");
    for (const priorite of ["p1", "p2"]) {
      expect(TON_PRIORITE, priorite).toContain(`"${priorite}"`);
    }
  });

  it("les machines d'une ligne sans exemplaire affiché rendent le signe d'absence, jamais un vide", () => {
    expect(PRESENTATION).toContain("ligne.machines.length === 0");
    expect(PRESENTATION).toContain("return ABSENT_MACHINE;");
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
    expect(SOURCE).toContain(
      "date_planifiee: { gte: debutSemaine, lt: finSemaine }",
    );
    // « En cours » et « En attente » RÉUTILISENT `compterParVue`
    // (99V-GR6-TUILES) plutôt qu'un second `client: { actif: true } }`
    // littéral : le même critère que l'onglet qu'elles nomment, jamais une
    // seconde lecture (gardien R3-12).
    expect(SOURCE).toContain("compterParVue(contexte, CRITERES_REGISTRE_VIDE)");
    expect(SOURCE).toContain("enCours: comptesVueVides.en_cours");
    expect(SOURCE).toContain("enAttente: comptesVueVides.bloquees");
  });

  it("« En cours » et « En attente » mènent à l'onglet qu'elles comptent, sans les autres filtres (99V-GR6-TUILES)", () => {
    // Un lien NU — une chaîne littérale, jamais `hrefOnglet(parametresActifs,
    // ...)` : la portée de ces KPI reste FIXE, indépendante des filtres
    // actifs, à la différence des onglets de navigation plus bas.
    expect(SOURCE).toContain('href="/interventions?vue=en_cours"');
    expect(SOURCE).toContain('href="/interventions?vue=bloquees"');
  });

  it("AUCUN lien doublon sous ces deux tuiles — la tuile elle-même est le seul chemin (décision du 30/09/2026, point 12 ; D144)", () => {
    expect(SOURCE).not.toContain("interventions.lien_kpi_en_cours");
    expect(SOURCE).not.toContain("interventions.lien_kpi_en_attente");
  });
});
