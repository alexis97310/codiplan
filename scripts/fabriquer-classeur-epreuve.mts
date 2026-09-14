import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { crc32, METHODE_DEFLATE } from "./lib/archive-zip";
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

/**
 * LA MÉTHODE ET LE CRC VIENNENT DU LECTEUR, ils ne sont pas écrits ici.
 *
 * **Le partage est une garantie et non une facilité.** Si `crc32` était faux,
 * le lecteur strict refuserait le fichier AUTHENTIQUE d'Excel, et son témoin le
 * dirait. *Deux implémentations se seraient annulées* — celle qui écrit et
 * celle qui vérifie auraient été fausses ensemble sans jamais se contredire
 * (§9, 10/09 : deux erreurs identiques ne se contredisent jamais).
 */

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

    // ── L'EN-TÊTE LOCAL — 30 octets, et la méthode y est à l'offset 8 ──────
    //
    // Chaque champ porte son offset en commentaire. *C'est la seule façon de
    // relire une disposition binaire* : un `writeUInt16LE(8, 8)` ne dit ni ce
    // qu'il écrit ni où, et les deux se lisent de la même façon.
    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0); //  0 signature
    entete.writeUInt16LE(20, 4); //  4 version minimale
    entete.writeUInt16LE(0, 6); //  6 drapeaux
    entete.writeUInt16LE(METHODE_DEFLATE, 8); //  8 méthode
    // 10 heure, 12 date — laissées à ZÉRO, voir `archiver`
    entete.writeUInt32LE(somme, 14); // 14 CRC-32
    entete.writeUInt32LE(comprime.length, 18); // 18 taille compressée
    entete.writeUInt32LE(brut.length, 22); // 22 taille d'origine
    entete.writeUInt16LE(nomOctets.length, 26); // 26 longueur du nom
    // 28 longueur du champ « extra » — zéro, il n'y en a pas
    locaux.push(entete, nomOctets, comprime);

    // ── L'EN-TÊTE CENTRAL — 46 octets, ET SA DISPOSITION DIFFÈRE ──────────
    //
    // **CE N'EST PAS L'EN-TÊTE LOCAL AVEC QUATRE CHAMPS EN PLUS.** Il porte
    // une `version made by` de 2 octets à l'offset 4 qui n'existe pas là-bas,
    // et **tout ce qui suit est donc décalé de deux octets** : les drapeaux
    // sont à 8, la méthode à 10.
    //
    // *La première rédaction a recopié la ligne de l'en-tête local* — méthode
    // à l'offset 8 — et a donc écrit **drapeaux = 8, méthode = 0 (STORED)**
    // pendant que les octets, eux, étaient bel et bien dégonflés. Mesuré sur
    // le fichier produit, et relevé par l'exploitation le 14/09/2026 : les
    // cinq entrées annonçaient STORED au répertoire central et DEFLATE en
    // local. **Un lecteur qui se fie au répertoire central — c'est le chemin
    // normal, toute lecture d'archive commence par lui — lit des octets
    // compressés comme du texte brut**, et le `zipfile` de Python refuse les
    // cinq sur un CRC qui ne peut pas correspondre.
    //
    // *Deux dispositions qui se ressemblent sont plus dangereuses que deux qui
    // ne se ressemblent pas* : la recopie compile, s'exécute, et produit un
    // fichier qu'un lecteur tolérant ouvre sans rien dire.
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); //  0 signature
    central.writeUInt16LE(20, 4); //  4 version d'écriture — ABSENT en local
    central.writeUInt16LE(20, 6); //  6 version minimale
    central.writeUInt16LE(0, 8); //  8 drapeaux ← PAS la méthode
    central.writeUInt16LE(METHODE_DEFLATE, 10); // 10 méthode ← DEUX octets plus loin
    // 12 heure, 14 date — à ZÉRO comme en local
    central.writeUInt32LE(somme, 16); // 16 CRC-32
    central.writeUInt32LE(comprime.length, 20); // 20 taille compressée
    central.writeUInt32LE(brut.length, 24); // 24 taille d'origine
    central.writeUInt16LE(nomOctets.length, 28); // 28 longueur du nom
    // 30 extra, 32 commentaire, 34 disque, 36 attributs internes,
    // 38 attributs externes — tous à ZÉRO, et c'est ce qu'un fichier sans
    // droits ni commentaire doit porter
    central.writeUInt32LE(decalage, 42); // 42 position de l'en-tête local
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
