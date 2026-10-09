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
 * est gardé par `Page` et par `tests/unit/ui/composants-maquette.test.ts`.
 * Le bouton « + Déclarer une absence » de `head()` de `absences()` ÉTAIT un
 * écart nommé jusqu'au 9EC-TP-UX3-E-ABSENCES (D175) — c'est désormais un GAP
 * COMBLÉ (même geste que « + Machine », `lib/machines/ecarts-maquette.ts`),
 * gardé plus bas dans ce fichier, jamais comme un bloc de `gardienDeComposition`.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/**
 * LE TABLEAU DE BORD LIT DÉSORMAIS LA MAQUETTE DU 28/09
 * (9EG-TP-UX6-TABLEAU-DE-BORD-1, D185) — `route("/tableau-de-bord", ...)` de
 * `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`
 * remplace `dashboard()` de l'ancienne maquette (QE-13a, D137) : l'écran est
 * reconstruit selon le rôle, et les marqueurs ci-dessous visent les tuiles,
 * la bande et les blocs qu'elle dessine, jamais les quatre tuiles fixes de
 * l'ancienne page.
 */
const MAQUETTE_28_09 = readFileSync(
  join(
    process.cwd(),
    "docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html",
  ),
  "utf8",
);

function fonctionMaquette(
  debutMarqueur: string,
  finMarqueur: string,
  source: string = MAQUETTE,
): string {
  const debut = source.indexOf(debutMarqueur);
  const fin = source.indexOf(finMarqueur);
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      `\`${debutMarqueur}\` est introuvable, ou plus bornée par \`${finMarqueur}\` — ` +
        "la maquette a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return source.slice(debut, fin);
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

// ── TABLEAU DE BORD — route("/tableau-de-bord", ...) de la maquette du 28/09
//    (QE-7 (a), D185) ─────────────────────────────────────────────────────

const BLOC_DASHBOARD = fonctionMaquette(
  "/* ═══ Tableau de bord ═",
  "/* ═══ Indicateurs du mois",
  MAQUETTE_28_09,
);

const BLOCS_DASHBOARD: readonly BlocAttendu[] = [
  { nom: "action-planning", preuve: "Ouvrir le planning" },
  { nom: "kpi-grille", preuve: '<div class="tiles">' },
  { nom: "kpi-a-planifier", preuve: 'label: "À planifier"' },
  { nom: "kpi-aujourdhui", preuve: 'label: "Aujourd\'hui"' },
  { nom: "kpi-en-retard", preuve: 'label: "En retard"' },
  { nom: "kpi-a-controler", preuve: 'label: "À contrôler"' },
  { nom: "kpi-suspendues", preuve: 'label: "Suspendues"' },
  { nom: "priorites-et-blocs", preuve: "Priorités opérationnelles" },
  { nom: "priorites-liste", preuve: 'class="mini-list"' },
  { nom: "activite", preuve: "Interventions sans durée" },
];

gardienDeComposition(
  '/tableau-de-bord contre route("/tableau-de-bord") de la maquette du 28/09',
  BLOC_DASHBOARD,
  BLOCS_DASHBOARD,
  lireSources(["app/(back-office)/tableau-de-bord/page.tsx"]),
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

/** Les libellés des `<button>` posés par `head()` dans `absences()` — même repère que `machines/ecarts-maquette.test.ts`. */
function actionsDeLaMaquetteAbsences(): string[] {
  return (
    [...BLOC_ABSENCES.matchAll(/<button[^>]*>([^<]+)<\/button>/g)]
      .map((m) => m[1].trim())
      // Les boutons de navigation du calendrier (‹, Aujourd'hui, ›) sont un
      // bloc à part, gardé par `BLOCS_ABSENCES` (`calendrier-nav`) — jamais
      // une action d'EN-TÊTE au sens de `head()`.
      .filter((libelle) => !["‹", "Aujourd’hui", "›"].includes(libelle))
  );
}

describe("l'action d'en-tête d'absences() dit ce que la maquette dit (D125, D175)", () => {
  it("a réellement lu une action — le témoin de non-vacuité", () => {
    expect(actionsDeLaMaquetteAbsences()).toEqual(["+ Déclarer une absence"]);
  });

  it("la liste est VIDE : « + Déclarer une absence » est un GAP COMBLÉ (9EC-TP-UX3-E-ABSENCES, D175)", () => {
    expect(ECARTS_MAQUETTE_ACTIONS_ABSENCES).toEqual([]);
  });

  it("« + Déclarer une absence » n'est plus un écart SANS être un lien réel — elle ouvre le volet via ?declarer=1", () => {
    // Le témoin inverse de « aucune action non couverte » : depuis que le
    // volet (`components/ui/volet.tsx`) existe, « + Déclarer une absence »
    // n'a plus besoin d'un écart pour ne pas se lire comme une panne — elle
    // est retirée de la liste ET rendue comme un vrai geste
    // (`app/(back-office)/absences/page.tsx`, `?declarer=1`), jamais l'un
    // sans l'autre.
    const source = readFileSync(
      join(process.cwd(), "app/(back-office)/absences/page.tsx"),
      "utf8",
    );
    expect(source).toContain("?declarer=1");
    const ecartees = new Set(
      ECARTS_MAQUETTE_ACTIONS_ABSENCES.map((e) => e.libelle),
    );
    expect(ecartees.has("+ Déclarer une absence")).toBe(false);

    const nonCouvertes = actionsDeLaMaquetteAbsences().filter(
      (libelle) =>
        libelle !== "+ Déclarer une absence" && !ecartees.has(libelle),
    );
    expect(nonCouvertes).toEqual([]);
  });
});
