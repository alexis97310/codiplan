"use strict";

// Ce fichier est chargé par `NODE_OPTIONS=--require`, donc nécessairement en
// CommonJS synchrone — même contrainte que `double-courriel.cjs`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require("node:path");

/**
 * INSTRUMENTATION DE DIAGNOSTIC (9L47) — DÉSACTIVÉE PAR DÉFAUT.
 *
 * Trois incidents (9L38A, 9L41, et le constat qui ouvre ce lot) ont rougi sur
 * un worker Chromium tué par SIGABRT tard dans la suite e2e (~2100 épreuves,
 * ~1h30). Hypothèse posée par 9L41C, non prouvée : croissance progressive de
 * la mémoire du navigateur long-vécu d'un worker (un seul Chromium réutilisé
 * pour toute la suite d'un worker, `playwright.config.ts`). Ce fichier
 * MESURE, il ne corrige rien.
 *
 * N'agit QUE si `E2E_MESURE_MEMOIRE=1` — sinon ce `require` ne fait rien, et
 * la suite normale n'est jamais affectée. Posé par `playwright.config.ts`
 * dans `NODE_OPTIONS`, donc chargé au démarrage de CHAQUE worker (c'est le
 * worker qui lance le navigateur comme processus enfant — jamais le
 * processus principal de Playwright, qui ne voit aucun des deux).
 *
 * Échantillonne par INTERVALLE de temps, pas par épreuve : aucun fichier de
 * scène n'est modifié pour poser un `afterEach`, et un seul navigateur sert
 * des centaines d'épreuves. La mise en correspondance avec le numéro
 * d'épreuve se fait APRÈS coup, par l'horodatage, contre le journal JSON que
 * `playwright.config.ts` active sous la même variable.
 */
if (process.env.E2E_MESURE_MEMOIRE === "1") {
  const DOSSIER = join(process.cwd(), "test-results", "mesure-memoire");
  mkdirSync(DOSSIER, { recursive: true });
  const FICHIER = join(DOSSIER, `worker-${process.pid}.ndjson`);
  const INTERVALLE_MS = 5000;

  // `/proc/<pid>/task/<tid>/children` (Linux ≥ 3.5) : les pid enfants
  // DIRECTS d'un processus, sans dépendre de `ps` ni d'un paquet externe.
  // Parcours en largeur pour obtenir tous les DESCENDANTS — le worker lance
  // Chromium, qui lance lui-même zygote/GPU/rendu en sous-processus.
  function descendants(pidRacine) {
    const vus = new Set();
    const file = [pidRacine];
    while (file.length > 0) {
      const pid = file.shift();
      let tids;
      try {
        tids = readdirSync(`/proc/${pid}/task`);
      } catch {
        continue;
      }
      for (const tid of tids) {
        let enfants;
        try {
          enfants = readFileSync(`/proc/${pid}/task/${tid}/children`, "utf8")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        } catch {
          continue;
        }
        for (const enfant of enfants) {
          if (!vus.has(enfant)) {
            vus.add(enfant);
            file.push(enfant);
          }
        }
      }
    }
    return Array.from(vus);
  }

  function rssKo(pid) {
    try {
      const statut = readFileSync(`/proc/${pid}/status`, "utf8");
      const m = /^VmRSS:\s+(\d+) kB$/m.exec(statut);
      return m ? Number(m[1]) : null;
    } catch {
      return null;
    }
  }

  function echantillon() {
    const descendantsPids = descendants(process.pid);
    let chromiumRssKo = 0;
    let chromiumProcessus = 0;
    for (const pid of descendantsPids) {
      const rss = rssKo(pid);
      if (rss !== null) {
        chromiumRssKo += rss;
        chromiumProcessus += 1;
      }
    }
    const ligne = {
      ts: Date.now(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      chromiumRssKo,
      chromiumProcessus,
    };
    try {
      appendFileSync(FICHIER, JSON.stringify(ligne) + "\n");
    } catch {
      // Le dossier peut disparaître entre deux mesures si un autre worker
      // nettoie `test-results/` en fin de suite — sans conséquence, une
      // mesure manquante n'est pas une mesure fausse.
    }
  }

  const minuteur = setInterval(echantillon, INTERVALLE_MS);
  minuteur.unref();
  echantillon();
}
