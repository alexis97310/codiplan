import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE LA FRONTIÈRE SERVEUR → CLIENT (lot PARC-TER, 21/09/2026).
 *
 * ## Ce que deux pannes en trois jours ont montré
 *
 * `/parc/nouvelle` est tombé DEUX fois pour la MÊME famille de faute — une
 * exportation qui franchit la frontière d'un module `"use client"` vers un
 * composant serveur :
 *
 * - **PARC-BIS** (21/09/2026, avant ce lot) : `urlRetour` passée comme une
 *   FONCTION à `<FormulaireMachine>` — React ne sérialise pas une fonction
 *   à travers cette frontière.
 * - **PARC-TER** (celui-ci) : `tousLesResultats`, posée par le lot SELECT-1
 *   dans `components/parc/formulaire-machine.tsx` — qui commence par
 *   `"use client"` — puis APPELÉE comme une fonction ordinaire par
 *   `app/(back-office)/parc/nouvelle/page.tsx`, un composant serveur.
 *   Mesuré : 500 au rendu.
 *
 * **Toute exportation d'un module `"use client"` devient une RÉFÉRENCE
 * CLIENT pour qui l'importe côté serveur** — qu'elle rende du JSX ou non.
 * Un composant se rend en JSX et la frontière le porte sans le rompre ; une
 * fonction ordinaire, APPELÉE plutôt que rendue, ne survit pas au passage.
 * Deux occurrences du même défaut sur le même écran en trois jours disent
 * qu'aucune relecture ne l'attrape — c'est un gardien qu'il fallait, pas une
 * troisième correction ponctuelle.
 *
 * ## Ce que ce gardien mesure, et comment
 *
 * Il n'éprouve pas `/parc/nouvelle` en particulier — un test qui ne
 * connaîtrait que cet écran laisserait le même défaut réapparaître ailleurs
 * sans qu'aucun test ne rougisse. Il balaye `app/`, `components/` et `lib/`,
 * repère les modules `"use client"` et leurs exportations de VALEUR en
 * camelCase (une fonction ou une constante — jamais un composant, nommé en
 * PascalCase par convention constante de ce dépôt, et jamais un `type`, qui
 * n'existe plus à l'exécution), puis cherche, parmi les fichiers qui ne sont
 * PAS eux-mêmes `"use client"`, un import de l'une de ces exportations.
 *
 * Une exportation PascalCase (un composant, rendu en JSX par l'appelant)
 * n'est jamais signalée : c'est l'usage normal d'un module client depuis un
 * composant serveur, celui que React sait porter. Seule une fonction ou une
 * constante camelCase, franchissant la frontière pour être APPELÉE, l'est.
 *
 * ## Les deux sens, prouvés séparément
 *
 * `describe("le détecteur, mis à l'épreuve")` le fait rougir sur une fixture
 * reconstituant exactement l'arrangement d'avant ce lot — page serveur,
 * fonction camelCase exportée par un module `"use client"`, appel direct —
 * et le fait rester vert sur l'usage légitime d'un composant PascalCase
 * rendu en JSX, et sur un module client qui en importe un autre. Sans ce
 * second volet, un détecteur qui hurlerait sur tout ne vaudrait pas mieux
 * qu'un détecteur muet.
 *
 * `describe("le dépôt réel")` rejoue le même détecteur contre le dépôt tel
 * qu'il est aujourd'hui : zéro franchissement, la correction de ce lot
 * comprise.
 */

type Violation = {
  readonly fichier: string;
  readonly importe: string;
  readonly depuisModuleClient: string;
};

const EXTENSIONS = [".ts", ".tsx"];
const DOSSIERS_IGNORES = new Set(["node_modules", ".next", ".git"]);

function estFichierDeTest(nom: string): boolean {
  return /\.test\.(ts|tsx)$/.test(nom);
}

/** La directive `"use client"` est la première ligne non vide du fichier. */
function estModuleClient(contenu: string): boolean {
  const premiereLigne = contenu.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return /^["']use client["'];?$/.test(premiereLigne);
}

/**
 * Les exportations de VALEUR, camelCase — jamais un composant (PascalCase,
 * convention constante de ce dépôt) ni un `type`/`interface` (effacés à la
 * compilation, aucune frontière à franchir).
 */
function exportsDeValeurCamelCase(contenu: string): Set<string> {
  const noms = new Set<string>();
  const reFonction = /export\s+(?:async\s+)?function\s+([a-z][\w$]*)/g;
  const reConst = /export\s+const\s+([a-z][\w$]*)\s*[:=]/g;
  for (const re of [reFonction, reConst]) {
    for (const correspondance of contenu.matchAll(re)) {
      noms.add(correspondance[1]);
    }
  }
  return noms;
}

/** Les imports nommés d'un fichier, hors imports de TYPE (effacés à la compilation). */
function importsNommes(
  contenu: string,
): readonly { readonly module: string; readonly noms: readonly string[] }[] {
  const resultats: { module: string; noms: string[] }[] = [];
  const re =
    /import\s+(?:[\w$]+\s*,\s*)?(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  for (const correspondance of contenu.matchAll(re)) {
    if (correspondance[1] !== undefined) {
      continue; // `import type { … }` — effacé à la compilation.
    }
    const noms = correspondance[2]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("type "))
      .map((s) => s.split(/\s+as\s+/)[0]!.trim());
    resultats.push({ module: correspondance[3], noms });
  }
  return resultats;
}

/** Résout un spécificateur d'import (`@/…` ou relatif) vers un fichier réel du dépôt. */
function resoudreModule(
  depuis: string,
  specificateur: string,
  racine: string,
): string | null {
  let base: string;
  if (specificateur.startsWith("@/")) {
    base = join(racine, specificateur.slice(2));
  } else if (specificateur.startsWith(".")) {
    base = resolve(dirname(depuis), specificateur);
  } else {
    return null; // paquet externe — hors du dépôt, hors de ce gardien.
  }
  for (const suffixe of ["", ...EXTENSIONS, "/index.ts", "/index.tsx"]) {
    const chemin = base + suffixe;
    if (existsSync(chemin)) {
      return chemin;
    }
  }
  return null;
}

function fichiersSource(racine: string): string[] {
  const resultats: string[] = [];
  function explorer(dossier: string): void {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (entree.isDirectory()) {
        if (!DOSSIERS_IGNORES.has(entree.name)) {
          explorer(join(dossier, entree.name));
        }
        continue;
      }
      if (
        EXTENSIONS.some((ext) => entree.name.endsWith(ext)) &&
        !estFichierDeTest(entree.name)
      ) {
        resultats.push(join(dossier, entree.name));
      }
    }
  }
  if (existsSync(racine)) {
    explorer(racine);
  }
  return resultats;
}

/**
 * Le détecteur. `racines` : les dossiers balayés — `app/`, `components/`,
 * `lib/` sur le dépôt réel ; le dossier de la fixture, dans l'épreuve.
 */
function violationsDeFrontiere(
  depot: string,
  racines: readonly string[],
): Violation[] {
  const violations: Violation[] = [];
  const exportsClientCache = new Map<string, Set<string> | null>();

  function exportsClientDe(chemin: string): Set<string> | null {
    const enCache = exportsClientCache.get(chemin);
    if (enCache !== undefined) {
      return enCache;
    }
    let contenu: string;
    try {
      contenu = readFileSync(chemin, "utf8");
    } catch {
      exportsClientCache.set(chemin, null);
      return null;
    }
    const valeur = estModuleClient(contenu)
      ? exportsDeValeurCamelCase(contenu)
      : null;
    exportsClientCache.set(chemin, valeur);
    return valeur;
  }

  const fichiers = racines.flatMap((racine) =>
    fichiersSource(join(depot, racine)),
  );
  for (const fichier of fichiers) {
    const contenu = readFileSync(fichier, "utf8");
    if (estModuleClient(contenu)) {
      // Un module client qui en importe un autre ne franchit aucune
      // frontière : les deux vivent déjà côté client.
      continue;
    }
    for (const { module, noms } of importsNommes(contenu)) {
      const resolu = resoudreModule(fichier, module, depot);
      if (resolu === null || resolu === fichier) {
        continue;
      }
      const exportsClient = exportsClientDe(resolu);
      if (exportsClient === null) {
        continue;
      }
      for (const nom of noms) {
        if (exportsClient.has(nom)) {
          violations.push({
            fichier,
            importe: nom,
            depuisModuleClient: resolu,
          });
        }
      }
    }
  }
  return violations;
}

describe("le détecteur, mis à l'épreuve", () => {
  function fixture(): string {
    const dossier = mkdtempSync(join(tmpdir(), "frontiere-serveur-client-"));
    return dossier;
  }

  it("rougit sur l'arrangement exact d'avant ce lot — une fonction camelCase d'un module `\"use client\"` APPELÉE par un composant serveur", () => {
    const depot = fixture();
    try {
      mkdirSync(join(depot, "components", "parc"), { recursive: true });
      mkdirSync(join(depot, "app"), { recursive: true });
      // Reconstitue `components/parc/formulaire-machine.tsx` d'avant PARC-TER :
      // `"use client"`, et `tousLesResultats` exportée à côté du composant.
      writeFileSync(
        join(depot, "components", "parc", "formulaire-machine.tsx"),
        [
          '"use client";',
          "",
          "export async function tousLesResultats(page, tailleDePage) {",
          "  return page(1);",
          "}",
          "",
          "export function FormulaireMachine() {",
          "  return null;",
          "}",
        ].join("\n"),
      );
      // Reconstitue `app/(back-office)/parc/nouvelle/page.tsx` : un composant
      // serveur qui APPELLE `tousLesResultats`, jamais ne la rend en JSX.
      writeFileSync(
        join(depot, "app", "page.tsx"),
        [
          'import { FormulaireMachine, tousLesResultats } from "@/components/parc/formulaire-machine";',
          "",
          "export default async function Page() {",
          "  const resultats = await tousLesResultats(() => [], 200);",
          "  return FormulaireMachine();",
          "}",
        ].join("\n"),
      );

      const violations = violationsDeFrontiere(depot, ["app", "components"]);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        fichier: join(depot, "app", "page.tsx"),
        importe: "tousLesResultats",
        depuisModuleClient: join(
          depot,
          "components",
          "parc",
          "formulaire-machine.tsx",
        ),
      });
    } finally {
      rmSync(depot, { recursive: true, force: true });
    }
  });

  it("reste vert sur l'usage légitime — un composant PascalCase rendu en JSX", () => {
    const depot = fixture();
    try {
      mkdirSync(join(depot, "components"), { recursive: true });
      mkdirSync(join(depot, "app"), { recursive: true });
      writeFileSync(
        join(depot, "components", "bouton.tsx"),
        [
          '"use client";',
          "",
          "export function Bouton() {",
          "  return null;",
          "}",
        ].join("\n"),
      );
      writeFileSync(
        join(depot, "app", "page.tsx"),
        [
          'import { Bouton } from "@/components/bouton";',
          "",
          "export default function Page() {",
          "  return Bouton();",
          "}",
        ].join("\n"),
      );

      expect(violationsDeFrontiere(depot, ["app", "components"])).toEqual([]);
    } finally {
      rmSync(depot, { recursive: true, force: true });
    }
  });

  it("reste vert quand un module client importe d'un autre module client — aucune frontière n'y est franchie", () => {
    const depot = fixture();
    try {
      mkdirSync(join(depot, "components"), { recursive: true });
      writeFileSync(
        join(depot, "components", "source.tsx"),
        [
          '"use client";',
          "",
          "export function util() {",
          "  return 1;",
          "}",
        ].join("\n"),
      );
      writeFileSync(
        join(depot, "components", "appelant.tsx"),
        [
          '"use client";',
          "",
          'import { util } from "@/components/source";',
          "",
          "export function Composant() {",
          "  return util();",
          "}",
        ].join("\n"),
      );

      expect(violationsDeFrontiere(depot, ["components"])).toEqual([]);
    } finally {
      rmSync(depot, { recursive: true, force: true });
    }
  });
});

describe("le dépôt réel", () => {
  const RACINE = process.cwd();

  it('TÉMOIN — la population balayée n\'est pas vide, et elle porte au moins un module `"use client"`', () => {
    // *Un décompte nul ressemble toujours à un sans-faute* (§9, 30/08) : sans
    // ce témoin, un chemin cassé dans `fichiersSource` rendrait zéro fichier
    // et ce gardien passerait au vert sur rien.
    const fichiers = ["app", "components", "lib"].flatMap((racine) =>
      fichiersSource(join(RACINE, racine)),
    );
    expect(fichiers.length).toBeGreaterThan(100);
    const modulesClients = fichiers.filter((fichier) =>
      estModuleClient(readFileSync(fichier, "utf8")),
    );
    expect(modulesClients.length).toBeGreaterThan(0);
  });

  it("aucune fonction ou constante d'un module `\"use client\"` n'est appelée depuis un composant serveur", () => {
    const violations = violationsDeFrontiere(RACINE, [
      "app",
      "components",
      "lib",
    ]);
    expect(
      violations,
      violations
        .map(
          (v) =>
            `${v.fichier} importe « ${v.importe} » depuis le module client ${v.depuisModuleClient}`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("`tousLesResultats` vit dans le fichier NEUTRE, et ni la page ni le formulaire ne l'appellent plus par-dessus la frontière (PARC-TER)", () => {
    const pagination = readFileSync(
      join(RACINE, "components", "parc", "pagination.ts"),
      "utf8",
    );
    expect(estModuleClient(pagination)).toBe(false);
    expect(pagination).toContain("export async function tousLesResultats");

    const page = readFileSync(
      join(RACINE, "app", "(back-office)", "parc", "nouvelle", "page.tsx"),
      "utf8",
    );
    expect(page).toContain(
      'import { tousLesResultats } from "@/components/parc/pagination"',
    );
  });
});
