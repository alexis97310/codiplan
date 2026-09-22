import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireDate } from "@/lib/excel/format";
import { lireArchiveStricte } from "../../../scripts/lib/archive-zip";

/**
 * LA FIXTURE DE DATES — fabriquée PAR RETRAIT d'un vrai classeur Excel.
 *
 * ## Ce qu'elle est, et pourquoi elle ne peut pas être écrite
 *
 * `tests/fixtures/dates-excel.xlsx` vient du fichier de suivi réel de CODIMA,
 * réenregistré par **Microsoft Excel 16.0300** le 09/09/2026 à 22:04 UTC. **Le
 * fichier source n'entre JAMAIS au dépôt** — il est nommé dans `.gitignore`
 * avant d'être touché (I9).
 *
 * La fixture a été produite en **dézippant, retirant, rezippant** : aucune
 * cellule survivante n'est passée par une bibliothèque d'écriture de classeur.
 * *C'est la sérialisation d'Excel qui est l'objet de la mesure* — un fichier
 * réécrit par openpyxl prouverait ce qu'openpyxl sait faire, pas ce qu'un
 * fichier venu du terrain contient. C'est la limite que la comparaison du
 * 11/09 annonçait elle-même : « aucun fichier produit par Excel lui-même n'a
 * été lu ». Elle est levée.
 *
 * ## Ce qui a été retiré, et ce qui ne l'a pas été
 *
 * Retiré : **tout `<c>` qui n'est pas une cellule NUMÉRIQUE portant un format
 * de date** — textes, montants, en-têtes, formules à résultat texte ;
 * `sharedStrings.xml` vidé ; `calcChain.xml` supprimé.
 *
 * **Retiré EN PLUS de ce que le protocole nommait, et il faut le dire :**
 * `docProps/core.xml` portait le nom d'une personne réelle et
 * `docProps/custom.xml` une étiquette de classification d'entreprise avec deux
 * GUID de locataire. I9 ne distingue pas la donnée métier de la donnée
 * d'en-tête.
 *
 * NON touché : `styles.xml` — *les formats de date sont la preuve* — et
 * `docProps/app.xml`, qui atteste l'origine Excel.
 */

const FIXTURE = join(process.cwd(), "tests/fixtures/dates-excel.xlsx");

/** Les fuseaux sous lesquels la lecture doit rendre exactement la même chose. */
const FUSEAUX = ["UTC", "Pacific/Noumea", "America/Los_Angeles"] as const;

/**
 * Les cellules relevées sur le fichier SOURCE avant qu'une ligne ne soit
 * écrite, et vérifiées ici plutôt que recalculées.
 */
const RELEVE = [
  {
    serie: 42499,
    feuille: "5-Observations VGP",
    ref: "B290",
    jour: "2016-05-09",
  },
  { serie: 44613, feuille: "3-Parc machines", ref: "R254", jour: "2022-02-21" },
  { serie: 44613, feuille: "6-Historique", ref: "D533", jour: "2022-02-21" },
  { serie: 45013, feuille: "3-Parc machines", ref: "R247", jour: "2023-03-28" },
  { serie: 45013, feuille: "6-Historique", ref: "D630", jour: "2023-03-28" },
  { serie: 46575, feuille: "3-Parc machines", ref: "W85", jour: "2027-07-07" },
] as const;

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
      ${RELEVE.map(
        (r) =>
          `out[${JSON.stringify(`${r.feuille}!${r.ref}`)}] = cel(${JSON.stringify(r.feuille)}, ${JSON.stringify(r.ref)});`,
      ).join("\n      ")}
      out["ZERO:3-Parc machines!R4"] = cel("3-Parc machines", "R4");
      process.stdout.write(JSON.stringify(out));
    });
  `;
  const brut = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
  return JSON.parse(brut) as Record<string, string>;
}

/**
 * LES PARTIES DE L'ARCHIVE, lues par le lecteur STRICT du dépôt.
 *
 * Elles l'étaient par le `zipfile` de Python, appelé en sous-processus — et
 * `python3` n'existe pas sur un poste Windows où le dépôt vient d'être cloné
 * (PORTABILITE-1, 22/09/2026). `lireArchiveStricte` lit par le répertoire
 * central, comme `zipfile` le faisait, et il a le même témoin : ce fichier-ci,
 * produit par Excel, que ce dépôt ne contrôle pas (§9, 14/09).
 */
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

describe("la fixture est fidèle et ne porte aucune chaîne", () => {
  it("PREUVE DE CONFIDENTIALITÉ : plus une seule chaîne de caractères", () => {
    // *S'il ne reste pas une chaîne de caractères, il ne reste pas un nom de
    // client.* La preuve est écrite comme un test et non vérifiée à l'œil.
    //
    // **Elle a servi le jour où elle a été écrite :** la première fabrication
    // laissait passer 72 chaînes partagées. Le motif de découpe des cellules
    // lisait `<c r="L3" s="39"/><c r="M3" t="s">…</c>` comme UNE cellule — le
    // moteur revenait en arrière, prenait le « > » du « /> » et courait
    // jusqu'au `</c>` suivant. Une paire survivait ensemble, et la seconde
    // moitié portait une chaîne. *Aucune relecture ne l'aurait vu ; ce test
    // l'a nommé.*
    const zip = readFileSync(FIXTURE).toString("latin1");
    // Le contenu est dégonflé : on décompresse par le répertoire central, le
    // chemin de tout lecteur, et l'on regarde le XML des feuilles.
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
    // parties, dont des feuilles et la table des chaînes. Zéro partie lue
    // rendrait les quatre compteurs nuls aussi.
    expect(PARTIES.size).toBeGreaterThan(10);
    expect(xml.length).toBeGreaterThan(1000);
    expect(PARTIES.has("xl/sharedStrings.xml")).toBe(true);
    expect(zip.slice(0, 2)).toBe("PK");
  });

  it("PREUVE DE FIDÉLITÉ : les styles de date et l'origine Excel sont intacts", () => {
    // `styles.xml` n'est pas touché — les formats de date SONT la preuve — et
    // `docProps/app.xml` atteste que le fichier vient d'Excel et non d'un
    // sérialiseur tiers. Sans lui, la fixture ne prouverait plus rien de ce
    // qu'elle est censée prouver.
    const app = PARTIES.get("docProps/app.xml") ?? "";
    const styles = PARTIES.get("xl/styles.xml") ?? "";
    const workbook = PARTIES.get("xl/workbook.xml") ?? "";
    // Témoin : les trois parties existent — une absence rendrait `""`, et
    // `""` ne contient pas `date1904` non plus.
    expect(app.length).toBeGreaterThan(0);
    expect(styles.length).toBeGreaterThan(0);
    expect(workbook.length).toBeGreaterThan(0);

    expect(/<Application>([^<]*)</.exec(app)?.[1]).toBe("Microsoft Excel");
    expect(/<AppVersion>([^<]*)</.exec(app)?.[1]).toBe("16.0300");
    // Le calendrier 1900 : `date1904` ABSENT, donc origine au 1899-12-30.
    expect(workbook.includes("date1904")).toBe(false);
    // Les formats de date survivent, en nombre.
    expect(compter(styles, 'numFmtId="14"')).toBeGreaterThan(10);
    // Ce qui devait partir est parti.
    expect(PARTIES.has("docProps/core.xml")).toBe(false);
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

  it.each(RELEVE)(
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
      RELEVE.length,
    );
  });
});

describe("LE ZÉRO N'EST PAS UNE DATE", () => {
  /**
   * 171 cellules à zéro, toutes dans la colonne « Dernière intervention » de
   * l'onglet parc. Zéro y veut dire **jamais d'intervention** : une absence,
   * pas une saisie fautive et pas le 30 décembre 1899.
   */
  it("la bibliothèque, elle, rend le 30 décembre 1899 — et c'est le piège", () => {
    // Mesuré, sous les trois fuseaux. *Ce n'est pas un reproche à la
    // bibliothèque : c'est la raison pour laquelle la liaison ne suffit pas et
    // pour laquelle `lireDate` existe.*
    for (const tz of FUSEAUX) {
      expect(lireSousFuseau(tz)["ZERO:3-Parc machines!R4"]).toBe(
        "1899-12-30T00:00:00.000Z",
      );
    }
  });

  it("LE JUMEAU : le même code rend une absence sur 0 et une date sur 44613", () => {
    const zero = lireDate({ serie: 0 });
    const vraie = lireDate({ serie: 44613 });
    expect(zero.ok).toBe(false);
    expect(zero.ok === false && zero.anomalie.code).toBe("cellule_vide");
    expect(vraie.ok).toBe(true);
    expect(vraie.ok === true && vraie.valeur.toISOString()).toBe(
      "2022-02-21T00:00:00.000Z",
    );
  });

  it("le zéro est une ABSENCE, jamais une anomalie de plage", () => {
    // La distinction n'est pas cosmétique : rangé sous `date_hors_plage`, le
    // zéro ferait REJETER 171 machines pour un champ légitimement vide, ce qui
    // est le contraire de ce que I6 promet.
    const zero = lireDate({ serie: 0 });
    expect(zero.ok === false && zero.anomalie.code).not.toBe("date_hors_plage");
  });
});

describe("le bogue du 29 février 1900 — CAS FABRIQUÉ, dit comme tel", () => {
  /**
   * **IL NE PEUT PAS ÊTRE MESURÉ SUR CE FICHIER, et c'est écrit plutôt que
   * laissé croire.** La date la plus ancienne du classeur réel est le
   * **2016-05-09** ; aucune n'est antérieure à 1901. Les sérials ci-dessous
   * sont **FABRIQUÉS** : ils prouvent que `lireDate` sait mordre, ils ne
   * prouvent rien de ce qu'un fichier du terrain contient (§9, 21/08).
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
