import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { marqueurDu } from "@/lib/imports/modeles";

/**
 * L'ÉCRITURE D'UN CLASSEUR — `write-excel-file`, ADOPTÉE le 16/09/2026.
 *
 * ## Le motif de la dépendance, en une phrase
 *
 * Ce qui a fait écarter SheetJS (D90) est une pollution de prototype qui se
 * déclenche À LA LECTURE d'un fichier apporté ; une bibliothèque d'ÉCRITURE
 * SEULE n'a pas ce vecteur, et celle-ci est du même auteur que
 * `read-excel-file`, déjà en place. Le §2 le demande en une phrase : « en cas
 * de doute, écrire les 30 lignes plutôt qu'ajouter 200 Ko » — ici le doute est
 * levé par l'usage le plus exigeant, RG-IMP-03, qu'aucune écriture maison de
 * cent lignes ne couvrirait aussi sûrement qu'une bibliothèque éprouvée.
 *
 * ## CE MODULE N'ÉCRIT QU'UN FORMAT : celui qu'un gabarit publie déjà
 *
 * Marqueur en ligne 0, en-têtes en ligne 1, données ensuite — exactement
 * `LIGNE_MARQUEUR`, `LIGNE_ENTETES`, `PREMIERE_LIGNE_DONNEES` de
 * `lib/excel/controle.ts`. *Un fichier annoté qui ne respecterait pas cette
 * forme ne serait pas RECHARGEABLE*, ce que RG-IMP-03 exige explicitement, et
 * `apparierColonnes` (D31) ignore de toute façon une colonne « Motif du rejet »
 * qu'il ne connaît pas — « inconnues : ignorées avec avertissement, jamais
 * bloquantes ».
 *
 * ## LES EN-TÊTES VIENNENT DES LIGNES ELLES-MÊMES, jamais d'un second modèle
 *
 * `ligne.valeurs` porte déjà, colonne par colonne, tout ce que `enDictionnaire`
 * a apparié pour CE fichier (`lib/excel/controle.ts`) — et deux lignes d'un
 * même lot partagent le même jeu de clés, l'appariement étant posé une fois
 * pour toute la feuille. *Redemander ces colonnes à `ModeleDImport` serait une
 * seconde lecture d'un même fait, qui diverge en silence le jour où un gabarit
 * change* (§9, 01/09) — surtout qu'un gabarit change ses colonnes sans que
 * cette écriture ait besoin de le savoir.
 */
export async function classeurDesRejets(
  type: string,
  version: number,
  lignes: readonly {
    readonly valeurs: Readonly<Record<string, string | undefined>>;
    readonly motifLisible: string;
  }[],
): Promise<Buffer> {
  const entetes = Object.keys(lignes[0]?.valeurs ?? {});

  const donnees: SheetData = [
    [marqueurDu({ type, version })],
    [...entetes, "Motif du rejet"],
    ...lignes.map((ligne) => [
      ...entetes.map((nom) => ligne.valeurs[nom] ?? ""),
      ligne.motifLisible,
    ]),
  ];

  return writeXlsxFile(donnees).toBuffer();
}
