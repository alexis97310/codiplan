import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";
import { RACINE } from "../outils/fichiers-source";

/**
 * N'IMPORTE QUEL PostgreSQL réel installé sur la machine qui exécute
 * l'épreuve — `null` si aucun. Sert UNIQUEMENT au test de bout en bout
 * ci-dessous, qui a besoin d'un vrai `initdb`/`pg_ctl` pour prouver que le
 * cluster démarre réellement ; la VERSION importe peu ici, `PGJ_BIN` étant
 * justement la porte de sortie explicite pour forcer une autre version.
 */
function unBinaireReelQuelconque(): string | null {
  const racines = [
    "/usr/lib/postgresql",
    "/usr/local/pgsql",
    "/opt/homebrew/opt",
  ];
  for (const racine of racines) {
    if (!existsSync(racine)) continue;
    for (const entree of readdirSync(racine)) {
      const bin =
        racine === "/usr/local/pgsql" ? racine : join(racine, entree, "bin");
      if (existsSync(join(bin, "initdb"))) return bin;
    }
  }
  return null;
}

/**
 * LA VERSION QUE LE CLUSTER JETABLE RETIENT SUIT CELLE QUE LA CI ÉPINGLE
 * (CLUSTER-1, 23/09/2026).
 *
 * *Ce que ça a coûté, mesuré :* le lot 23-IMPORT-2 (23/09, 04h52) a perdu du
 * temps sur deux échecs de `test:isolation` sans rapport avec son ticket,
 * « probablement parce que seule PostgreSQL 18 est installée sur cette
 * machine contre la version 16 documentée ». `scripts/postgres-jetable.sh`
 * retenait la version la PLUS ÉLEVÉE installée — le commentaire au-dessus de
 * la boucle le disait en toutes lettres —, alors que
 * `.github/workflows/ci.yml` épingle `postgres:16` deux fois et que le
 * message d'erreur du script lui-même réclamait ce paquet-là. Le fichier se
 * contredisait à douze lignes d'écart.
 *
 * **Le numéro ne se recopie pas en dur ici** : il se LIT dans `ci.yml`, sans
 * quoi le prochain relèvement de la CI laisserait ce gardien approuver un
 * script resté en arrière. Précédent exact :
 * `tests/unit/imports/delais-application.test.ts`, qui lit le fichier source
 * d'une route pour y confronter un littéral.
 */

const CI_YML = readFileSync(
  join(RACINE, ".github", "workflows", "ci.yml"),
  "utf8",
);
const SCRIPT = readFileSync(
  join(RACINE, "scripts", "postgres-jetable.sh"),
  "utf8",
);

/** Toutes les versions `postgres:<n>` que `ci.yml` épingle comme image de service. */
function versionsEpingleesCI(contenu: string): string[] {
  return [...contenu.matchAll(/image:\s*postgres:(\d+)/g)].map(
    (correspondance) => correspondance[1],
  );
}

/** La version que le script retient par défaut — `null` s'il n'en déclare aucune. */
function versionRetenueScript(contenu: string): string | null {
  const trouve = /VERSION_CIBLE="(\d+)"/.exec(contenu);
  return trouve ? trouve[1] : null;
}

describe("la version PostgreSQL du cluster jetable suit celle que la CI épingle", () => {
  it("ci.yml épingle une seule et même version aux deux endroits où elle sert un service postgres", () => {
    const versions = versionsEpingleesCI(CI_YML);
    expect(
      versions.length,
      "ci.yml ne déclare plus `image: postgres:<version>` — le motif de ce gardien doit être mis à jour avec lui.",
    ).toBeGreaterThan(0);
    expect(
      new Set(versions).size,
      `ci.yml épingle plusieurs versions différentes dans ses services postgres : ${versions.join(", ")}.`,
    ).toBe(1);
  });

  it("le script déclare une VERSION_CIBLE littérale, et elle vaut exactement celle que la CI épingle", () => {
    const [versionCI] = versionsEpingleesCI(CI_YML);
    const versionScript = versionRetenueScript(SCRIPT);
    expect(
      versionScript,
      'scripts/postgres-jetable.sh ne déclare plus `VERSION_CIBLE="<n>"` — le motif de ce gardien doit être mis à jour avec lui.',
    ).not.toBeNull();
    expect(
      versionScript,
      `.github/workflows/ci.yml épingle PostgreSQL ${versionCI} et scripts/postgres-jetable.sh retient ${versionScript} : ` +
        "un test:isolation vert en local peut échouer en CI, et inversement.",
    ).toBe(versionCI);
  });

  it("le script ne retient plus la version la PLUS ÉLEVÉE installée — le commentaire qui le disait a disparu", () => {
    expect(SCRIPT).not.toMatch(/plus élevée installée/);
  });

  it("contre-épreuve — la comparaison détecte RÉELLEMENT une divergence, sur des sources fabriquées et indépendantes du dépôt", () => {
    const ciFabrique = "  image: postgres:16\n  image: postgres:16\n";
    const scriptFabriqueDivergent = 'VERSION_CIBLE="18"\n';
    const [versionCIFabriquee] = versionsEpingleesCI(ciFabrique);
    expect(versionRetenueScript(scriptFabriqueDivergent)).not.toBe(
      versionCIFabriquee,
    );

    const scriptFabriqueConforme = 'VERSION_CIBLE="16"\n';
    expect(versionRetenueScript(scriptFabriqueConforme)).toBe(
      versionCIFabriquee,
    );
  });
});

/**
 * COMPORTEMENT — le script REFUSE en le disant, jamais un repli silencieux.
 *
 * `PGJ_RACINE_DEBIAN` est un réglage interne (non documenté dans l'usage
 * normal du script, voir son en-tête), qui existe pour UNE seule raison :
 * permettre à cette épreuve de fabriquer un arbre de versions sans toucher au
 * vrai `/usr/lib/postgresql` de la machine — ni en dépendre. Sans ce point
 * d'entrée, le résultat de ce test dépendrait de ce qui est réellement
 * installé sur la machine qui l'exécute (cette machine-ci n'a que PostgreSQL
 * 18, un runner GitHub peut avoir 16 préinstallée) : exactement le genre de
 * dépendance à l'environnement que ce ticket répare.
 */
describe("le script refuse, en le disant, quand la version épinglée n'est pas installée", () => {
  let racineTemporaire: string | null = null;

  afterEach(() => {
    if (racineTemporaire) {
      rmSync(racineTemporaire, { recursive: true, force: true });
      racineTemporaire = null;
    }
  });

  function candidatBinaireFactice(racine: string, version: string): string {
    const bin = join(racine, version, "bin");
    mkdirSync(bin, { recursive: true });
    const initdb = join(bin, "initdb");
    writeFileSync(initdb, "#!/bin/sh\nexit 0\n");
    chmodSync(initdb, 0o755);
    return bin;
  }

  it("aucune version installée hors la version épinglée : le script s'arrête, nomme le paquet et PGJ_BIN", () => {
    racineTemporaire = mkdtempSync(join(tmpdir(), "pgj-versions-"));
    candidatBinaireFactice(racineTemporaire, "18");

    let sortie = "";
    let code = 0;
    try {
      execFileSync(
        "bash",
        [join(RACINE, "scripts", "postgres-jetable.sh"), "etat"],
        {
          env: {
            ...process.env,
            PGJ_RACINE_DEBIAN: racineTemporaire,
            PGJ_BIN: "",
            PGJ_ROOT: join(racineTemporaire, "cluster"),
          },
          stdio: "pipe",
        },
      );
    } catch (erreur) {
      const echec = erreur as { status: number; stderr: Buffer };
      code = echec.status;
      sortie = echec.stderr.toString("utf8");
    }

    expect(
      code,
      "le script aurait dû refuser (code de sortie non nul) : seule la version 18 est installée dans l'arbre factice, pas la version épinglée.",
    ).not.toBe(0);
    expect(sortie).toMatch(/postgresql-\d+/);
    expect(sortie).toMatch(/PGJ_BIN/);
  });

  it("la version épinglée EST installée dans l'arbre factice : le script la retient, sans se rabattre sur une autre", () => {
    const [versionCI] = versionsEpingleesCI(CI_YML);
    racineTemporaire = mkdtempSync(join(tmpdir(), "pgj-versions-"));
    // Une version plus haute ET la version épinglée sont toutes deux présentes.
    // Si le script retenait encore « la plus élevée installée », il choisirait
    // la fausse version 99 plutôt que la version épinglée.
    candidatBinaireFactice(racineTemporaire, "99");
    candidatBinaireFactice(racineTemporaire, versionCI);

    const cheminEtat = join(racineTemporaire, "cluster");
    let code = 0;
    let sortie = "";
    try {
      execFileSync(
        "bash",
        [join(RACINE, "scripts", "postgres-jetable.sh"), "etat"],
        {
          env: {
            ...process.env,
            PGJ_RACINE_DEBIAN: racineTemporaire,
            PGJ_BIN: "",
            PGJ_ROOT: cheminEtat,
          },
          stdio: "pipe",
        },
      );
    } catch (erreur) {
      const echec = erreur as {
        status: number;
        stdout: Buffer;
        stderr: Buffer;
      };
      code = echec.status;
      sortie = echec.stdout.toString("utf8") + echec.stderr.toString("utf8");
    }

    // `etat` sur un cluster jamais créé sort en 1 en disant « Arrêté » — ce
    // n'est PAS le refus de version (qui, lui, écrirait sur stderr avant même
    // d'atteindre le sous-programme `etat`). Le distinguo est le message.
    expect(code).not.toBe(0);
    expect(sortie).toMatch(/Arrêté/);
    expect(sortie).not.toMatch(/PGJ_BIN/);
  });
});

/**
 * BOUT EN BOUT — un vrai cluster démarre, sans root, sous la racine par
 * défaut (DEFAUT 2 du ticket).
 *
 * **Ce qu'elle a trouvé, en plus de ce que le ticket décrivait.** Un
 * répertoire de données accessible sans `root` NE SUFFISAIT PAS : le paquet
 * PostgreSQL d'Ubuntu compile `/var/run/postgresql` comme
 * `unix_socket_directories` par défaut, un répertoire que seul le groupe
 * système `postgres` peut écrire. Mesuré sur CETTE machine, avant correction :
 * `pg_ctl: could not start server` / `could not create lock file
 * "/var/run/postgresql/.s.PGSQL.<port>.lock": Permission denied`. Le socket
 * doit donc, lui aussi, vivre sous `$RACINE`.
 *
 * Ignoré si la machine qui exécute l'épreuve ne porte AUCUN binaire serveur
 * PostgreSQL réel (aucun `initdb` trouvé) : ce test a besoin d'en démarrer un
 * pour de vrai, et `PGJ_BIN` reste la porte de sortie explicite — la VERSION
 * de ce binaire n'a aucune importance ici.
 */
describe("bout en bout — le cluster démarre sous la racine par défaut, sans root", () => {
  const binaireReel = unBinaireReelQuelconque();
  const port = "5559";
  const racineAttendue = join(
    process.env.TMPDIR ?? "/tmp",
    "codiplan-postgres-jetable",
    port,
  );

  afterEach(() => {
    if (binaireReel) {
      try {
        execFileSync(
          "bash",
          [join(RACINE, "scripts", "postgres-jetable.sh"), "arret"],
          {
            env: { ...process.env, PGJ_BIN: binaireReel, PGJ_PORT: port },
            stdio: "pipe",
          },
        );
      } catch {
        // Rien à arrêter si le test a échoué avant le démarrage.
      }
      rmSync(racineAttendue, { recursive: true, force: true });
    }
  });

  it.skipIf(binaireReel === null)(
    "creer / etat / arret réussissent sous ${TMPDIR:-/tmp}/codiplan-postgres-jetable/<port>, jamais sous /var/lib/postgresql",
    () => {
      const env = { ...process.env, PGJ_BIN: binaireReel!, PGJ_PORT: port };
      const script = join(RACINE, "scripts", "postgres-jetable.sh");

      const creation = execFileSync("bash", [script, "creer"], {
        env,
        encoding: "utf8",
      });
      expect(creation).toMatch(/Cluster prêt/);
      expect(existsSync(join(racineAttendue, "data"))).toBe(true);

      const etat = execFileSync("bash", [script, "etat"], {
        env,
        encoding: "utf8",
      });
      expect(etat).toMatch(/En cours d'exécution/);

      const arret = execFileSync("bash", [script, "arret"], {
        env,
        encoding: "utf8",
      });
      expect(arret).toMatch(/Cluster arrêté/);
    },
    60_000,
  );
});
