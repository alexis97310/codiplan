import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { crc32, METHODE_DEFLATE } from "./lib/archive-zip";
import {
  CHEMIN_FIXTURE_DATES,
  FEUILLES_FIXTURE_DATES,
  FEUILLES_VIDES,
  cellulesParFeuille,
} from "./lib/fixture-dates";

/**
 * FABRIQUER LA FIXTURE DE DATES — et la fabriquer plutôt que l'emprunter (9L00).
 *
 * ## Pourquoi ce script existe, et ce qu'il remplace
 *
 * `tests/fixtures/dates-excel.xlsx` était *tirée PAR RETRAIT* d'un classeur
 * réel (D90) — mesuré le 10/11/2026, elle en portait encore environ 4 390
 * dates réelles et les volumes du classeur réel. I9 ne distingue pas la donnée
 * métier de la donnée de structure : ce fichier n'a plus sa place au dépôt
 * PUBLIC. **Décision d'Alexis du 10/11/2026 (D244)** : la fixture est
 * désormais CALCULÉE, sur le modèle exact de
 * `scripts/fabriquer-classeur-epreuve.mts` pour les classeurs clients.
 *
 * *Un binaire posé dans un dépôt est un binaire que personne ne peut relire* —
 * d'où le script plutôt que le fichier seul, et la confrontation octet pour
 * octet dans `tests/unit/excel/fixture-dates.test.ts`.
 *
 * ## Ce que cette fixture ne prouve plus
 *
 * L'ancienne fixture avait une seconde vertu : être un fichier qu'Excel a
 * réellement produit, témoin indépendant pour `lireArchiveStricte`
 * (`scripts/lib/archive-zip.ts`). Une fixture calculée n'a aucune provenance —
 * elle ne peut plus servir ce rôle, et ce script ne prétend pas le contraire :
 * aucun `docProps/app.xml` n'est écrit ici, pour ne pas affirmer une origine
 * Excel qui serait fausse.
 *
 * Usage :
 *   pnpm exec tsx scripts/fabriquer-fixture-dates-excel.mts
 */

/**
 * Le XML admet cinq entités ; aucune n'est nécessaire ici — toutes les
 * cellules sont NUMÉRIQUES, jamais du texte (c'est la seule façon de garder
 * `sharedStrings.xml` vide, qui est le témoin de confidentialité du gardien).
 */
function ligneDeCellules(
  rang: number,
  cellules: ReadonlyArray<{ readonly ref: string; readonly serie: number }>,
): string {
  const deLaLigne = cellules.filter(
    (c) => Number(/\d+$/.exec(c.ref)?.[0]) === rang,
  );
  if (deLaLigne.length === 0) return "";
  return (
    `<row r="${rang}">` +
    deLaLigne
      .map((c) => `<c r="${c.ref}" s="0"><v>${c.serie}</v></c>`)
      .join("") +
    "</row>"
  );
}

function feuilleXml(nom: string): string {
  const cellules = cellulesParFeuille(nom);
  const dernierRang = Math.max(
    0,
    ...cellules.map((c) => Number(/\d+$/.exec(c.ref)?.[0]) || 0),
  );
  const lignes = Array.from({ length: dernierRang }, (_, i) =>
    ligneDeCellules(i + 1, cellules),
  )
    .filter((l) => l !== "")
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${lignes}</sheetData></worksheet>`
  );
}

const NOMS_FEUILLES = FEUILLES_FIXTURE_DATES;

/**
 * UN SEUL STYLE, référencé par toute cellule numérique : `numFmtId="14"` est le
 * format DATE intégré d'Excel (`mm-dd-yy`) — c'est lui qui atteste, dans
 * `styles.xml`, que les nombres portés sont des dates et non des quantités.
 */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="1"><font/></fonts>' +
  '<fills count="1"><fill/></fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
  '<cellXfs count="1"><xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs>' +
  "</styleSheet>";

/** Vide — aucune cellule de cette fixture ne porte de texte. */
const SHARED_STRINGS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>';

const CLASSEUR =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  "<sheets>" +
  NOMS_FEUILLES.map(
    (nom, i) =>
      `<sheet name="${nom}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join("") +
  "</sheets></workbook>";

const LIENS_CLASSEUR =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  NOMS_FEUILLES.map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"` +
      ` Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join("") +
  `<Relationship Id="rId${NOMS_FEUILLES.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"` +
  ' Target="styles.xml"/>' +
  `<Relationship Id="rId${NOMS_FEUILLES.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings"` +
  ' Target="sharedStrings.xml"/>' +
  "</Relationships>";

const LIENS_RACINE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"' +
  ' Target="xl/workbook.xml"/></Relationships>';

const TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
  NOMS_FEUILLES.map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("") +
  "</Types>";

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  ["[Content_Types].xml", TYPES],
  ["_rels/.rels", LIENS_RACINE],
  ["xl/workbook.xml", CLASSEUR],
  ["xl/_rels/workbook.xml.rels", LIENS_CLASSEUR],
  ["xl/styles.xml", STYLES],
  ["xl/sharedStrings.xml", SHARED_STRINGS],
  ...NOMS_FEUILLES.map(
    (nom, i) =>
      [`xl/worksheets/sheet${i + 1}.xml`, feuilleXml(nom)] as const,
  ),
];

// Témoin, pour qui relit ce script : les feuilles vides le sont réellement.
for (const nom of FEUILLES_VIDES) {
  if (cellulesParFeuille(nom).length !== 0) {
    throw new Error(`${nom} devait être vide et ne l'est pas`);
  }
}

/**
 * L'archive — même disposition que `scripts/fabriquer-classeur-epreuve.mts`,
 * répertoire central et en-têtes locaux ACCORDÉS (le défaut du 14/09/2026).
 * Aucune date n'y est écrite : un fichier engendré est IDENTIQUE d'une
 * exécution à l'autre.
 */
function archiver(): Buffer {
  const locaux: Buffer[] = [];
  const entrees: Buffer[] = [];
  let decalage = 0;

  for (const [nom, contenu] of DOCUMENTS) {
    const brut = Buffer.from(contenu, "utf8");
    const comprime = deflateRawSync(brut);
    const somme = crc32(brut);
    const nomOctets = Buffer.from(nom, "utf8");

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4);
    entete.writeUInt16LE(0, 6);
    entete.writeUInt16LE(METHODE_DEFLATE, 8);
    entete.writeUInt32LE(somme, 14);
    entete.writeUInt32LE(comprime.length, 18);
    entete.writeUInt32LE(brut.length, 22);
    entete.writeUInt16LE(nomOctets.length, 26);
    locaux.push(entete, nomOctets, comprime);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(METHODE_DEFLATE, 10);
    central.writeUInt32LE(somme, 16);
    central.writeUInt32LE(comprime.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nomOctets.length, 28);
    central.writeUInt32LE(decalage, 42);
    entrees.push(central, nomOctets);

    decalage += entete.length + nomOctets.length + comprime.length;
  }

  const repertoire = Buffer.concat(entrees);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(DOCUMENTS.length, 8);
  fin.writeUInt16LE(DOCUMENTS.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(decalage, 16);

  return Buffer.concat([...locaux, repertoire, fin]);
}

const CIBLE = join(process.cwd(), CHEMIN_FIXTURE_DATES);
const octets = archiver();
writeFileSync(CIBLE, octets);
process.stdout.write(
  `Fixture de dates FABRIQUÉE — ${CIBLE} (${octets.length} octets, ` +
    `${NOMS_FEUILLES.length} feuilles, aucune donnée réelle).\n`,
);
