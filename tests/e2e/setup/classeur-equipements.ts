import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { COLONNES_EQUIPEMENTS, marqueurDu } from "@/lib/imports/modeles";

/**
 * UNE LIGNE DU GABARIT « ÉQUIPEMENTS », DANS L'ORDRE DE `COLONNES_EQUIPEMENTS`
 * (9L40, 25/11/2026) — une chaîne vide devient une cellule ABSENTE, jamais une
 * chaîne vide écrite dans le classeur (même convention que `classeur-vgp.ts`).
 */
export type LigneEquipementEpreuve = readonly [
  client: string,
  site: string,
  marque: string,
  reference: string,
  numeroSerie: string,
  referenceInterne: string,
  localisation: string,
  criticite: string,
];

export async function fabriquerLeClasseurEquipements(
  lignes: readonly LigneEquipementEpreuve[],
): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "equipements", version: 1 }) }],
    Object.values(COLONNES_EQUIPEMENTS).map((nom) => ({ value: nom })),
    ...lignes.map((ligne) =>
      ligne.map((cellule) => (cellule === "" ? null : { value: cellule })),
    ),
  ];
  return writeXlsxFile(donnees).toBuffer();
}
