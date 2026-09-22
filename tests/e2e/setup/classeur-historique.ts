import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { COLONNES_HISTORIQUE, marqueurDu } from "@/lib/imports/modeles";

/**
 * LE CLASSEUR D'HISTORIQUE DE L'ÉPREUVE — fabriqué, jamais déposé (REPRISE-HISTORIQUE ; I9).
 *
 * ## Pourquoi il vit ici et non dans le scénario
 *
 * Même raison que `scripts/lib/classeur-epreuve.ts` : le gardien des chaînes
 * visibles (L0-11) lit tout fichier qui interroge un écran et prendrait ces
 * numéros de document pour du texte visible en dur. *C'est la DESTINATION
 * d'un texte qui décide, et il ne peut pas la lire.* Un module de données
 * n'est pas un écran.
 *
 * ## Il porte de VRAIES dates de tableur
 *
 * C'est la différence avec le classeur des clients, écrit à la main en ZIP :
 * une colonne « Date » doit porter des cellules de DATE — `write-excel-file`
 * les écrit (`type: Date`), `read-excel-file` les relit en `Date`, et le
 * dictionnaire de ligne les rend en `JJ/MM/AAAA`. *Le classeur d'origine de
 * l'exploitation portait ses dates en texte ISO, et c'est ainsi qu'il a été
 * refusé* (mesure du 22/09/2026) : celui-ci est conforme, comme le fichier
 * remis.
 *
 * ## Six lignes, contre le SEMIS de démonstration
 *
 * Elles nomment des clients, des lieux et des machines de `prisma/seed-data.ts`
 * — la base de l'épreuve est semée, détruite à chaque exécution — et des
 * numéros de document inventés. Chaque ligne répond à une question :
 *
 * | Ligne | Ce qu'elle éprouve |
 * |---|---|
 * | `F-EPR-0001` | rang 1 — la série d'une machine du client |
 * | `F-EPR-0002` | sans série, sans lieu — le client n'a qu'un lieu, par sa raison sociale |
 * | `F-EPR-0003` | sans lieu chez un client qui en a deux — REJET |
 * | `F-EPR-0004` | rang 3 — série inconnue du parc |
 * | `A-EPR-0001` | client inconnu — REJET, et c'est un avoir |
 * | `F-EPR-0006` | rang 3 — série d'une machine d'un AUTRE client |
 */
const DATE_1 = new Date(Date.UTC(2019, 2, 27));
const DATE_2 = new Date(Date.UTC(2021, 10, 8));

type LigneEpreuve = readonly [
  date: Date,
  typeDocument: string,
  numero: string,
  client: string,
  site: string,
  machine: string,
  referenceOr: string,
  technicien: string,
  objet: string,
  montant: number | null,
];

export const LIGNES_HISTORIQUE_EPREUVE: readonly LigneEpreuve[] = [
  [
    DATE_1,
    "FACTURE",
    "F-EPR-0001",
    "DEMO-001",
    "Atelier principal",
    "RAV-KPX-2019-0148",
    "OR-19-0311",
    "Jean",
    "Remplacement du flexible hydraulique",
    12500,
  ],
  [
    DATE_2,
    "FACTURE",
    "F-EPR-0002",
    "Garage du Nord",
    "",
    "",
    "",
    "Paul",
    "Diagnostic compresseur — déplacement seul",
    8500,
  ],
  [
    DATE_2,
    "FACTURE",
    "F-EPR-0003",
    "DEMO-001",
    "",
    "",
    "",
    "",
    "Entretien annuel",
    null,
  ],
  [
    DATE_1,
    "FACTURE",
    "F-EPR-0004",
    "DEMO-001",
    "Atelier principal",
    "ZZ-EPREUVE-INCONNUE",
    "",
    "Jean",
    "Réglage de la pression",
    4200,
  ],
  [
    DATE_2,
    "AVOIR",
    "A-EPR-0001",
    "Client Fantôme Épreuve",
    "",
    "",
    "",
    "",
    "Avoir sur facture",
    -3000,
  ],
  [
    DATE_1,
    "FACTURE",
    "F-EPR-0006",
    "DEMO-001",
    "Atelier principal",
    "NUS-SPL-2022-0007",
    "",
    "Marc",
    "Contrôle de niveau",
    2000,
  ],
];

/** Ce que le rapport doit annoncer — DÉRIVÉ des lignes, jamais écrit à côté. */
export const CREATIONS_HISTORIQUE_ATTENDUES = 4;
export const REJETS_HISTORIQUE_ATTENDUS =
  LIGNES_HISTORIQUE_EPREUVE.length - CREATIONS_HISTORIQUE_ATTENDUES;
/** Le même fichier redéposé après application : chaque document est déjà repris. */
export const CREATIONS_AU_SECOND_DEPOT = 0;
/** Les comptes par rang : sans série, rang 1, rang 2, non rattachées. */
export const RATTACHEMENTS_ATTENDUS = {
  sans_serie: 1,
  rang1: 1,
  rang2: 0,
  rang3: 2,
} as const;

/** Le classeur, en mémoire — aucun octet n'est écrit sur le disque. */
export async function fabriquerLeClasseurHistorique(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "historique", version: 1 }) }],
    Object.values(COLONNES_HISTORIQUE).map((nom) => ({ value: nom })),
    ...LIGNES_HISTORIQUE_EPREUVE.map(([date, ...reste]) => [
      { value: date, type: Date, format: "dd/mm/yyyy" },
      ...reste.map((cellule) =>
        cellule === null || cellule === "" ? null : { value: cellule },
      ),
    ]),
  ];
  return writeXlsxFile(donnees).toBuffer();
}

/** Un classeur d'un type qu'AUCUN gabarit ne publie — le cas de production du 22/09/2026. */
export const TYPE_INCONNU_EPREUVE = "inventaire";

export async function fabriquerUnClasseurDeTypeInconnu(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: TYPE_INCONNU_EPREUVE, version: 1 }) }],
    [{ value: "Colonne" }],
    [{ value: "valeur" }],
  ];
  return writeXlsxFile(donnees).toBuffer();
}
