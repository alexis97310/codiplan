import {
  cheminsDesDepots,
  cheminsDesModules,
  FONCTIONS_SANS_CHEMIN,
  MODULES_SANS_CHEMIN,
} from "./lib/chemins-de-depot";

/**
 * `pnpm chemins` — QUELLE FONCTION DE DÉPÔT UN HUMAIN PEUT-IL ATTEINDRE ?
 *
 * **Chaque ligne dit de quel côté du miroir elle vient** (§9, 06/09) : les
 * appelants sont OBSERVÉS dans le dépôt, les motifs sont DÉCLARÉS. *Un décompte
 * se lit en trois secondes et ne se vérifie pas ; un nom se vérifie* — la sortie
 * nomme donc les fichiers plutôt que de les compter.
 *
 * **La sortie passe par `process.stdout.write`** : `console.log` est banni
 * (CLAUDE.md §5), et toutes les commandes de ce dépôt écrivent ainsi.
 *
 * **Cette commande ne juge pas : elle DÉCRIT.** Ce qui échoue est le gardien,
 * `tests/unit/gardiens/chemins-de-depot.test.ts`, et il échoue à `pnpm verify`.
 */
/** Une ligne sur la sortie standard. */
function ecrire(ligne: string): void {
  process.stdout.write(`${ligne}\n`);
}

const chemins = cheminsDesDepots();
const motifs = new Map(
  FONCTIONS_SANS_CHEMIN.map((e) => [`${e.module}#${e.fonction}`, e.motif]),
);

const parModule = new Map<string, typeof chemins>();
for (const ligne of chemins) {
  parModule.set(ligne.module, [...(parModule.get(ligne.module) ?? []), ligne]);
}

let sansChemin = 0;
let sansMotif = 0;
for (const [module, lignes] of [...parModule].sort()) {
  ecrire(`\n${module}`);
  for (const ligne of lignes) {
    if (ligne.appelants.length > 0) {
      ecrire(`  [chemin]  ${ligne.fonction} — ${ligne.appelants.join(", ")}`);
      continue;
    }
    sansChemin += 1;
    const motif = motifs.get(`${module}#${ligne.fonction}`);
    if (motif === undefined) {
      sansMotif += 1;
    }
    ecrire(
      `  [AUCUN]   ${ligne.fonction} — ${motif ?? "ET AUCUN MOTIF ÉCRIT"}`,
    );
  }
}

ecrire(
  `\nOBSERVÉ dans le dépôt : ${chemins.length} fonction(s) de dépôt, dont ${sansChemin} qu'aucun chemin depuis app/ n'atteint.`,
);
ecrire(
  `DÉCLARÉ dans scripts/lib/chemins-de-depot.ts : ${FONCTIONS_SANS_CHEMIN.length} exemption(s), et ${sansMotif} fonction(s) sans chemin n'y figurent pas.`,
);

// ── LA MAILLE LARGE : chaque module de `lib/`, et ce qui l'atteint ─────────
//
// C'est la mesure qui a ouvert R3-12. La maille fine — les fonctions de dépôt
// ci-dessus — est celle qui attrape ce que celle-ci rate : *`absences` était
// atteint, et personne ne pouvait déclarer une absence.*
ecrire(`\n── CHAQUE MODULE DE lib/, ET CE QUI L'ATTEINT ──`);
const modules = cheminsDesModules();
for (const domaine of modules) {
  ecrire(
    domaine.atteintPar.length === 0
      ? `  [AUCUN]   ${domaine.module}`
      : `  [chemin]  ${domaine.module} — ${domaine.atteintPar.join(", ")}`,
  );
}
ecrire(
  `\nOBSERVÉ : ${modules.length} module(s), dont ${modules.filter((m) => m.atteintPar.length === 0).length} qu'aucun chemin depuis app/ n'atteint.`,
);
ecrire(`DÉCLARÉ : ${MODULES_SANS_CHEMIN.length} module(s) sans chemin.`);
