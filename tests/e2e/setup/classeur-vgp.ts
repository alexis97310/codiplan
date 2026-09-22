import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import {
  COLONNES_VGP,
  COLONNES_VGP_OBSERVATIONS,
  marqueurDu,
} from "@/lib/imports/modeles";

/**
 * LES DEUX CLASSEURS D'ÉPREUVE DE LA VGP, FABRIQUÉS EN MÉMOIRE (VGP-IMPORT).
 *
 * Les n° de série sont ceux du SEMIS (`prisma/seed-data.ts`) : le scénario
 * joue contre la base d'épreuve semée, jamais contre une fixture inventée.
 * `RAV-KPX-2019-0148` est chez DEMO-001 ; `ZZ-EPREUVE-INCONNUE` n'existe
 * nulle part ; `SANS` est ce que l'archive écrit quand elle n'a pas de
 * plaque. Les dates sont de VRAIES dates de tableur — le fichier se conforme
 * à la grammaire, la grammaire ne se plie pas au fichier.
 */
const DATE_1 = new Date(Date.UTC(2019, 2, 27));
const DATE_2 = new Date(Date.UTC(2021, 10, 8));

export const RAPPORT_EPREUVE = "EPR-315503594.1.R";

type LignePv = readonly [
  date: Date,
  organisme: string,
  reference: string,
  inspecteur: string,
  machine: string,
  clientSite: string,
  conforme: string,
  avis: string,
  origine: string,
];

export const LIGNES_PV_EPREUVE: readonly LignePv[] = [
  [
    DATE_1,
    "Bureau Veritas",
    RAPPORT_EPREUVE,
    "M. Dupont",
    "RAV-KPX-2019-0148",
    "DEMO-001",
    "NON",
    "Réserves à lever",
    "rapport_transmis_client",
  ],
  [
    DATE_1,
    "Bureau Veritas",
    RAPPORT_EPREUVE,
    "M. Dupont",
    "SANS",
    "DEMO-001",
    "?",
    "",
    "rapport_transmis_client",
  ],
  [
    DATE_2,
    "Bureau Veritas",
    "EPR-31960570/4.1.1.R",
    "",
    "ZZ-EPREUVE-INCONNUE",
    "",
    "OUI",
    "",
    "rapport_organisme",
  ],
  [
    DATE_2,
    "Bureau Veritas",
    "EPR-31960570/4.1.1.R",
    "",
    "RAV-KPX-2019-0148",
    "DEMO-001",
    "OUI",
    "",
    "on ne sait plus",
  ],
];

/** Ce que le rapport doit annoncer — DÉRIVÉ des lignes, jamais écrit à côté. */
export const CREATIONS_PV_ATTENDUES = 1;
export const REJETS_PV_ATTENDUS =
  LIGNES_PV_EPREUVE.length - CREATIONS_PV_ATTENDUES;
/** Les trois comptes de rattachement : rattachées, en attente, autres rejets. */
export const ATTENTE_ATTENDUE = {
  rattachees: 1,
  en_attente: 2,
  autres_rejets: 1,
} as const;

export async function fabriquerLeClasseurVgp(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "vgp", version: 1 }) }],
    Object.values(COLONNES_VGP).map((nom) => ({ value: nom })),
    ...LIGNES_PV_EPREUVE.map(([date, ...reste]) => [
      { value: date, type: Date, format: "dd/mm/yyyy" },
      ...reste.map((cellule) => (cellule === "" ? null : { value: cellule })),
    ]),
  ];
  return writeXlsxFile(donnees).toBuffer();
}

type LigneObservation = readonly [
  code: string,
  reference: string,
  machine: string,
  dateSignalement: Date,
  observation: string,
  statut: string,
  documentReponse: string,
  dateReponse: Date | null,
];

/**
 * Deux observations sous le PV d'épreuve — la seconde départagée par la
 * série —, et une sous un rapport qu'aucun PV ne porte : REFUSÉE.
 */
export const LIGNES_OBSERVATIONS_EPREUVE: readonly LigneObservation[] = [
  [
    "OBS-EPR-1",
    RAPPORT_EPREUVE,
    "",
    DATE_1,
    "Flexible hydraulique fissuré",
    "Non rattachée à un document CODIMA",
    "",
    null,
  ],
  [
    "OBS-EPR-2",
    RAPPORT_EPREUVE,
    "RAV-KPX-2019-0148",
    DATE_1,
    "Butée de fin de course usée",
    "Chiffrée - devis émis",
    "DEV-2019-0311",
    DATE_2,
  ],
  [
    "OBS-EPR-3",
    "EPR-RAPPORT-FANTOME",
    "",
    DATE_2,
    "Marquage CE illisible",
    "Levée - facturée",
    "",
    null,
  ],
];

export const CREATIONS_OBSERVATIONS_ATTENDUES = 2;
export const REJETS_OBSERVATIONS_ATTENDUS =
  LIGNES_OBSERVATIONS_EPREUVE.length - CREATIONS_OBSERVATIONS_ATTENDUES;

export async function fabriquerLeClasseurObservations(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "vgp_observations", version: 1 }) }],
    Object.values(COLONNES_VGP_OBSERVATIONS).map((nom) => ({ value: nom })),
    ...LIGNES_OBSERVATIONS_EPREUVE.map((ligne) =>
      ligne.map((cellule) =>
        cellule === "" || cellule === null
          ? null
          : cellule instanceof Date
            ? { value: cellule, type: Date, format: "dd/mm/yyyy" }
            : { value: cellule },
      ),
    ),
  ];
  return writeXlsxFile(donnees).toBuffer();
}
