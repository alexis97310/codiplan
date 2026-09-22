import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  entreesDuSommaire,
  repertoiresAvecLigne,
  regenererBlocSommaire,
  titresDuCorps,
  FORME_LIGNE,
} from "./lib/sommaires";

/**
 * RÉGÉNÈRE les sommaires que ce dépôt tient à jour à la main depuis DOC-1
 * (22/09/2026) — nommé manquant dans sa passation, livré par DOC-2
 * (23/09/2026) : « Un sommaire est un fait calculé, jamais une saisie. »
 *
 * Deux fichiers, deux FORMES (le gardien les confronte déjà dans les deux
 * sens : `tests/unit/docs/constitution-indexee.test.ts`,
 * `tests/unit/docs/readme-indexe.test.ts` ; ce script ne fait que les rendre
 * VRAIS à nouveau quand ils ont dérivé) :
 *
 *   - `docs/constitution/organisation-du-code.md` — sommaire par NUMÉRO DE
 *     LIGNE, recalculé depuis le bloc de code de l'arborescence
 *     (`repertoiresAvecLigne`). Aucun titre Markdown n'est ajouté au bloc :
 *     `tests/unit/docs/organisation-du-code.test.ts` (hors territoire de ce
 *     script) suppose que `§6` tient dans un seul bloc de code.
 *   - `README.md` — sommaire par TITRE, recalculé depuis les titres `##`/`###`
 *     du corps (`titresDuCorps`), à plat, dans l'ordre du document — même
 *     forme que `docs/constitution/erreurs-a-ne-pas-refaire.md`.
 *
 * Idempotent : rejouer sur un fichier déjà à jour ne change rien (vérifié par
 * le gardien, qui resterait vert). Ne touche RIEN d'autre que la zone du
 * sommaire — la note qui la précède, le reste du document, restent
 * octet pour octet identiques.
 *
 * Usage : `pnpm sommaires:regenerer`.
 */

const RACINE = process.cwd();

function regenererParLigne(chemin: string): boolean {
  const absolu = join(RACINE, chemin);
  const avant = readFileSync(absolu, "utf8");
  const entrees = repertoiresAvecLigne(avant).map(
    (r) => `\`${r.chemin}\` — ligne ${r.ligne}`,
  );
  const apres = regenererBlocSommaire(avant, entrees);
  if (apres === avant) {
    process.stdout.write(
      `${chemin} : déjà à jour (${entrees.length} entrées).\n`,
    );
    return false;
  }
  writeFileSync(absolu, apres);
  process.stdout.write(`${chemin} : régénéré (${entrees.length} entrées).\n`);
  return true;
}

function regenererParTitre(
  chemin: string,
  marqueur: string,
  niveaux: [number, number],
): boolean {
  const absolu = join(RACINE, chemin);
  const avant = readFileSync(absolu, "utf8");
  const entrees = titresDuCorps(avant, marqueur, niveaux);
  const apres = regenererBlocSommaire(avant, entrees, marqueur);
  if (apres === avant) {
    process.stdout.write(
      `${chemin} : déjà à jour (${entrees.length} entrées).\n`,
    );
    return false;
  }
  writeFileSync(absolu, apres);
  process.stdout.write(`${chemin} : régénéré (${entrees.length} entrées).\n`);
  return true;
}

// Rappel de la forme, pour qui lit ce fichier sans lire `lib/sommaires.ts` :
// la forme à lignes se reconnaît à `FORME_LIGNE` — importée ici pour que ce
// script échoue à la compilation, pas seulement à l'exécution, si la forme
// venait à diverger de celle du gardien.
void FORME_LIGNE;

let changement = false;
changement =
  regenererParLigne("docs/constitution/organisation-du-code.md") || changement;
changement =
  regenererParTitre("README.md", "## Sommaire", [2, 3]) || changement;

// Témoin de non-vacuité : si un sommaire recalculé était vide, ce ne serait
// pas « à jour », ce serait la preuve que le marqueur a disparu du fichier.
for (const [chemin, marqueur] of [
  ["docs/constitution/organisation-du-code.md", "### Sommaire"],
  ["README.md", "## Sommaire"],
] as const) {
  const texte = readFileSync(join(RACINE, chemin), "utf8");
  if (entreesDuSommaire(texte, marqueur).length === 0) {
    throw new Error(
      `${chemin} : le sommaire régénéré est vide — « ${marqueur} » a-t-il disparu ?`,
    );
  }
}

process.stdout.write(
  changement
    ? "Sommaires régénérés.\n"
    : "Sommaires déjà à jour, rien à écrire.\n",
);
