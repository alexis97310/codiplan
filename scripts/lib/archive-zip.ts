import { inflateRawSync } from "node:zlib";

/**
 * UN LECTEUR D'ARCHIVE STRICT — pour GARDER un fichier qu'on fabrique (L1-11).
 *
 * ## Pourquoi il existe, et pourquoi un lecteur tolérant ne suffisait pas
 *
 * `scripts/fabriquer-classeur-epreuve.mts` a produit pendant une journée un
 * `.xlsx` dont **le répertoire central annonçait STORED et les octets étaient
 * DEFLATE** — deux octets de décalage, la méthode écrite à l'offset de l'en-tête
 * LOCAL dans une structure qui ne partage pas sa disposition. *Le `zipfile` de
 * Python refusait les cinq entrées ; `read-excel-file` les ouvrait sans rien
 * dire.*
 *
 * **Le gardien qui relisait le fichier avec le même lecteur tolérant ne gardait
 * donc rien** : il prouvait que notre lecteur ouvre notre archive, ce qui est
 * vrai d'une archive malformée. *Un vert mesuré à un endroit et annoncé pour un
 * autre* (§9, 02/09) — et l'endroit qui compte est l'Excel d'un client, que
 * D90 a précisément mis au centre.
 *
 * ## CE QUI REND CE LECTEUR CRÉDIBLE N'EST PAS SA SÉVÉRITÉ, C'EST SON TÉMOIN
 *
 * Un lecteur strict écrit par celui qui écrit l'archive pourrait partager son
 * erreur — *deux erreurs identiques ne se contredisent jamais* (§9, 10/09). Il
 * est donc éprouvé sur `tests/fixtures/dates-excel.xlsx`, **un vrai fichier
 * produit par Excel**, que ce dépôt ne contrôle pas : s'il se trompait de
 * disposition, il refuserait l'authentique. *C'est l'indépendance par une
 * source qu'on ne contrôle pas, jamais par une recopie* (§9, 01/09).
 *
 * ## IL LIT PAR LE RÉPERTOIRE CENTRAL, comme un vrai lecteur
 *
 * **C'est le chemin normal — toute lecture d'archive commence par la fin.** Un
 * lecteur qui partirait des en-têtes locaux aurait ouvert le fichier fautif
 * sans broncher, puisque les locaux, eux, étaient justes. *Ce qu'on garde est
 * ce qu'un tiers lira, pas ce qui nous arrange.*
 */

const SIGNATURE_FIN = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;

/** Les deux seules méthodes admises. Tout le reste est un refus nommé. */
export const METHODE_STORED = 0;
export const METHODE_DEFLATE = 8;

/**
 * CRC-32, écrit UNE FOIS et partagé avec le fabricant.
 *
 * **Le partage est ici une garantie et non une facilité** : si cette fonction
 * était fausse, le fichier AUTHENTIQUE serait refusé, et c'est le témoin qui le
 * dirait. *Deux implémentations se seraient annulées* — celle qui écrit et
 * celle qui vérifie auraient été fausses ensemble sans jamais se contredire.
 */
export function crc32(octets: Buffer): number {
  let reste = 0xffffffff;
  for (const octet of octets) {
    reste ^= octet;
    for (let bit = 0; bit < 8; bit += 1) {
      reste = reste & 1 ? (reste >>> 1) ^ 0xedb88320 : reste >>> 1;
    }
  }
  return (reste ^ 0xffffffff) >>> 0;
}

/** Ce qu'une entrée lue rend — son nom, ses champs, et son contenu VÉRIFIÉ. */
export type EntreeArchive = {
  readonly nom: string;
  /** Ce que le RÉPERTOIRE CENTRAL annonce. */
  readonly methodeCentrale: number;
  readonly drapeauxCentraux: number;
  /** Ce que l'EN-TÊTE LOCAL annonce. */
  readonly methodeLocale: number;
  readonly drapeauxLocaux: number;
  readonly crc: number;
  readonly contenu: Buffer;
};

/** Le refus porte son motif : *un refus qui ne dit pas ce qui bloque fait chercher ailleurs.* */
export class ArchiveMalformee extends Error {}

function exiger(condition: boolean, motif: string): void {
  if (!condition) throw new ArchiveMalformee(motif);
}

/**
 * Lit une archive en passant par le RÉPERTOIRE CENTRAL, et refuse tout écart.
 *
 * **Les quatre refus, et chacun a sa raison d'être là :**
 *
 *   1. *la méthode centrale et la méthode locale s'accordent* — c'est LE défaut
 *      du 14/09, et aucun autre contrôle ne l'aurait vu ;
 *   2. *les drapeaux valent zéro* — le bit 3 renvoie les tailles à un
 *      descripteur placé APRÈS les données, et une archive qu'on fabrique n'a
 *      aucune raison d'en avoir un ;
 *   3. *les tailles et le CRC s'accordent entre les deux en-têtes* ;
 *   4. *le CRC du contenu DÉCOMPRESSÉ est celui qu'on annonce* — c'est ce qui
 *      transforme un champ mal placé en refus plutôt qu'en octets illisibles.
 */
export function lireArchiveStricte(octets: Buffer): readonly EntreeArchive[] {
  const fin = octets.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  exiger(fin >= 0, "aucune fin de répertoire central (PK\\x05\\x06)");
  exiger(
    octets.readUInt32LE(fin) === SIGNATURE_FIN,
    "signature de fin de répertoire incorrecte",
  );

  const nombre = octets.readUInt16LE(fin + 10);
  const debut = octets.readUInt32LE(fin + 16);
  exiger(nombre > 0, "le répertoire central ne déclare aucune entrée");

  const entrees: EntreeArchive[] = [];
  let position = debut;

  for (let rang = 0; rang < nombre; rang += 1) {
    exiger(
      octets.readUInt32LE(position) === SIGNATURE_CENTRAL,
      `entrée ${rang} : signature de répertoire central incorrecte`,
    );
    // La disposition CENTRALE — elle porte une « version d'écriture » de deux
    // octets à l'offset 4 que l'en-tête local n'a pas, et tout ce qui suit est
    // donc décalé d'autant.
    const drapeauxCentraux = octets.readUInt16LE(position + 8);
    const methodeCentrale = octets.readUInt16LE(position + 10);
    const crc = octets.readUInt32LE(position + 16);
    const tailleComprimee = octets.readUInt32LE(position + 20);
    const tailleOrigine = octets.readUInt32LE(position + 24);
    const longueurNom = octets.readUInt16LE(position + 28);
    const longueurExtra = octets.readUInt16LE(position + 30);
    const longueurCommentaire = octets.readUInt16LE(position + 32);
    const decalage = octets.readUInt32LE(position + 42);
    const nom = octets
      .subarray(position + 46, position + 46 + longueurNom)
      .toString("utf8");

    exiger(
      drapeauxCentraux === 0,
      `${nom} : drapeaux ${drapeauxCentraux} au répertoire central — seul 0 est admis`,
    );
    exiger(
      methodeCentrale === METHODE_DEFLATE || methodeCentrale === METHODE_STORED,
      `${nom} : méthode ${methodeCentrale} inconnue au répertoire central`,
    );

    // La disposition LOCALE — la méthode y est à l'offset 8, deux octets plus
    // tôt qu'au central. *C'est la confusion des deux qui a produit le défaut.*
    exiger(
      octets.readUInt32LE(decalage) === SIGNATURE_LOCAL,
      `${nom} : signature d'en-tête local incorrecte`,
    );
    const drapeauxLocaux = octets.readUInt16LE(decalage + 6);
    const methodeLocale = octets.readUInt16LE(decalage + 8);
    const crcLocal = octets.readUInt32LE(decalage + 14);
    const comprimeeLocale = octets.readUInt32LE(decalage + 18);
    const origineLocale = octets.readUInt32LE(decalage + 22);
    const nomLocalLongueur = octets.readUInt16LE(decalage + 26);
    const extraLocalLongueur = octets.readUInt16LE(decalage + 28);

    exiger(
      methodeLocale === methodeCentrale,
      `${nom} : le répertoire central annonce la méthode ${methodeCentrale} ` +
        `et l'en-tête local ${methodeLocale} — un lecteur qui se fie au ` +
        "central lira des octets qu'il ne sait pas interpréter",
    );
    exiger(
      drapeauxLocaux === drapeauxCentraux,
      `${nom} : drapeaux discordants entre les deux en-têtes`,
    );
    exiger(
      crcLocal === crc &&
        comprimeeLocale === tailleComprimee &&
        origineLocale === tailleOrigine,
      `${nom} : CRC ou tailles discordants entre les deux en-têtes`,
    );

    const depart = decalage + 30 + nomLocalLongueur + extraLocalLongueur;
    const brut = octets.subarray(depart, depart + tailleComprimee);
    const contenu =
      methodeCentrale === METHODE_DEFLATE ? inflateRawSync(brut) : brut;

    exiger(
      contenu.length === tailleOrigine,
      `${nom} : ${contenu.length} octets décompressés pour ${tailleOrigine} annoncés`,
    );
    exiger(
      crc32(contenu) === crc,
      `${nom} : CRC-32 du contenu ${crc32(contenu)} pour ${crc} annoncé`,
    );

    entrees.push({
      nom,
      methodeCentrale,
      drapeauxCentraux,
      methodeLocale,
      drapeauxLocaux,
      crc,
      contenu: Buffer.from(contenu),
    });

    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }

  return entrees;
}
