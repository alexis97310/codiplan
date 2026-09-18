import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ECARTS_MAQUETTE_ACTIONS_ABSENCES } from "@/lib/absences/ecarts-maquette";

/**
 * LE GARDIEN DE COMPOSITION — LOT A1+A4, `/tableau-de-bord` et `/absences`
 * contre `dashboard()` et `absences()` de `codiplan-maquette-complete.html`
 * (D125).
 *
 * Même principe que `tests/unit/machines/composition-parc.test.ts` (N-10) :
 * deux TEXTES confrontés, jamais un rendu — chaque bloc attendu porte un
 * marqueur `data-bloc="<nom>"` dans le JSX source, lu ici sans dépendre de la
 * classe Tailwind exacte.
 *
 * **Ce qui N'EST PAS un bloc ici** : l'en-tête (`eyebrow`, `h1`, sous-titre)
 * est gardé par `Page` et par `tests/unit/ui/composants-maquette.test.ts` ;
 * le bouton « + Déclarer une absence » de `head()` de `absences()` est un
 * ÉCART NOMMÉ (voir le docblock de `app/(back-office)/absences/page.tsx`) —
 * un bouton de CRÉATION n'entre jamais dans les actions de `Page` (§2 de
 * `ActionPrimaire`), et ce gardien ne le compte donc pas comme un bloc à
 * rendre.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

function fonctionMaquette(debutMarqueur: string, finMarqueur: string): string {
  const debut = MAQUETTE.indexOf(debutMarqueur);
  const fin = MAQUETTE.indexOf(finMarqueur);
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      `\`${debutMarqueur}\` est introuvable, ou plus bornée par \`${finMarqueur}\` — ` +
        "docs/maquette/codiplan-maquette-complete.html a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

type BlocAttendu = {
  readonly nom: string;
  readonly preuve: string;
};

function lireSources(chemins: readonly string[]): string {
  return chemins
    .map((chemin) => {
      try {
        return readFileSync(join(process.cwd(), chemin), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

function gardienDeComposition(
  nomEcran: string,
  bloc: string,
  blocsAttendus: readonly BlocAttendu[],
  sources: string,
) {
  describe(`le gardien de composition — ${nomEcran} (lot A1+A4, D125)`, () => {
    it(`a réellement lu ${blocsAttendus.length} preuves — le témoin de non-vacuité`, () => {
      for (const attendu of blocsAttendus) {
        expect(bloc, attendu.nom).toContain(attendu.preuve);
      }
    });

    it("CHAQUE BLOC ATTENDU PORTE SON MARQUEUR DANS LE CODE SOURCE", () => {
      // Le compte est affiché en cas d'échec — c'est lui que la proposition
      // recopie, avant et après correction.
      const rendus = blocsAttendus.filter((b) =>
        sources.includes(`data-bloc="${b.nom}"`),
      );
      expect(
        rendus.map((b) => b.nom),
        `${rendus.length}/${blocsAttendus.length} blocs rendus`,
      ).toEqual(blocsAttendus.map((b) => b.nom));
    });
  });
}

// ── TABLEAU DE BORD — dashboard() ─────────────────────────────────────────

const BLOC_DASHBOARD = fonctionMaquette(
  "function dashboard(){",
  "function absences(){",
);

const BLOCS_DASHBOARD: readonly BlocAttendu[] = [
  { nom: "action-planning", preuve: "Ouvrir le planning" },
  { nom: "kpi-grille", preuve: 'class="grid g4"' },
  { nom: "kpi-interventions", preuve: "Interventions aujourd’hui" },
  { nom: "kpi-occupation", preuve: "Taux d’occupation" },
  { nom: "kpi-bloques", preuve: "Dossiers bloqués" },
  { nom: "kpi-vgp", preuve: "VGP à prévoir" },
  { nom: "priorites", preuve: "Priorités opérationnelles" },
  { nom: "priorites-filtre", preuve: 'id="priority-filter"' },
  { nom: "priorites-liste", preuve: 'id="priority-list"' },
  { nom: "activite", preuve: "Activité récente" },
];

gardienDeComposition(
  "/tableau-de-bord contre dashboard()",
  BLOC_DASHBOARD,
  BLOCS_DASHBOARD,
  lireSources([
    "app/(back-office)/tableau-de-bord/page.tsx",
    "components/mise-en-page/page.tsx",
  ]),
);

// ── ABSENCES — absences() ─────────────────────────────────────────────────

const BLOC_ABSENCES = fonctionMaquette(
  "function absences(){",
  "function clients(){",
);

const BLOCS_ABSENCES: readonly BlocAttendu[] = [
  { nom: "kpi-grille", preuve: 'class="grid g3"' },
  { nom: "kpi-absences-mois", preuve: "Absences ce mois" },
  { nom: "kpi-rupture", preuve: "Rupture de service" },
  { nom: "kpi-demandes-valider", preuve: "Demandes à valider" },
  { nom: "calendrier", preuve: 'class="calendar"' },
  { nom: "calendrier-nav", preuve: 'class="actions"' },
  { nom: "calendrier-pastille", preuve: 'class="leave"' },
];

gardienDeComposition(
  "/absences contre absences()",
  BLOC_ABSENCES,
  BLOCS_ABSENCES,
  lireSources(["app/(back-office)/absences/page.tsx"]),
);

describe("l'écart nommé de l'action d'en-tête d'absences() (D128)", () => {
  it("la maquette dessine RÉELLEMENT le bouton que l'écart nomme", () => {
    for (const ecart of ECARTS_MAQUETTE_ACTIONS_ABSENCES) {
      expect(BLOC_ABSENCES, ecart.libelle).toContain(
        `>${ecart.libelle}</button>`,
      );
    }
  });

  it("la liste est CLOSE : une seule action de tête, et c'est celle-ci", () => {
    const boutons = [
      ...BLOC_ABSENCES.matchAll(/<button[^>]*>([^<]+)<\/button>/g),
    ]
      .map((m) => m[1].trim())
      // Les boutons de navigation du calendrier (‹, Aujourd'hui, ›) sont un
      // bloc à part, gardé par `BLOCS_ABSENCES` (`calendrier-nav`) — jamais
      // une action d'EN-TÊTE au sens de `head()`.
      .filter((libelle) => !["‹", "Aujourd’hui", "›"].includes(libelle));
    expect(boutons).toEqual(
      ECARTS_MAQUETTE_ACTIONS_ABSENCES.map((e) => e.libelle),
    );
  });
});
