import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE COMPOSITION — les BLOCS de `/parc/[id]` (la fiche machine),
 * confrontés à ceux de `machinePage()` dans `docs/maquette/codiplan-maquette-
 * complete.html` (N-11, D125, D126). Sur le modèle exact de
 * `tests/unit/machines/composition-parc.test.ts` (N-10) — même principe, même
 * marqueur `data-bloc`, même population mesurée plutôt que crue.
 *
 * ## CE QUI N'EST PAS UN BLOC ICI
 *
 * L'en-tête (`eyebrow`, `h1`, sous-titre, les deux boutons) est gardé par
 * `Page` et par `tests/unit/ui/composants-maquette.test.ts` ; le bouton
 * « Modifier » et l'entrée « Identifiant » du `dl.kv` sont des ÉCARTS NOMMÉS
 * (`lib/machines/ecarts-maquette.ts` — `ECARTS_MAQUETTE_ACTIONS_FICHE`,
 * `ECARTS_MAQUETTE_CONTENU_FICHE`) : ce gardien ne les compte pas comme des
 * blocs à rendre. La carte « Documents », qui existe dans l'écran sans
 * exister dans la maquette, est l'écart symétrique
 * (`ECARTS_MAQUETTE_AJOUTS_FICHE`) et n'est pas non plus mesurée ici — elle ne
 * PEUT pas l'être : rien dans `machinePage()` ne la prouve.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/** Le corps de `machinePage()`, borné par `vgp()` qui la suit. */
function fonctionMachinePage(): string {
  const debut = MAQUETTE.indexOf("function machinePage(");
  const fin = MAQUETTE.indexOf("function vgp(){");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "la fonction `machinePage()` est introuvable, ou plus bornée par " +
        "`vgp()` qui la suit — docs/maquette/codiplan-maquette-complete.html " +
        "a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

type BlocAttendu = {
  /** Le nom du marqueur `data-bloc` que le code source doit porter. */
  readonly nom: string;
  /** Le texte ou la classe EXACTE qui prouve le bloc dans `machinePage()`. */
  readonly preuve: string;
};

/**
 * LES ONZE BLOCS DE COMPOSITION DE `machinePage()`, hors en-tête et hors
 * écarts nommés — voir la note de tête.
 */
const BLOCS_ATTENDUS: readonly BlocAttendu[] = [
  { nom: "machine-page", preuve: 'class="machine-page"' },
  { nom: "machine-banner", preuve: 'class="card machine-banner"' },
  { nom: "alert-strip", preuve: 'class="alert-strip"' },
  { nom: "carte-identite", preuve: "Identité et rattachement" },
  { nom: "identite-kv", preuve: '<dl class="kv">' },
  { nom: "carte-historique", preuve: "Historique des interventions" },
  { nom: "historique-ajouter", preuve: 'data-action="new-job"' },
  { nom: "historique-table", preuve: 'class="table"' },
  { nom: "qr-card", preuve: 'class="card qr-card"' },
  { nom: "qr-copier", preuve: 'data-action="copy-id"' },
  { nom: "qr-imprimer", preuve: 'data-action="print-qr"' },
];

/** Les fichiers source qui, ensemble, composent l'écran `/parc/[id]`. */
const SOURCES = [
  "app/(back-office)/parc/[id]/page.tsx",
  "components/ui/maitre-detail.tsx",
  "components/ui/qr-code.tsx",
  "components/machines/actions-qr.tsx",
]
  .map((chemin) => {
    try {
      return readFileSync(join(process.cwd(), chemin), "utf8");
    } catch {
      return "";
    }
  })
  .join("\n");

describe("le gardien de composition — /parc/[id] contre machinePage() de la maquette (N-11, D125, D126)", () => {
  it("a réellement lu onze preuves dans machinePage() — le témoin de non-vacuité", () => {
    const bloc = fonctionMachinePage();
    for (const attendu of BLOCS_ATTENDUS) {
      expect(bloc, attendu.nom).toContain(attendu.preuve);
    }
  });

  it("CHAQUE BLOC ATTENDU PORTE SON MARQUEUR DANS LE CODE SOURCE", () => {
    // Le compte est affiché en cas d'échec — c'est lui que la proposition
    // recopie, avant et après correction (§5.2 du ticket N-10, repris ici).
    //
    // DEUX FORMES DU MÊME MARQUEUR : `data-bloc="X"` littéral (la forme de
    // N-10), OU `bloc="X"` — le prop que `CarteEnTete` et `Kv`
    // (`components/ui/maitre-detail.tsx`) posent sur `data-bloc` à
    // l'exécution, pour que DEUX cartes de cette fiche partagent le même
    // composant sans partager le même marqueur. Un attribut composé à
    // l'exécution (`data-bloc={bloc}`) n'apparaît jamais littéralement dans
    // le texte source — c'est la forme dynamique qui compte ici.
    const rendus = BLOCS_ATTENDUS.filter(
      (bloc) =>
        SOURCES.includes(`data-bloc="${bloc.nom}"`) ||
        SOURCES.includes(`bloc="${bloc.nom}"`),
    );
    expect(
      rendus.map((b) => b.nom),
      `${rendus.length}/${BLOCS_ATTENDUS.length} blocs rendus`,
    ).toEqual(BLOCS_ATTENDUS.map((b) => b.nom));
  });
});
