import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `pnpm install --frozen-lockfile` EST UNE PORTE, et aucune porte du dépôt ne
 * gardait ce qu'elle garde.
 *
 * **La faute, mesurée le 14/09/2026.** `read-excel-file` est passé de
 * `devDependencies` à `dependencies` dans `package.json` — la bibliothèque est
 * lue par le serveur, elle n'est plus un outil de développement — et
 * `pnpm-lock.yaml` n'a pas été régénéré. `pnpm verify` est sorti en **0**, six
 * commandes jouées, 1819 scénarios verts ; la CI a rougi **avant le premier
 * test**, sur `ERR_PNPM_OUTDATED_LOCKFILE`. *Un vert local sincère au-dessus
 * d'une CI rouge* — le §9 du 02/09 mot pour mot.
 *
 * **Pourquoi le gardien voisin ne pouvait pas l'attraper.**
 * `tests/unit/chaine-verification.test.ts` exclut `install` nommément, et il
 * annonce pourquoi : *« elle prépare l'environnement, elle ne juge rien »*.
 * **Cette phrase est fausse**, et c'est la seule chose que cet incident a
 * apprise : `--frozen-lockfile` ne prépare pas l'environnement, il **JUGE**
 * l'accord de deux fichiers du dépôt, et il refuse quand ils divergent. Dix
 * jobs, dans six flux, en dépendent — il n'y a pas un seul travail de CI qui
 * ne le joue pas en premier. L'exclusion reste juste pour `pnpm exec` et les
 * actions GitHub ; elle était fausse pour celui-là.
 *
 * **Ce que ce gardien ne fait pas, et il faut le dire** : il ne rejoue pas
 * `--frozen-lockfile`, qui vérifie bien davantage — l'arbre entier des
 * versions résolues. Il garde l'accord que la faute a rompu : **le nom, la
 * SECTION et le spécificateur**, pour les seules dépendances directes du
 * dépôt. Un décalage plus profond lui échappe et reste à la CI.
 */
describe("le verrou d'installation garde ce que la CI lui demande", () => {
  const RACINE = process.cwd();

  const paquet = JSON.parse(
    readFileSync(join(RACINE, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const VERROU = readFileSync(join(RACINE, "pnpm-lock.yaml"), "utf8");

  /**
   * Le bloc de l'IMPORTEUR RACINE, et lui seul.
   *
   * **Mesuré en écrivant ce gardien** : `snapshots:` répète `dependencies:` à
   * la même indentation, une fois par paquet résolu — 609 fois ici. Un
   * analyseur qui lit le fichier entier retient donc le DERNIER, c'est-à-dire
   * les dépendances d'une bibliothèque tierce, et il s'accorde avec rien. Il
   * rougissait, ce qui l'a sauvé ; il aurait pu rendre une section vide et
   * s'accorder avec une autre vide (§9, 10/09).
   */
  function importeurRacine(texte: string): string {
    const debut = texte.indexOf("\nimporters:\n");
    if (debut === -1) return "";
    const suite = texte.slice(debut + 1);
    const fin = suite.slice(1).search(/\n[a-z][a-zA-Z]*:\n/);
    return fin === -1 ? suite : suite.slice(0, fin + 1);
  }

  /**
   * Les dépendances directes que le VERROU déclare, section par section.
   *
   * Lu par indentation plutôt que par un analyseur YAML : le §2 veut qu'on
   * écrive les trente lignes plutôt qu'on ajoute la dépendance, et c'est déjà
   * ainsi que `chaine-verification` lit `ci.yml`.
   */
  function sectionsDuVerrou(
    texte: string,
  ): Record<string, Map<string, string>> {
    const sections: Record<string, Map<string, string>> = {};
    let courante: Map<string, string> | null = null;
    let nom: string | null = null;

    for (const ligne of texte.split("\n")) {
      // `    dependencies:` / `    devDependencies:` — l'importeur racine.
      const entete = /^ {4}(dev)?[Dd]ependencies:\s*$/.exec(ligne);
      if (entete) {
        courante = new Map();
        sections[entete[1] === "dev" ? "devDependencies" : "dependencies"] =
          courante;
        nom = null;
        continue;
      }
      // Toute autre clé à quatre espaces ou moins ferme la section.
      if (/^ {0,4}\S/.test(ligne) && ligne.trim() !== "") {
        courante = null;
        nom = null;
        continue;
      }
      if (courante === null) continue;

      // `      nom-du-paquet:` — six espaces.
      const paquetLu = /^ {6}('?)([^':]+)\1:\s*$/.exec(ligne);
      if (paquetLu) {
        nom = paquetLu[2] ?? null;
        continue;
      }
      // `        specifier: ^1.2.3` — huit espaces.
      const specificateur = /^ {8}specifier:\s*(.+?)\s*$/.exec(ligne);
      if (specificateur && nom !== null) {
        courante.set(nom, (specificateur[1] ?? "").replace(/^'|'$/g, ""));
        nom = null;
      }
    }
    return sections;
  }

  const BLOC_IMPORTEUR = importeurRacine(VERROU);
  const verrou = sectionsDuVerrou(BLOC_IMPORTEUR);

  it("le gardien lit réellement les deux fichiers — sinon il garde le vide", () => {
    // Témoin : deux relevés vides s'accordent parfaitement (§9, 10/09) — c'est
    // exactement la panne que cette assertion refuse.
    expect(Object.keys(paquet.dependencies ?? {}).length).toBeGreaterThan(5);
    expect(Object.keys(paquet.devDependencies ?? {}).length).toBeGreaterThan(5);
    expect(verrou.dependencies?.size ?? 0).toBeGreaterThan(5);
    expect(verrou.devDependencies?.size ?? 0).toBeGreaterThan(5);
  });

  for (const section of ["dependencies", "devDependencies"] as const) {
    it(`« ${section} » dit la même chose des deux côtés`, () => {
      const declare = paquet[section] ?? {};
      const verrouille = verrou[section] ?? new Map<string, string>();

      // La POPULATION est l'UNION des deux côtés, jamais l'un d'eux : partir
      // de `package.json` laisserait passer une entrée que le verrou porte en
      // trop, et partir du verrou laisserait passer l'inverse (§9, 31/08 — le
      // `WHERE` qui recoupe l'assertion).
      const noms = [
        ...new Set([...Object.keys(declare), ...verrouille.keys()]),
      ].sort();

      for (const nom of noms) {
        expect(
          verrouille.get(nom),
          `« ${nom} » : « ${declare[nom] ?? "absent"} » dans package.json ` +
            `(${section}) et « ${verrouille.get(nom) ?? "absent"} » dans ` +
            "pnpm-lock.yaml. `pnpm install --frozen-lockfile` refusera, et " +
            "aucun test ne sera joué : dix jobs de CI s'arrêtent là. " +
            "Régénérer par `pnpm install --lockfile-only`, et commiter le " +
            "verrou avec le package.json qui le motive.",
        ).toBe(declare[nom]);
      }
    });
  }

  it("ÉPREUVE : un paquet déplacé de section est refusé", () => {
    // La faute telle qu'elle s'est commise le 14/09 : `read-excel-file` promu
    // en `dependencies` au package.json, laissé en `devDependencies` au
    // verrou. On la rejoue sur le verrou réel, en le RÉÉCRIVANT plutôt qu'en
    // comparant deux ensembles — la violation doit avoir lieu (§9, 30/08).
    const deplace = BLOC_IMPORTEUR.replace(
      /^ {4}dependencies:$/m,
      "    dependencies:\n      temoin-de-lepreuve:\n        specifier: ^1.0.0\n        version: 1.0.0",
    );
    const fautif = sectionsDuVerrou(deplace);
    expect(fautif.dependencies?.has("temoin-de-lepreuve")).toBe(true);

    const verdict = (lu: Map<string, string>): boolean =>
      [
        ...new Set([...Object.keys(paquet.dependencies ?? {}), ...lu.keys()]),
      ].every((nom) => lu.get(nom) === (paquet.dependencies ?? {})[nom]);

    expect(verdict(fautif.dependencies as Map<string, string>)).toBe(false);

    // **ET LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON** (§9, 11/09) :
    // le verrou tel qu'il est commis passe, et il passe parce qu'il s'accorde
    // — pas parce que la lecture rend le vide, ce que le témoin ci-dessus a
    // déjà écarté.
    expect(verdict(verrou.dependencies as Map<string, string>)).toBe(true);
  });

  it("`read-excel-file` est une dépendance de PRODUCTION, et le verrou le dit", () => {
    // La faute nommée sur son objet : le module est lu par `lib/excel/` sous
    // le serveur, donc il est embarqué dans le paquet de production. Un
    // gardien qui ne garderait que la FORME de l'accord resterait vert le jour
    // où quelqu'un « réparerait » la divergence en le remettant du mauvais
    // côté — c'est la réparation la plus naturelle, et c'est la mauvaise.
    expect(paquet.dependencies?.["read-excel-file"]).toBeDefined();
    expect(paquet.devDependencies?.["read-excel-file"]).toBeUndefined();
    expect(verrou.dependencies?.has("read-excel-file")).toBe(true);
    expect(verrou.devDependencies?.has("read-excel-file")).toBe(false);
  });
});
