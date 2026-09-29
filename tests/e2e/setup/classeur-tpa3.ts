import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { COLONNES_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

/**
 * LES CLASSEURS DE L'ÉPREUVE DU RAPPORT (TP-A3-RAPPORT-IMPORT).
 *
 * Même raison que `classeur-detail-rejet.ts` pour vivre ici plutôt que dans
 * le scénario : le gardien des chaînes visibles (L0-11) lit tout fichier qui
 * interroge un écran, et un module de données n'en est pas un.
 *
 * **Vingt lignes, un seul motif** : vingt clients dont la raison sociale est
 * vide — tous rejetés `saisie_refusee` — pour éprouver que le rapport les
 * regroupe en UN SEUL groupe replié (PA-55), plutôt que vingt lignes
 * répétant le même motif.
 */
export const PREFIXE_TPA3 = "TPA3-";

export async function fabriquerLeClasseurTpa3RejetsGroupes(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "clients", version: 1 }) }],
    Object.values(COLONNES_CLIENTS).map((nom) => ({ value: nom })),
    ...Array.from({ length: 20 }, (_, i) => [
      { value: `${PREFIXE_TPA3}${String(i + 1).padStart(2, "0")}` },
      null,
    ]),
  ];
  return writeXlsxFile(donnees).toBuffer();
}

/** Une seule ligne VALIDE, prête à être appliquée puis annulée (PA-56). */
export async function fabriquerLeClasseurTpa3LigneValide(
  codeExterne: string,
): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "clients", version: 1 }) }],
    Object.values(COLONNES_CLIENTS).map((nom) => ({ value: nom })),
    [{ value: codeExterne }, { value: `Garage ${codeExterne}` }],
  ];
  return writeXlsxFile(donnees).toBuffer();
}
