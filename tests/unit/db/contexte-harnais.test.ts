import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { VARIABLES_CONTEXTE } from "../../../lib/db/rls";

/**
 * LE HARNAIS NE POSE RIEN QUE LA PRODUCTION NE POSE (ticket L1-02b).
 *
 * **C'est la seconde moitié du contrôle, et elle regarde dans l'autre sens.**
 * `tests/isolation/contexte-arme.test.ts` exige que toute variable RÉCLAMÉE par
 * la base soit posée par la production. Celui-ci exige que le harnais n'en
 * arme AUCUNE de plus.
 *
 * Les deux sont nécessaires, et il a fallu le défaut réel pour le voir. Avant
 * ce ticket, `app.client_id` était réclamée par cinq politiques, posée par le
 * harnais, et absente du chemin de production. Le premier gardien attrape cet
 * état. Mais on peut aussi le RECREUSER par l'autre bout : ajouter au harnais
 * une variable que les politiques n'utilisent pas encore, écrire les scénarios
 * autour d'elle, et la production ne la posera jamais — les scénarios seront
 * verts, et la garantie n'existera que dans le harnais. **Un harnais plus riche
 * que la production est un harnais qui ment**, et son mensonge a exactement la
 * forme du succès.
 *
 * **La fermeture est structurelle AVANT d'être asservie.** `setup/contrat.ts`
 * ne déclare plus ses propres noms : il réexporte ceux de `lib/db/rls.ts`. Le
 * contrôle ci-dessous garde ce qui échappe à cette structure — un littéral
 * `'app.<nom>'` écrit à la main dans un scénario.
 *
 * **La population part du RÉPERTOIRE, jamais d'une liste de fichiers** : un
 * scénario écrit demain est lu le jour où il est écrit, sans que personne ait à
 * compléter quoi que ce soit (le renversement de D41 appliqué aux fichiers).
 */

const RACINE = join(process.cwd(), "tests/isolation");
const MOTIF_VARIABLE = /'(app\.[a-z_]+)'|"(app\.[a-z_]+)"|`(app\.[a-z_]+)`/g;

/** Tous les `.ts` de `tests/isolation/`, récursivement, avec leur source. */
function sourcesDuHarnais(racine: string = RACINE): Map<string, string> {
  const trouves = new Map<string, string>();

  const parcourir = (repertoire: string): void => {
    for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
      const chemin = join(repertoire, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
      } else if (entree.name.endsWith(".ts")) {
        trouves.set(chemin, readFileSync(chemin, "utf8"));
      }
    }
  };

  parcourir(racine);
  return trouves;
}

/** Les variables de session nommées en toutes lettres, par fichier. */
export function variablesDuHarnais(
  sources: ReadonlyMap<string, string>,
): { fichier: string; variable: string }[] {
  const trouves: { fichier: string; variable: string }[] = [];

  for (const [fichier, source] of sources) {
    for (const trouve of source.matchAll(MOTIF_VARIABLE)) {
      const variable = trouve[1] ?? trouve[2] ?? trouve[3];
      trouves.push({
        // Le chemin sert de CLÉ — il est comparé aux exemptions et cité dans
        // les écarts — donc en séparateurs POSIX quel que soit le système
        // (PORTABILITE-1) : `join` rend `\` sous Windows, et « tests\isolation »
        // n'aurait adossé aucune exemption.
        fichier: relative(process.cwd(), fichier).split(sep).join("/"),
        variable,
      });
    }
  }

  return trouves;
}

/**
 * Les variables NOMMÉES sans être posées — liste close, justifiée, et gardée
 * dans les deux sens.
 *
 * **Une seule entrée, et elle n'a pas été prévue : le gardien l'a trouvée.**
 * Son propre jumeau, dans `contexte-arme.test.ts`, écrit une politique qui lit
 * `app.agence_id` afin de prouver qu'une variable réclamée et non posée est
 * bien nommée. Cette variable n'est JAMAIS posée — c'est tout l'objet de
 * l'épreuve. La refuser reviendrait à interdire d'éprouver le gardien voisin.
 *
 * **L'exemption est une sélection négative, donc elle porte le témoin de son
 * adossement** (§9, 31/08) : le jour où ce fichier est renommé ou son jumeau
 * réécrit, l'entrée survivrait sans plus protéger personne, et le premier
 * fichier qui reprendrait ce nom hériterait d'une exemption que nul ne lui a
 * accordée. `ecartsListeExemptions` refuse une entrée qui ne s'adosse à rien.
 *
 * Elle est étroite par construction — un COUPLE (fichier, variable) — et non un
 * fichier entier : écrire `'app.autre_chose'` dans ce même fichier reste un
 * écart.
 */
const NOMMEES_SANS_ETRE_POSEES: readonly {
  readonly fichier: string;
  readonly variable: string;
  readonly justification: string;
}[] = [
  {
    fichier: "tests/isolation/contexte-arme.test.ts",
    variable: "app.agence_id",
    justification:
      "le jumeau du gardien de l'armement écrit une politique qui la lit, " +
      "pour prouver qu'une variable réclamée et non posée est nommée. Elle " +
      "n'est jamais posée : c'est l'objet même de l'épreuve.",
  },
];

/** Une exemption qui ne s'adosse à rien de réel est un écart. */
export function ecartsListeExemptions(
  nommees: readonly { fichier: string; variable: string }[],
  exemptions: readonly {
    fichier: string;
    variable: string;
  }[] = NOMMEES_SANS_ETRE_POSEES,
): string[] {
  return exemptions
    .filter(
      (exemption) =>
        !nommees.some(
          (nommee) =>
            nommee.fichier === exemption.fichier &&
            nommee.variable === exemption.variable,
        ),
    )
    .map(
      (exemption) =>
        `l'exemption « ${exemption.variable} dans ${exemption.fichier} » ne ` +
        "s'adosse à rien : le fichier ne nomme plus cette variable. Une " +
        "exemption qui ne s'applique à personne ne fait échouer personne — et " +
        "le premier fichier qui reprendra ce nom en héritera sans que nul ne " +
        "la lui ait accordée. La retirer.",
    );
}

/** Écarts : toute variable nommée par le harnais doit être posée en production. */
export function ecartsHarnais(
  nommees: readonly { fichier: string; variable: string }[],
  posees: readonly string[] = VARIABLES_CONTEXTE,
  exemptions: readonly {
    fichier: string;
    variable: string;
  }[] = NOMMEES_SANS_ETRE_POSEES,
): string[] {
  return [
    ...ecartsListeExemptions(nommees, exemptions),
    ...nommees
      .filter(
        (nommee) =>
          !posees.includes(nommee.variable) &&
          !exemptions.some(
            (exemption) =>
              exemption.fichier === nommee.fichier &&
              exemption.variable === nommee.variable,
          ),
      )
      .map(
        (nommee) =>
          `« ${nommee.variable} » est armée par le harnais (${nommee.fichier}) ` +
          "et posée par AUCUN chemin de production. Les scénarios écrits autour " +
          "d'elle seront verts, et la garantie n'existera que dans le harnais : " +
          "un harnais plus riche que la production est un harnais qui ment. " +
          "Soit `lib/db/rls.ts` la pose, soit le scénario cesse de l'armer.",
      ),
  ];
}

const SOURCES = sourcesDuHarnais();
const NOMMEES = variablesDuHarnais(SOURCES);

describe("le harnais d'isolation n'arme rien que la production ignore", () => {
  it("n'observe aucun écart", () => {
    const ecarts = ecartsHarnais(NOMMEES);
    expect(ecarts, ecarts.join("\n")).toEqual([]);
  });

  it("a réellement lu des fichiers et des variables — témoin de non-vacuité", () => {
    // Deux listes vides sont égales (§9, 01/09). Ces planchers refusent un
    // parcours devenu aveugle : un répertoire renommé, un motif qui ne mord
    // plus, une lecture jouée depuis le mauvais dossier.
    expect(SOURCES.size).toBeGreaterThan(15);
    expect(NOMMEES.length).toBeGreaterThan(10);
    expect(new Set(NOMMEES.map((n) => n.variable)).size).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("`setup/contrat.ts` ne redéclare aucun nom : il les réexporte", () => {
    const contrat = SOURCES.get(join(RACINE, "setup/contrat.ts"));
    expect(contrat, "le fichier attendu n'a pas été lu").toBeDefined();
    // C'est la fermeture STRUCTURELLE : la faute d'origine — deux listes de
    // noms qui peuvent diverger — n'est plus écrivable ici sans se voir.
    expect(contrat).not.toMatch(/VAR_[A-Z_]+ = "app\./);
    expect(contrat).toContain("VARIABLE_SESSION_SOCIETE");
  });
});

describe("jumeaux — le gardien mord sur la faute telle qu'elle se commettrait", () => {
  it("nomme une variable ajoutée au HARNAIS SEUL, dans le fichier réel", () => {
    // La greffe est faite dans `setup/db.ts` — le fichier où cette faute se
    // commettrait réellement, jamais un fichier fabriqué (§9, 21/08).
    const chemin = join(RACINE, "setup/db.ts");
    const reel = SOURCES.get(chemin);
    expect(reel, "le fichier réel n'a pas été lu").toBeDefined();

    const greffe = (reel ?? "").replace(
      "VAR_PERIMETRE,",
      'VAR_PERIMETRE,\n// greffe du jumeau : "app.agence_id"',
    );
    expect(greffe, "la greffe n'a rien changé").not.toEqual(reel);

    const sources = new Map(SOURCES);
    sources.set(chemin, greffe);
    const ecarts = ecartsHarnais(variablesDuHarnais(sources));

    expect(ecarts.length).toBeGreaterThan(0);
    expect(ecarts.join("\n")).toContain("app.agence_id");
    expect(ecarts.join("\n")).toContain("setup/db.ts");
    expect(ecarts.join("\n")).toContain("harnais qui ment");
  });

  it("nomme l'état RÉEL d'avant le ticket : production amputée, harnais intact", () => {
    // `VARIABLES_CONTEXTE` sans `app.client_id` ni `app.perimetre_sites`,
    // c'est-à-dire `lib/db/rls.ts` tel qu'il était. Le harnais, lui, les
    // armait déjà : c'est exactement la divergence mesurée.
    const avant = VARIABLES_CONTEXTE.filter(
      (variable) =>
        variable !== "app.client_id" && variable !== "app.perimetre_sites",
    );
    const ecarts = ecartsHarnais(NOMMEES, avant);

    expect(ecarts.length).toBeGreaterThan(0);
    expect(ecarts.join("\n")).toContain("app.client_id");
    expect(ecarts.join("\n")).toContain("app.perimetre_sites");
  });

  it("une greffe de variable CONNUE ne fait rougir personne", () => {
    // L'exemption se prouve avec une vraie faute dans le même fichier (§9,
    // forme 4) : sans ce contre-cas, le gardien pourrait rougir sur tout et
    // paraître juste.
    const chemin = join(RACINE, "setup/db.ts");
    const greffe = (SOURCES.get(chemin) ?? "").replace(
      "VAR_PERIMETRE,",
      'VAR_PERIMETRE,\n// "app.societe_id"',
    );
    const sources = new Map(SOURCES);
    sources.set(chemin, greffe);
    expect(ecartsHarnais(variablesDuHarnais(sources))).toEqual([]);
  });

  it("refuse une exemption qui ne s'adosse à rien", () => {
    const orpheline = [
      { fichier: "tests/isolation/disparu.test.ts", variable: "app.fantome" },
    ];
    const ecarts = ecartsListeExemptions(NOMMEES, orpheline);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("ne s'adosse à rien");
  });

  it("l'exemption en vigueur s'adosse RÉELLEMENT à un fichier et à une variable", () => {
    // Le témoin de la sélection négative : sans lui, l'exemption pourrait déjà
    // ne plus protéger personne sans que rien ne rougisse.
    expect(ecartsListeExemptions(NOMMEES)).toEqual([]);
  });
});
