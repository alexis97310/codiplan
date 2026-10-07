import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { colonnesDuRegistre } from "@/app/(back-office)/interventions/presentation";
import { VUES_REGISTRE } from "@/lib/interventions/saisie";

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
 *
 * ## REMPLACÉ PAR TP-UX3-1-REGISTRE-2 (QE-8 (a), D137)
 *
 * `const colonnes = [...]`, le tableau PLAT à huit colonnes mesuré ci-dessus,
 * n'existe plus : la maquette du 28/09/2026
 * (`docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`,
 * D137) REMPLACE celle que ce fichier citait, et dessine un jeu de colonnes
 * DIFFÉRENT par onglet (`colonnesDuRegistre`, `./presentation.ts`). « Machine »
 * et « Site » ne sont plus des colonnes À PART — la première vit dans la
 * cellule « Intervention », la seconde dans « Client · Site », dans l'ordre
 * INVERSE de l'ancienne maquette (Intervention AVANT Client · Site). Les
 * quatre épreuves ci-dessous suivent cette même correction, colonne par
 * colonne, sans rien retirer de ce qu'elles gardaient déjà — `tests/unit/ui/
 * lot-a3.test.ts` porte la mesure complète (avant/après) sur l'onglet
 * « Toutes ».
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
  it("(REMPLACÉ, TP-UX3-1-REGISTRE-2) — « Intervention » (qui restitue la machine) précède toujours « Client · Site », sur chaque vue qui porte les deux", () => {
    for (const vue of [...VUES_REGISTRE, "toutes"] as const) {
      const cles = colonnesDuRegistre(vue).map((c) => c.cle);
      const rangIntervention = cles.indexOf("intervention");
      const rangClientSite = cles.indexOf("client_site");
      expect(rangIntervention, `${vue} — colonne Intervention`).toBeGreaterThan(
        -1,
      );
      expect(rangClientSite, `${vue} — colonne Client · Site`).toBeGreaterThan(
        -1,
      );
      expect(
        rangClientSite,
        `${vue} — Client · Site doit suivre Intervention (ordre INVERSÉ de l'ancienne maquette)`,
      ).toBeGreaterThan(rangIntervention);
    }
  });

  it("(REMPLACÉ, TP-UX3-1-REGISTRE-2) — « Prio. » ouvre « À planifier » et ferme « Toutes », comme la spécification du 28/09 le dessine pour chacune", () => {
    const colonnesAPlanifier = colonnesDuRegistre("a_planifier").map(
      (c) => c.cle,
    );
    expect(colonnesAPlanifier[0]).toBe("prio");

    const colonnesToutes = colonnesDuRegistre("toutes").map((c) => c.cle);
    expect(colonnesToutes.at(-1)).toBe("prio");
  });

  it("(REMPLACÉ, TP-UX3-1-REGISTRE-2) — « Client · Site » (qui porte toujours le site, D128) n'a été retiré d'AUCUNE vue pour ressembler à la maquette", () => {
    for (const vue of [...VUES_REGISTRE, "toutes"] as const) {
      expect(
        colonnesDuRegistre(vue).some((c) => c.cle === "client_site"),
        vue,
      ).toBe(true);
    }
  });

  it("(REMPLACÉ, TP-UX3-1-REGISTRE-2) — chaque ligne porte un badge de priorité, par le composant PARTAGÉ `Priorite` (GR5)", () => {
    expect(SOURCE).toContain("<Priorite valeur={ligne.priorite} court");
    const PRIORITE = readFileSync(
      join(process.cwd(), "components/ui/priorite.tsx"),
      "utf8",
    );
    expect(PRIORITE).toContain("tonDePriorite(");
    for (const priorite of ["p1", "p2"]) {
      expect(TON_PRIORITE, priorite).toContain(`"${priorite}"`);
    }
  });

  it("les machines d'une ligne sans exemplaire affiché rendent le signe d'absence, jamais un vide", () => {
    expect(PRESENTATION).toContain("ligne.machines.length === 0");
    expect(PRESENTATION).toContain("return ABSENT_MACHINE;");
  });

  // LES TROIS KPI DU BANDEAU (« Planifiées cette semaine », « En cours »,
  // « En attente ») ET `kpiDuRegistre` SONT RETIRÉS (TP-UX3-1-REGISTRE-1,
  // QE-8, D174) — les quatre épreuves qui les gardaient sont retirées avec
  // eux, pas désactivées : il n'y a plus rien à garder, les onglets du
  // registre (`components/interventions/onglets-registre.tsx`) portent
  // désormais le même renseignement par leur compteur.
});
