import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import {
  CHEMIN_EPREUVE,
  ENTETES_EPREUVE,
  LIGNES_EPREUVE,
  MARQUEUR_EPREUVE,
} from "./lib/classeur-epreuve";

/**
 * FABRIQUER LE CLASSEUR D'ÉPREUVE — et le fabriquer plutôt que l'emprunter.
 *
 * ## Pourquoi ce script existe
 *
 * Un ticket d'import est **exactement l'endroit où l'on est tenté de déposer
 * « un petit fichier d'exemple pour éprouver »**. I9 l'interdit : *aucun fichier
 * de données réelles n'entre au dépôt, jamais* — et le dépôt est PUBLIC depuis
 * le 12/09/2026, si bien qu'un fichier entré aujourd'hui reste lisible dans
 * l'historique même retiré demain. **La STRUCTURE d'un classeur peut entrer ;
 * son CONTENU jamais.**
 *
 * Le classeur d'épreuve est donc **entièrement inventé** : trois raisons
 * sociales qui ne ressemblent à aucun client, des RIDET qui n'en sont pas.
 *
 * ## Et pourquoi un SCRIPT plutôt qu'un fichier déposé
 *
 * *Un binaire posé dans un dépôt est un binaire que personne ne peut relire.*
 * `tests/fixtures/dates-excel.xlsx` porte la structure du fichier réel et se
 * justifie par sa provenance — il a été tiré PAR RETRAIT (D90). Celui-ci n'a
 * aucune provenance : il est calculé, et le calcul est ici.
 *
 * ## CE QUE CE SCRIPT MESURE, ET QUI N'EST PAS UNE DÉCISION
 *
 * **Écrire un `.xlsx` minimal tient en une centaine de lignes sans dépendance**
 * — une archive ZIP « stockée ou dégonflée » et cinq documents XML. C'est une
 * MESURE, et elle est écrite ici parce qu'elle intéresse L1-09 et RG-IMP-03,
 * tous deux bloqués sur *« il faut une bibliothèque d'ÉCRITURE .xlsx »*.
 *
 * **Elle ne tranche rien**, et il faut le dire aussi net : ce qu'un GABARIT
 * téléchargeable demande n'est pas ce que fait ce script. Il écrit six colonnes
 * de texte connu d'avance ; un gabarit doit porter des dates, des nombres, des
 * échappements, des largeurs de colonne, et **être ouvert par l'Excel d'un
 * client** — c'est-à-dire tolérer ce qu'un tableur réel exige et que ce script
 * n'a jamais eu à produire. *Une épreuve qui passe sur read-excel-file ne dit
 * rien de ce qu'Excel acceptera.* La décision reste un point d'arrêt du §8.
 *
 * Usage :
 *   pnpm exec tsx scripts/fabriquer-classeur-epreuve.mts
 */

/** La lettre d'une colonne : 0 → A, 26 → AA. */
function colonne(indice: number): string {
  let reste = indice;
  let lettres = "";
  while (reste >= 0) {
    lettres = String.fromCharCode(65 + (reste % 26)) + lettres;
    reste = Math.floor(reste / 26) - 1;
  }
  return lettres;
}

/** Le XML admet cinq entités, et une chaîne non échappée casse l'archive. */
function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Une cellule en CHAÎNE EMBARQUÉE (`inlineStr`).
 *
 * *Le format admet aussi une table de chaînes partagées, et c'est ce qu'Excel
 * écrit* ; l'embarquée demande un document de moins et se relit à l'œil. Une
 * cellule vide n'a **aucun contenu**, jamais une chaîne vide : les deux ne se
 * lisent pas pareil, et `lireDate` range la seconde en absence tout de même —
 * mais l'écrire serait affirmer que l'auteur a tapé quelque chose.
 */
function cellule(indice: number, rang: number, valeur: string): string {
  const reference = `${colonne(indice)}${rang}`;
  if (valeur === "") return `<c r="${reference}"/>`;
  return (
    `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">` +
    `${echapper(valeur)}</t></is></c>`
  );
}

const TOUTES = [[MARQUEUR_EPREUVE], [...ENTETES_EPREUVE], ...LIGNES_EPREUVE];

const FEUILLE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  "<sheetData>" +
  TOUTES.map(
    (ligne, rang) =>
      `<row r="${rang + 1}">` +
      ligne
        .map((valeur, indice) => cellule(indice, rang + 1, valeur))
        .join("") +
      "</row>",
  ).join("") +
  "</sheetData></worksheet>";

const CLASSEUR =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets></workbook>';

const LIENS_CLASSEUR =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
  ' Target="worksheets/sheet1.xml"/></Relationships>';

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
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  "</Types>";

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  ["[Content_Types].xml", TYPES],
  ["_rels/.rels", LIENS_RACINE],
  ["xl/workbook.xml", CLASSEUR],
  ["xl/_rels/workbook.xml.rels", LIENS_CLASSEUR],
  ["xl/worksheets/sheet1.xml", FEUILLE],
];

/** CRC-32, que l'entête ZIP exige pour chaque document. */
function crc32(octets: Buffer): number {
  let reste = 0xffffffff;
  for (const octet of octets) {
    reste ^= octet;
    for (let bit = 0; bit < 8; bit += 1) {
      reste = reste & 1 ? (reste >>> 1) ^ 0xedb88320 : reste >>> 1;
    }
  }
  return (reste ^ 0xffffffff) >>> 0;
}

/**
 * L'archive.
 *
 * **Aucune date n'y est écrite** — les champs d'horodatage restent à zéro — et
 * c'est délibéré : *un fichier engendré doit être IDENTIQUE d'une exécution à
 * l'autre*, sans quoi il change à chaque fabrication et le dépôt enregistre une
 * différence qui ne dit rien.
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
    entete.writeUInt16LE(8, 8);
    entete.writeUInt32LE(somme, 14);
    entete.writeUInt32LE(comprime.length, 18);
    entete.writeUInt32LE(brut.length, 22);
    entete.writeUInt16LE(nomOctets.length, 26);
    locaux.push(entete, nomOctets, comprime);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 8);
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

const CIBLE = join(process.cwd(), CHEMIN_EPREUVE);
const octets = archiver();
writeFileSync(CIBLE, octets);
process.stdout.write(
  `Classeur d'épreuve FABRIQUÉ — ${CIBLE} (${octets.length} octets, ` +
    `${LIGNES_EPREUVE.length} lignes inventées, dont 1 sans raison sociale).\n`,
);
