import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { COLONNES_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

/**
 * LE CLASSEUR DE L'ÉPREUVE « DÉTAIL D'UN REJET » (9AK-GR15-MOTIF-REJET).
 *
 * Même raison que `classeur-historique.ts` pour vivre ici plutôt que dans le
 * scénario : le gardien des chaînes visibles (L0-11) lit tout fichier qui
 * interroge un écran, et un module de données n'en est pas un.
 *
 * **Une seule ligne, un seul rejet** : un client dont la raison sociale est
 * vide — la même colonne obligatoire que `modeles.test.ts` éprouve déjà par
 * le contrôle seul. Cette épreuve-ci mesure autre chose : que le RAPPORT
 * affiché à l'écran nomme la colonne et dise la valeur, sans rien y stocker.
 */
export const CODE_EXTERNE_DETAIL_REJET = "ERGO15B-1";

export async function fabriquerLeClasseurDetailRejet(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "clients", version: 1 }) }],
    Object.values(COLONNES_CLIENTS).map((nom) => ({ value: nom })),
    [{ value: CODE_EXTERNE_DETAIL_REJET }, null],
  ];
  return writeXlsxFile(donnees).toBuffer();
}
