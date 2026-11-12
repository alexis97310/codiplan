import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireDate } from "@/lib/excel/format";
import { lireArchiveStricte } from "../../../scripts/lib/archive-zip";
import {
  REF_ZERO,
  RELEVE_FIXTURE_DATES,
} from "../../../scripts/lib/fixture-dates";

/**
 * LA FIXTURE DE DATES — CALCULÉE, et entièrement inventée (9L00, D244).
 *
 * ## Ce qu'elle est, et pourquoi elle a changé de nature
 *
 * `tests/fixtures/dates-excel.xlsx` était *tirée PAR RETRAIT* d'un classeur
 * réel (D90). Mesuré le 10/11/2026 : elle portait encore environ 4 390 dates
 * réelles et les volumes du classeur réel — I9 ne distingue pas la donnée
 * métier de la donnée de structure, et le dépôt est PUBLIC. **Décision
 * d'Alexis du 10/11/2026 (D244)** : la fixture est désormais fabriquée par
 * `scripts/fabriquer-fixture-dates-excel.mts`, sur le modèle de
 * `scripts/fabriquer-classeur-epreuve.mts`. Aucune valeur ci-dessous ne vient
 * d'un fichier réel.
 *
 * **Ce qu'elle ne prouve plus** : l'ancienne fixture était, en plus, un
 * fichier qu'Excel avait réellement produit — un témoin indépendant pour
 * `lireArchiveStricte` (voir `scripts/lib/archive-zip.ts`). Une fixture
 * calculée n'a aucune provenance : ce rôle n'est plus tenu, et ce fichier ne
 * prétend pas le contraire (aucun `docProps/app.xml` n'est écrit).
 */

const FIXTURE = join(process.cwd(), "tests/fixtures/dates-excel.xlsx");

/** Les fuseaux sous lesquels la lecture doit rendre exactement la même chose. */
const FUSEAUX = ["UTC", "Pacific/Noumea", "America/Los_Angeles"] as const;

/**
 * Lit la fixture avec `read-excel-file` dans un processus dont le `TZ` est
 * imposé. Le fuseau se fige au démarrage du processus : le changer dans le
 * processus courant ne déplacerait rien, et la mesure serait creuse.
 *
 * Le chemin entre dans le script par `JSON.stringify`, jamais recopié entre
 * guillemets : sous Windows il porte des `\`, que le script lirait comme des
 * échappements (PORTABILITE-1, 22/09/2026).
 */
function lireSousFuseau(tz: string): Record<string, string> {
  const script = `
    const lire = require("read-excel-file/node");
    const col = (l) => l.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
    lire(${JSON.stringify(FIXTURE)}).then((feuilles) => {
      const par = new Map(feuilles.map((f) => [f.sheet, f.data]));
      const cel = (f, ref) => {
        const m = /^([A-Z]+)(\\d+)$/.exec(ref);
        const v = (par.get(f) || [])[Number(m[2]) - 1];
        const c = v ? v[col(m[1])] : undefined;
        return c instanceof Date ? c.toISOString() : c === null || c === undefined ? "∅" : "!" + String(c);
      };
      const out = {};
      ${RELEVE_FIXTURE_DATES.map(
        (r) =>
          `out[${JSON.stringify(`${r.feuille}!${r.ref}`)}] = cel(${JSON.stringify(r.feuille)}, ${JSON.stringify(r.ref)});`,
      ).join("\n      ")}
      out["ZERO:${REF_ZERO.feuille}!${REF_ZERO.ref}"] = cel(${JSON.stringify(REF_ZERO.feuille)}, ${JSON.stringify(REF_ZERO.ref)});
      process.stdout.write(JSON.stringify(out));
    });
  `;
  const brut = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
  return JSON.parse(brut) as Record<string, string>;
}

/** LES PARTIES DE L'ARCHIVE, lues par le lecteur STRICT du dépôt. */
const PARTIES = new Map(
  lireArchiveStricte(readFileSync(FIXTURE)).map((entree) => [
    entree.nom,
    entree.contenu.toString("utf8"),
  ]),
);

/** Le nombre d'occurrences d'un fragment dans un texte. */
function compter(texte: string, fragment: string): number {
  return texte.split(fragment).length - 1;
}

describe("la fixture ne porte aucune chaîne, et se refabrique à l'identique", () => {
  it("LA CONFRONTATION : le fichier du dépôt est EXACTEMENT ce que le script produit", () => {
    // *Un binaire posé dans un dépôt est un binaire que personne ne peut
    // relire* (I9) — sans confrontation, le fichier et le script qui le
    // décrit dériveraient en silence.
    const avant = readFileSync(FIXTURE);
    expect(avant.length).toBeGreaterThan(500);

    execFileSync(
      "node",
      ["--import", "tsx", "scripts/fabriquer-fixture-dates-excel.mts"],
      { cwd: process.cwd(), stdio: "ignore" },
    );
    const apres = readFileSync(FIXTURE);
    expect(apres.equals(avant)).toBe(true);
  });

  it("PREUVE DE CONFIDENTIALITÉ : pas une seule chaîne de caractères", () => {
    // *S'il ne reste pas une chaîne de caractères, il ne reste pas un nom de
    // client.* Cette fixture n'a jamais porté de texte — toutes ses cellules
    // sont numériques — mais la preuve reste écrite comme un test, pas
    // vérifiée à l'œil (même motif que D90, 09/09/2026).
    const zip = readFileSync(FIXTURE).toString("latin1");
    const xml = [...PARTIES]
      .filter(([nom]) => nom.startsWith("xl/worksheets/"))
      .map(([, contenu]) => contenu)
      .join("");
    const ss = PARTIES.get("xl/sharedStrings.xml") ?? "";
    expect({
      s: compter(xml, 't="s"'),
      str: compter(xml, 't="str"'),
      inline: compter(xml, 't="inlineStr"'),
      si: compter(ss, "<si>"),
    }).toEqual({ s: 0, str: 0, inline: 0, si: 0 });
    // Témoin de non-vacuité : le fichier a bien été ouvert et il porte des
    // parties, dont des feuilles et la table des chaînes.
    expect(PARTIES.size).toBeGreaterThan(10);
    expect(xml.length).toBeGreaterThan(0);
    expect(PARTIES.has("xl/sharedStrings.xml")).toBe(true);
    expect(zip.slice(0, 2)).toBe("PK");
  });

  it("LES FORMATS DE DATE SONT PORTÉS, et aucune origine n'est affirmée", () => {
    // `styles.xml` porte le format numérique DATE (`numFmtId="14"`, le format
    // intégré d'Excel) — c'est lui qui distingue une cellule date d'une
    // cellule nombre. *Et ce fichier n'affirme PLUS venir d'Excel* : la
    // fixture est calculée, elle n'écrit donc aucun `docProps/app.xml`.
    const styles = PARTIES.get("xl/styles.xml") ?? "";
    const workbook = PARTIES.get("xl/workbook.xml") ?? "";
    expect(styles.length).toBeGreaterThan(0);
    expect(workbook.length).toBeGreaterThan(0);

    expect(compter(styles, 'numFmtId="14"')).toBeGreaterThan(0);
    // Le calendrier 1900 : `date1904` ABSENT, donc origine au 1899-12-30.
    expect(workbook.includes("date1904")).toBe(false);
    // Ce qui n'a jamais été écrit n'a pas à être retiré.
    expect(PARTIES.has("docProps/core.xml")).toBe(false);
    expect(PARTIES.has("docProps/app.xml")).toBe(false);
    expect(PARTIES.has("xl/calcChain.xml")).toBe(false);
  });
});

describe("les dates sortent IDENTIQUES sous trois fuseaux", () => {
  /**
   * *Un décalage d'un jour sous un seul fuseau condamne la bibliothèque* — la
   * Nouvelle-Calédonie est à UTC+11, et le serveur ne l'est pas
   * nécessairement. Les trois fuseaux couvrent les deux côtés du méridien.
   */
  const lectures = FUSEAUX.map((tz) => [tz, lireSousFuseau(tz)] as const);

  it.each(RELEVE_FIXTURE_DATES)(
    "sérial $serie → $jour, $feuille!$ref, sous les trois fuseaux",
    ({ feuille, ref, jour }) => {
      for (const [tz, lecture] of lectures) {
        expect(lecture[`${feuille}!${ref}`], `sous ${tz}`).toBe(
          `${jour}T00:00:00.000Z`,
        );
      }
    },
  );

  it("les trois lectures sont rigoureusement la même", () => {
    const [premiere, ...autres] = lectures.map(([, l]) => JSON.stringify(l));
    for (const autre of autres) {
      expect(autre).toBe(premiere);
    }
    // Témoin : la lecture porte des cellules. Trois objets vides seraient
    // égaux eux aussi (§9, 30/08).
    expect(Object.keys(lectures[0]![1]).length).toBeGreaterThanOrEqual(
      RELEVE_FIXTURE_DATES.length,
    );
  });
});

describe("LE ZÉRO N'EST PAS UNE DATE", () => {
  /**
   * Une cellule à zéro, dans la colonne du parc qui porte les dates. Zéro y
   * veut dire **jamais d'intervention** : une absence, pas une saisie fautive
   * et pas le 30 décembre 1899.
   */
  it("la bibliothèque, elle, rend le 30 décembre 1899 — et c'est le piège", () => {
    // Mesuré, sous les trois fuseaux. *Ce n'est pas un reproche à la
    // bibliothèque : c'est la raison pour laquelle la liaison ne suffit pas et
    // pour laquelle `lireDate` existe.*
    for (const tz of FUSEAUX) {
      expect(
        lireSousFuseau(tz)[`ZERO:${REF_ZERO.feuille}!${REF_ZERO.ref}`],
      ).toBe("1899-12-30T00:00:00.000Z");
    }
  });

  it("LE JUMEAU : le même code rend une absence sur 0 et une date sur une vraie série", () => {
    const zero = lireDate({ serie: 0 });
    const vraie = lireDate({ serie: RELEVE_FIXTURE_DATES[1]!.serie });
    expect(zero.ok).toBe(false);
    expect(zero.ok === false && zero.anomalie.code).toBe("cellule_vide");
    expect(vraie.ok).toBe(true);
    expect(vraie.ok === true && vraie.valeur.toISOString()).toBe(
      `${RELEVE_FIXTURE_DATES[1]!.jour}T00:00:00.000Z`,
    );
  });

  it("le zéro est une ABSENCE, jamais une anomalie de plage", () => {
    // La distinction n'est pas cosmétique : rangé sous `date_hors_plage`, le
    // zéro ferait REJETER une machine pour un champ légitimement vide, ce qui
    // est le contraire de ce que I6 promet.
    const zero = lireDate({ serie: 0 });
    expect(zero.ok === false && zero.anomalie.code).not.toBe("date_hors_plage");
  });
});

describe("le bogue du 29 février 1900 — CAS FABRIQUÉ, dit comme tel", () => {
  /**
   * **AUCUN SERIAL DE CETTE FIXTURE N'EN APPROCHE**, et c'est écrit plutôt que
   * laissé croire : la plus ancienne date de la fixture est 2015, loin devant
   * 1901. Les sérials ci-dessous sont FABRIQUÉS indépendamment : ils prouvent
   * que `lireDate` sait mordre, rien d'autre (§9, 21/08).
   */
  it.each([
    [59, "1900-02-27 dans Excel"],
    [60, "le 29 février 1900 qui n'a jamais existé"],
  ])("refuse le sérial fabriqué %i (%s)", (serie) => {
    const lu = lireDate({ serie });
    expect(lu.ok).toBe(false);
    expect(lu.ok === false && lu.anomalie.code).toBe("date_hors_plage");
  });

  it("accepte 61, le premier jour sûr — vert pour SA propre raison", () => {
    const lu = lireDate({ serie: 61 });
    expect(lu.ok).toBe(true);
    expect(lu.ok === true && lu.valeur.toISOString()).toBe(
      "1900-03-01T00:00:00.000Z",
    );
  });
});
