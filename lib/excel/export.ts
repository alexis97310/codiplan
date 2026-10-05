import writeXlsxFile, { type SheetData } from "write-excel-file/node";

/**
 * L'ÉCRITURE D'UN CLASSEUR D'EXPORT — UNE SEULE FEUILLE (MO-9, D169).
 *
 * `write-excel-file` porte déjà `classeurDesRejets` (`lib/excel/ecriture.ts`,
 * D90) : le motif de la dépendance ne se réécrit pas une seconde fois ici.
 *
 * **Ce module ne CHOISIT aucune colonne** — l'appelant lui donne les
 * en-têtes (les libellés de l'écran, `lib/i18n/fr.ts`) et les lignes déjà
 * composées en chaînes ; c'est à l'appelant de ne jamais y poser un montant
 * (D169 : « aucun montant » est un choix du pilote, pas une règle que ce
 * module pourrait faire respecter sans connaître le sens d'une colonne).
 */
export async function classeurDUneFeuille(
  entetes: readonly string[],
  lignes: readonly (readonly string[])[],
): Promise<Buffer> {
  const donnees: SheetData = [
    [...entetes],
    ...lignes.map((ligne) => [...ligne]),
  ];
  return writeXlsxFile(donnees).toBuffer();
}

/** Le nom de fichier d'un export — `<écran>-<AAAA-MM-JJ>.xlsx` (D169). */
export function nomDuFichierExport(ecran: string, jourIso: string): string {
  return `${ecran}-${jourIso}.xlsx`;
}
