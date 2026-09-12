import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SURFACE_DECRAN,
  empreintePhotographiee,
  etatDeLaSurface,
  rapportDeLaSurface,
  type EtatDeLaSurface,
} from "./lib/surface-decran";

/**
 * LES ÉCRANS ONT-ILS CHANGÉ DEPUIS LA PRISE DE VUE ? (R1-02)
 *
 * **Ce qu'il répare.** Le README des captures nomme le commit photographié —
 * c'est la règle du §9 du 09/09. Il ne disait pas comment savoir qu'aucun écran
 * n'a bougé depuis, et la commande qui le dit *était tapée à la main, donc pas
 * tapée*. La voici : `pnpm captures:etat`.
 *
 * **CE QUI SORT EST UN ÉTAT, JAMAIS UN SILENCE.** Trois verdicts, et le
 * troisième est celui qu'on oublie : un dépôt cloné en profondeur 1 ne connaît
 * pas l'empreinte photographiée. Sans ce troisième cas, `git diff` échouerait
 * ou rendrait une liste vide, et **« je ne sais pas » se lirait « rien n'a
 * changé »** — le silence qui a exactement la forme du succès (§9, 31/08).
 *
 * **CE N'EST PAS UNE PORTE, et le code de sortie le dit.** Un écran change
 * entre deux prises : c'est le cours ordinaire du travail, pas une faute.
 * Rougir là-dessus ferait un gardien dont les fausses alertes conduisent à ne
 * plus le lire (§9, 11/09) — et ce contrôle n'existe que pour être lu. Il sort
 * donc en **0 quand la question est RÉPONDUE**, quelle que soit la réponse, et
 * en **1 quand elle ne l'est pas**. *Sa panne à lui est « je n'ai pas pu
 * comparer », jamais « un écran a changé ».*
 */

const RACINE = join(import.meta.dirname, "..");
const README = join(RACINE, "docs", "captures", "README.md");

function git(...arguments_: readonly string[]): string {
  // `stderr` est ÉTOUFFÉ, et c'est délibéré : le `fatal:` que git écrit quand
  // une empreinte est absente s'imprimerait AVANT notre verdict, et un lecteur
  // conclurait à une panne du contrôle là où le contrôle fait son travail. Le
  // refus se dit dans le rapport, en une phrase qui nomme la cause.
  return execFileSync("git", [...arguments_], {
    cwd: RACINE,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function verdict(): EtatDeLaSurface {
  let readme: string;
  try {
    readme = readFileSync(README, "utf8");
  } catch {
    return {
      etat: "indecidable",
      pourquoi: `docs/captures/README.md est illisible — aucune prise de vue n'a donc laissé d'empreinte à comparer.`,
    };
  }

  const empreinte = empreintePhotographiee(readme);
  if (empreinte === null) {
    return {
      etat: "indecidable",
      pourquoi:
        "docs/captures/README.md ne porte aucune empreinte de 40 caractères " +
        "sous « Commit photographié » — le format a changé, ou la prise de vue " +
        "n'a jamais tourné. La comparaison est refusée plutôt qu'inventée.",
    };
  }

  // L'empreinte doit exister DANS CE CLONE. C'est le troisième verdict, et
  // sans cette vérification `git diff` rendrait une erreur que personne ne lit.
  try {
    git("cat-file", "-e", `${empreinte}^{commit}`);
  } catch {
    return {
      etat: "indecidable",
      pourquoi:
        `le commit ${empreinte.slice(0, 7)} n'existe pas dans ce clone — ` +
        "historique tronqué (`--depth`) ou réécrit. Le README l'affirme, ce " +
        "dépôt ne le porte pas.",
    };
  }

  const changes = git(
    "diff",
    "--name-only",
    empreinte,
    "HEAD",
    "--",
    ...SURFACE_DECRAN.map((p) => p.prefixe),
  )
    .split("\n")
    .filter((ligne) => ligne.length > 0);

  return etatDeLaSurface(empreinte, changes);
}

const etat = verdict();
process.stdout.write(`${rapportDeLaSurface(etat)}\n`);
process.exit(etat.etat === "indecidable" ? 1 : 0);
