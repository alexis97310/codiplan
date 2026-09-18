import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE COMPOSITION — les BLOCS de `/parc`, confrontés à ceux de
 * `parc()` dans `docs/maquette/codiplan-maquette-complete.html` (N-10, D125).
 *
 * ## Ce que les autres gardiens de la maquette ne couvrent pas
 *
 * `tests/unit/ui/composants-maquette.test.ts` confronte des MESURES — une
 * taille de police, un rembourrage. `tests/unit/machines/ecarts-maquette.
 * test.ts` confronte des LIBELLÉS — un nom de bouton, un champ du `dl.kv`.
 * Ni l'un ni l'autre ne dit si un bloc ENTIER existe : un écran pourrait
 * porter tous les bons rembourrages et tous les bons libellés sans jamais
 * assembler de maître-détail. C'est exactement l'angle mort qui a laissé
 * `/parc` rester un tableau pendant que `parc()` dessinait autre chose.
 *
 * ## Comment la confrontation se fait, sans rendre l'écran
 *
 * Rendre `/parc` demande une base, une session, un contexte cloisonné —
 * hors de portée d'un test unitaire (c'est le travail de `tests/e2e/parc.
 * spec.ts`). Ce gardien confronte donc deux TEXTES : celui de `parc()` dans
 * la maquette, et celui des fichiers source qui composent l'écran. Chaque
 * bloc attendu porte un marqueur `data-bloc="<nom>"` dans le JSX — le même
 * principe que `data-motif` (messages) ou `data-bloc` (grille du planning)
 * ailleurs dans ce dépôt : un repère qu'un gardien peut lire SANS dépendre
 * de la classe Tailwind exacte, qui n'a pas à ressembler à celle de la
 * maquette (D124 ne régit que les jetons, jamais les noms de classes).
 *
 * ## LA POPULATION EST CELLE MESURÉE, PAS CELLE QU'ON CROIT AVOIR ÉCRITE
 *
 * Chaque bloc de `BLOCS_ATTENDUS` porte le TEXTE OU LA CLASSE EXACTE que
 * `parc()` écrit — un `it` de non-vacuité le vérifie avant toute
 * confrontation, sur le modèle d'AT-04 : deux côtés aveugles ensemble
 * s'accordent parfaitement, et la comparaison ne prouverait rien.
 *
 * ## CE QUI N'EST PAS UN BLOC ICI
 *
 * L'en-tête (`eyebrow`, `h1`, sous-titre) est déjà gardé par `Page` et par
 * `tests/unit/ui/composants-maquette.test.ts` ; les deux boutons d'action et
 * l'entrée « Contrat » du `dl.kv` sont des ÉCARTS NOMMÉS
 * (`lib/machines/ecarts-maquette.ts`) : ce gardien ne les compte pas comme
 * des blocs à rendre, il les laisse à la liste qui les motive.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/**
 * Le corps de `parc()`, ÉTENDU à `machineRow()` et `machinePreview()` —
 * les deux fonctions qu'elle appelle pour composer le maître-détail, bornées
 * par `machinePage()` qui les suit. Sans cette extension, `.detail-hero`,
 * `.kv` et `.timeline` — écrits dans `machinePreview()` — resteraient hors
 * de portée d'un gardien qui ne lirait que `parc()` au sens strict.
 */
function fonctionParc(): string {
  const debut = MAQUETTE.indexOf("function parc(){");
  const fin = MAQUETTE.indexOf("function machinePage(");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "la fonction `parc()` est introuvable, ou plus bornée par " +
        "`machinePage()` qui la suit — docs/maquette/codiplan-maquette-" +
        "complete.html a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

type BlocAttendu = {
  /** Le nom du marqueur `data-bloc` que le code source doit porter. */
  readonly nom: string;
  /** Le texte ou la classe EXACTE qui prouve le bloc dans `parc()`. */
  readonly preuve: string;
};

/**
 * LES TREIZE BLOCS DE COMPOSITION DE `parc()`, hors en-tête et hors écarts
 * nommés — voir la note de tête. `nom` est arbitraire (c'est notre
 * vocabulaire d'implémentation) ; `preuve` ne l'est pas.
 */
const BLOCS_ATTENDUS: readonly BlocAttendu[] = [
  { nom: "toolbar", preuve: 'class="toolbar"' },
  { nom: "recherche", preuve: 'class="search"' },
  { nom: "filtre-statut", preuve: 'id="machine-status"' },
  { nom: "reinitialiser", preuve: 'data-action="reset-machines"' },
  { nom: "kpi-affichees", preuve: "Machines affichées" },
  { nom: "kpi-garantie", preuve: "Garanties < 90 jours" },
  { nom: "kpi-en-panne", preuve: "En panne ou arrêtées" },
  { nom: "maitre-detail", preuve: 'class="master-detail"' },
  { nom: "liste-machines", preuve: "machine-list" },
  { nom: "apercu-hero", preuve: 'class="detail-hero"' },
  { nom: "apercu-kv", preuve: '<dl class="kv">' },
  { nom: "apercu-timeline", preuve: 'class="timeline"' },
  { nom: "etat-vide", preuve: 'class="card empty"' },
];

/** Les fichiers source qui, ensemble, composent l'écran `/parc`. */
const SOURCES = [
  "app/(back-office)/parc/page.tsx",
  "components/ui/maitre-detail.tsx",
]
  .map((chemin) => {
    try {
      return readFileSync(join(process.cwd(), chemin), "utf8");
    } catch {
      return "";
    }
  })
  .join("\n");

describe("le gardien de composition — /parc contre parc() de la maquette (N-10, D125)", () => {
  it("a réellement lu treize preuves dans parc() — le témoin de non-vacuité", () => {
    const bloc = fonctionParc();
    for (const attendu of BLOCS_ATTENDUS) {
      expect(bloc, attendu.nom).toContain(attendu.preuve);
    }
  });

  it("CHAQUE BLOC ATTENDU PORTE SON MARQUEUR DANS LE CODE SOURCE", () => {
    // Le compte est affiché en cas d'échec — c'est lui que la proposition
    // recopie, avant et après correction (§5.2 du ticket N-10).
    const rendus = BLOCS_ATTENDUS.filter((bloc) =>
      SOURCES.includes(`data-bloc="${bloc.nom}"`),
    );
    expect(
      rendus.map((b) => b.nom),
      `${rendus.length}/${BLOCS_ATTENDUS.length} blocs rendus`,
    ).toEqual(BLOCS_ATTENDUS.map((b) => b.nom));
  });
});
