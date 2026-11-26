"use strict";

// Ce fichier est chargé par `NODE_OPTIONS=--require`, donc nécessairement en
// CommonJS synchrone — même contrainte que `double-courriel.cjs`.
const {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const INTERVALLE_MS = 2000;

  // `/proc/<pid>/task/<tid>/children` (Linux ≥ 3.5, `CONFIG_CHECKPOINT_RESTORE`)
  // N'EXISTE PAS sous le noyau WSL2 de ce poste (mesuré : `ENOENT` sur un
  // PID qui a pourtant des enfants) — PAS un indicateur fiable d'absence de
  // descendants, un indicateur d'absence de la fonctionnalité elle-même.
  // Repli universel : chaque `/proc/<pid>/status` porte `PPid:` — un parcours
  // de TOUT `/proc` reconstruit l'arbre sans dépendre de cette fonctionnalité.
  function statutDe(pid) {
    try {
      return readFileSync(`/proc/${pid}/status`, "utf8");
    } catch {
      return null;
    }
  }

  function rssKoDeStatut(statut) {
    const m = /^VmRSS:\s+(\d+) kB$/m.exec(statut);
    return m ? Number(m[1]) : null;
  }

  function descendants(pidRacine) {
    let pids;
    try {
      pids = readdirSync("/proc").filter((n) => /^\d+$/.test(n));
    } catch {
      return [];
    }
    const enfantsDe = new Map();
    for (const pid of pids) {
      const statut = statutDe(pid);
      if (statut === null) continue;
      const m = /^PPid:\s+(\d+)$/m.exec(statut);
      if (!m) continue;
      const ppid = m[1];
      if (!enfantsDe.has(ppid)) enfantsDe.set(ppid, []);
      enfantsDe.get(ppid).push(pid);
    }
    const vus = new Set();
    const file = [String(pidRacine)];
    while (file.length > 0) {
      const pid = file.shift();
      for (const enfant of enfantsDe.get(pid) ?? []) {
        if (!vus.has(enfant)) {
          vus.add(enfant);
          file.push(enfant);
        }
      }
    }
    return Array.from(vus);
  }

  function echantillon() {
    const descendantsPids = descendants(process.pid);
    let chromiumRssKo = 0;
    let chromiumProcessus = 0;
    for (const pid of descendantsPids) {
      const statut = statutDe(pid);
      const rss = statut === null ? null : rssKoDeStatut(statut);
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
