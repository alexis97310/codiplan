import { describe, expect, it } from "vitest";

import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille, type LigneControlee } from "@/lib/excel/controle";
import { type Cellule } from "@/lib/excel/format";
import { cleDeClient } from "@/lib/excel/rapprochement";
import {
  CHAMPS_VGP,
  CHAMPS_VGP_ECARTES,
  CHAMPS_VGP_OBSERVATIONS,
  CHAMPS_VGP_OBSERVATIONS_ECARTES,
  COLONNES_VGP,
  COLONNES_VGP_OBSERVATIONS,
  gabaritDuMarqueur,
  marqueurDu,
  modeleVgp,
  modeleVgp_observations,
  MOTIF_OBSERVATION_DEJA_REPRISE,
  MOTIF_ORIGINE_INCONNUE,
  MOTIF_RAPPORT_AMBIGU,
  MOTIF_RAPPORT_INTROUVABLE,
  MOTIF_SAISIE_REFUSEE,
  preparerUneObservationVgp,
  preparerUnPv,
  TYPES_PUBLIES,
  type ParcsDImport,
} from "@/lib/imports/modeles";
import { decompterLesRattachementsVgp } from "@/lib/imports/rapport-vgp";
import { deviseNonLue } from "@/lib/imports/parc-societe";
import { APPLICATIONS } from "@/lib/imports/types-dimport";
import {
  cleDeLObservation,
  cleDuRapport,
  estEnAttenteDeRattachement,
  MOTIFS_ATTENTE,
  NON_VALEURS_SERIE_VGP,
  schemaLigneObservationVgp,
  schemaLignePv,
  serieNonRenseignee,
  STATUTS_OBSERVATION_VGP,
  statutDeclare,
  VALEURS_CONFORME,
} from "@/lib/imports/vgp";
import { ORIGINES_VGP } from "@/lib/vgp/verification";

/**
 * LES DEUX GABARITS DE LA VGP, CONTRE DES PARCS FABRIQUÉS (VGP-IMPORT).
 *
 * Aucune base ici : les parcs sont des index en mémoire, et chaque scénario
 * dérange une ligne SAINE sur un seul point. Ce que ce fichier prouve : la
 * clé qui ne duplique pas, les trois statuts, le « ? » de conformité, un PV
 * sans machine qui est RETENU sous son motif, une observation dont le PV
 * manque et qui est refusée avec le sien. La chaîne entière — feuille → lot →
 * base → annulation — est dans `tests/isolation/application-import-vgp.test.ts`.
 */

const CLIENT_1 = "0192bbbb-0000-7000-8000-0000000000c1";
const CLIENT_2 = "0192bbbb-0000-7000-8000-0000000000c2";
const MACHINE_1 = "0192bbbb-0000-7000-8000-0000000000a1";
const MACHINE_2 = "0192bbbb-0000-7000-8000-0000000000a2";
const MACHINE_3 = "0192bbbb-0000-7000-8000-0000000000a3";
const MACHINE_5 = "0192bbbb-0000-7000-8000-0000000000a5";
const MACHINE_6 = "0192bbbb-0000-7000-8000-0000000000a6";
const PV_1 = "0192bbbb-0000-7000-8000-0000000000e1";
const PV_2A = "0192bbbb-0000-7000-8000-0000000000e2";
const PV_2B = "0192bbbb-0000-7000-8000-0000000000e3";
const OBSERVATION_DEJA = "0192bbbb-0000-7000-8000-00000000000b";

/** Le rapport qui couvre UNE machine, et celui qui en couvre DEUX. */
const RAPPORT_SIMPLE = "315503594.1.R";
const RAPPORT_PARC = "31960570/4.1.1.R";

function parcsFabriques(): ParcsDImport {
  const cle = (code: string | undefined, raison: string | undefined) =>
    cleDeClient({ codeExterne: code, raisonSociale: raison, rang: 0 }).cle;
  const clients = new Map<string, string>([
    [cle("VGP-C1", undefined), CLIENT_1],
    [cle(undefined, "Forge Mirabelle"), CLIENT_1],
    [cle("VGP-C2", undefined), CLIENT_2],
  ]);
  return {
    clients: {
      cles: new Set(clients.keys()),
      ambigues: new Set(),
      fiches: clients,
    },
    agences: { parCode: new Map() },
    familles: { parCode: new Map() },
    sites: { fiches: new Map() },
    sitesDetails: new Map(),
    modeles: { fiches: new Map() },
    machines: {
      parSerie: new Map([
        ["SER-1", [{ id: MACHINE_1, clientId: CLIENT_1 }]],
        // La même série chez DEUX clients : le client départage (rang 2).
        [
          "SER-2",
          [
            { id: MACHINE_2, clientId: CLIENT_1 },
            { id: MACHINE_3, clientId: CLIENT_2 },
          ],
        ],
        // La même série deux fois chez le MÊME client : rien ne départage.
        [
          "SER-5",
          [
            { id: MACHINE_5, clientId: CLIENT_1 },
            { id: MACHINE_6, clientId: CLIENT_1 },
          ],
        ],
      ]),
    },
    historique: { fiches: new Map() },
    devise: deviseNonLue(),
    verifications: {
      parRapport: new Map([
        [
          cleDuRapport(RAPPORT_SIMPLE),
          [{ id: PV_1, machineId: MACHINE_1, serie: "SER-1" }],
        ],
        [
          cleDuRapport(RAPPORT_PARC),
          [
            { id: PV_2A, machineId: MACHINE_2, serie: "SER-2" },
            { id: PV_2B, machineId: MACHINE_5, serie: "SER-5" },
          ],
        ],
      ]),
    },
    observations: {
      fiches: new Map([
        [cleDeLObservation(RAPPORT_SIMPLE, "OBS-DEJA"), OBSERVATION_DEJA],
      ]),
    },
  };
}

const PARC_CIBLE_VIDE = {
  cles: new Set<string>(),
  ambigues: new Set<string>(),
};

/** Le sérial de tableur du 27 mars 2019 — une VRAIE date de classeur. */
const SERIE_27_03_2019 = 43551;

/* ════════════════════════════════════════════════════════════════════════
 * LE GABARIT « VGP »
 * ════════════════════════════════════════════════════════════════════════ */

type LignePv = Readonly<Partial<Record<keyof typeof COLONNES_VGP, Cellule>>>;

function pvSain(surcharge: LignePv = {}): LignePv {
  return {
    date: { serie: SERIE_27_03_2019 },
    organisme: { texte: "Bureau Veritas" },
    reference: { texte: RAPPORT_SIMPLE },
    inspecteur: { texte: "M. Dupont" },
    machine: { texte: "SER-1" },
    clientSite: { texte: "VGP-C1" },
    conforme: { texte: "NON" },
    avis: { texte: "Réserves à lever sous un mois" },
    origine: { texte: "rapport_transmis_client" },
    ...surcharge,
  };
}

function feuillePv(lignes: readonly LignePv[]): FeuilleLue {
  const colonnes = Object.keys(COLONNES_VGP) as (keyof typeof COLONNES_VGP)[];
  return {
    nom: "vgp",
    lignes: [
      [{ texte: marqueurDu({ type: "vgp", version: 1 }) }],
      colonnes.map((c) => ({ texte: COLONNES_VGP[c] })),
      ...lignes.map((ligne) => colonnes.map((c) => ligne[c])),
    ],
  };
}

function controlerPv(lignes: readonly LignePv[]): readonly LigneControlee[] {
  const controle = controlerFeuille(
    feuillePv(lignes),
    modeleVgp(parcsFabriques()),
    PARC_CIBLE_VIDE,
  );
  if (!controle.lisible) {
    throw new Error(`illisible : ${JSON.stringify(controle.anomalies)}`);
  }
  return controle.lignes;
}

/** Le dictionnaire de ligne d'un PV, tel que `preparerUnPv` le reçoit. */
function valeursPv(ligne: LignePv): Record<string, string | undefined> {
  const valeurs: Record<string, string | undefined> = {};
  for (const [nom, colonne] of Object.entries(COLONNES_VGP)) {
    const cellule = ligne[nom as keyof typeof COLONNES_VGP];
    valeurs[colonne] =
      cellule?.texte ??
      (cellule?.serie === undefined ? undefined : "27/03/2019");
  }
  return valeurs;
}

const CHAMPS_DU_SCHEMA_PV = Object.keys(schemaLignePv.shape);

describe("le gabarit « vgp » est publié, et confronté à son schéma", () => {
  it("est le neuvième gabarit publié, avec le dixième — et la route les trouve par leur marqueur", () => {
    expect(TYPES_PUBLIES).toContain("vgp");
    expect(TYPES_PUBLIES).toContain("vgp_observations");
    expect(TYPES_PUBLIES).toHaveLength(10);
    expect(
      gabaritDuMarqueur({ texte: "CODIPLAN-vgp-v1" }, parcsFabriques())?.type,
    ).toBe("vgp");
    expect(
      gabaritDuMarqueur(
        { texte: "CODIPLAN-vgp_observations-v1" },
        parcsFabriques(),
      )?.type,
    ).toBe("vgp_observations");
    // LE MARQUEUR DU TICKET NE SE LIT PAS : la grammaire n'admet pas le tiret
    // dans le type, et elle n'est pas assouplie — c'est le type qui s'y plie.
    expect(
      gabaritDuMarqueur(
        { texte: "CODIPLAN-vgp-observations-v1" },
        parcsFabriques(),
      ),
    ).toBeNull();
    // Les deux savent s'appliquer ET s'annuler — la table des routes le dit.
    expect(APPLICATIONS.vgp).toBeDefined();
    expect(APPLICATIONS.vgp_observations).toBeDefined();
  });

  it("porte les huit colonnes mesurées, plus « Origine » que D114 exige du fichier", () => {
    expect(Object.values(COLONNES_VGP)).toEqual([
      "Date de vérification",
      "Organisme",
      "Réf. rapport",
      "Inspecteur",
      "Machine (n° de série)",
      "Client / Site",
      "Conforme",
      "Avis général",
      "Origine",
    ]);
    const obligatoires = modeleVgp(parcsFabriques())
      .colonnes.filter((c) => c.obligatoire)
      .map((c) => c.nom);
    expect(obligatoires).toEqual([
      COLONNES_VGP.date,
      COLONNES_VGP.organisme,
      COLONNES_VGP.reference,
      COLONNES_VGP.machine,
      COLONNES_VGP.conforme,
      COLONNES_VGP.origine,
    ]);
  });

  it("chaque champ du schéma est EXPOSÉ ou ÉCARTÉ nommément, et aucune colonne n'est orpheline", () => {
    expect(CHAMPS_DU_SCHEMA_PV.length).toBeGreaterThanOrEqual(9);
    const exposes = new Set(Object.values(CHAMPS_VGP));
    const orphelins = CHAMPS_DU_SCHEMA_PV.filter(
      (champ) =>
        !exposes.has(champ) && !Object.hasOwn(CHAMPS_VGP_ECARTES, champ),
    );
    expect(orphelins).toEqual([]);
    for (const [champ, motif] of Object.entries(CHAMPS_VGP_ECARTES)) {
      expect(motif.trim().length, champ).toBeGreaterThan(20);
      expect(CHAMPS_DU_SCHEMA_PV, `${champ} n'existe pas au schéma`).toContain(
        champ,
      );
      expect(exposes.has(champ), `${champ} est exposé ET écarté`).toBe(false);
    }
    for (const colonne of Object.values(COLONNES_VGP)) {
      const alimente =
        Object.hasOwn(CHAMPS_VGP, colonne) ||
        Object.values(CHAMPS_VGP_ECARTES).some((motif) =>
          motif.includes(`« ${colonne} »`),
        );
      expect(alimente, `« ${colonne} » ne va nulle part`).toBe(true);
    }
  });
});

describe("LA CLÉ est le rang : rien ne se rapproche, rien ne se fusionne", () => {
  it("quatre lignes identiques — même rapport, même série — sont QUATRE créations, jamais un doublon", () => {
    // *Mesuré le 22/09/2026* : ('315505382.1.R', '13120') apparaît quatre
    // fois dans l'archive. Une clé au couple les réduirait à une, ou ferait
    // rougir `doublon_fichier` sur trois ; le rang les garde toutes.
    const lignes = controlerPv([pvSain(), pvSain(), pvSain(), pvSain()]);
    expect(lignes.map((l) => l.action)).toEqual([
      "creation",
      "creation",
      "creation",
      "creation",
    ]);
    expect(lignes.map((l) => l.cle?.cle)).toEqual([
      "LIGNE-3",
      "LIGNE-4",
      "LIGNE-5",
      "LIGNE-6",
    ]);
    expect(lignes.every((l) => l.cle?.forme === "rang")).toBe(true);
    expect(lignes.every((l) => l.cle?.complet === false)).toBe(true);
  });

  it("une ligne sans rapport ni série est un reste de GABARIT, comptée et non rejetée", () => {
    const [ligne] = controlerPv([
      { organisme: { texte: "Bureau Veritas" }, inspecteur: { texte: "X" } },
    ]);
    expect(ligne?.action).toBe("gabarit");
  });
});

describe("la CONFORMITÉ porte trois valeurs, et « ? » en est une", () => {
  it("OUI, NON et « ? » passent, quelle que soit la casse", () => {
    expect(VALEURS_CONFORME).toEqual(["oui", "non", "?"]);
    for (const conforme of ["OUI", "non", "?", "Oui"]) {
      const prepare = preparerUnPv(
        parcsFabriques(),
        valeursPv(pvSain({ conforme: { texte: conforme } })),
      );
      expect(prepare.prete, conforme).toBe(true);
      if (prepare.prete) {
        expect(prepare.saisie.conforme).toBe(conforme.toLowerCase());
      }
    }
  });

  it("une quatrième valeur, ou l'absence, est une saisie REFUSÉE — jamais rabattue", () => {
    for (const conforme of [{ texte: "peut-être" }, undefined]) {
      const prepare = preparerUnPv(
        parcsFabriques(),
        valeursPv(pvSain({ conforme })),
      );
      expect(prepare).toEqual({ prete: false, motif: MOTIF_SAISIE_REFUSEE });
    }
  });
});

describe("L'ORIGINE vient du fichier, jamais d'une constante (D114)", () => {
  it("chacun des quatre codes passe, et il est ÉCRIT tel quel", () => {
    for (const origine of ORIGINES_VGP) {
      const prepare = preparerUnPv(
        parcsFabriques(),
        valeursPv(pvSain({ origine: { texte: origine.toUpperCase() } })),
      );
      expect(prepare.prete, origine).toBe(true);
      if (prepare.prete) expect(prepare.saisie.origine).toBe(origine);
    }
  });

  it("une origine inconnue a SON motif ; une origine absente est une saisie refusée", () => {
    expect(
      preparerUnPv(
        parcsFabriques(),
        valeursPv(pvSain({ origine: { texte: "on ne sait plus" } })),
      ),
    ).toEqual({ prete: false, motif: MOTIF_ORIGINE_INCONNUE });
    expect(
      preparerUnPv(parcsFabriques(), valeursPv(pvSain({ origine: undefined }))),
    ).toEqual({ prete: false, motif: MOTIF_SAISIE_REFUSEE });
  });
});

describe("UN PV SANS MACHINE EST RETENU, pas refusé — sous son motif (arbitrage 3)", () => {
  it("la liste close des non-valeurs est celle mesurée, et elle est insensible à la casse", () => {
    expect(NON_VALEURS_SERIE_VGP).toEqual(["sans", "?", "illisible"]);
    for (const mot of ["SANS", "sans", "Sans", "?", "Illisible", "ILLISIBLE"]) {
      expect(serieNonRenseignee(mot), mot).toBe(true);
    }
    expect(serieNonRenseignee("SER-1")).toBe(false);
    // Le cas qui doit rester vert POUR SA PROPRE RAISON : un mot qui contient
    // une non-valeur n'en est pas une.
    expect(serieNonRenseignee("SANS-2019-0148")).toBe(false);
  });

  it("chaque non-valeur écrite en mots entre EN ATTENTE « sans série » — jamais « série inconnue »", () => {
    for (const mot of ["SANS", "sans", "Sans", "?", "Illisible"]) {
      const [ligne] = controlerPv([pvSain({ machine: { texte: mot } })]);
      expect(ligne?.action, mot).toBe("rejet");
      expect(ligne?.rejetMotif, mot).toBe(MOTIFS_ATTENTE.sans_serie);
      expect(estEnAttenteDeRattachement(ligne?.rejetMotif)).toBe(true);
    }
  });

  it("les trois autres attentes portent leur motif — inconnue, ambiguë, autre client", () => {
    const lignes = controlerPv([
      pvSain({ machine: { texte: "SER-INCONNUE" } }),
      // SER-5 : deux machines chez le MÊME client, rien ne départage.
      pvSain({ machine: { texte: "SER-5" } }),
      // SER-1 est chez C1 ; la ligne nomme C2.
      pvSain({ clientSite: { texte: "VGP-C2" } }),
    ]);
    expect(lignes.map((l) => l.rejetMotif)).toEqual([
      MOTIFS_ATTENTE.serie_inconnue,
      MOTIFS_ATTENTE.serie_ambigue,
      MOTIFS_ATTENTE.serie_autre_client,
    ]);
  });

  it("« Client / Site » DÉPARTAGE une série partagée (rang 2), et se lit avant sa barre", () => {
    const parcs = parcsFabriques();
    const chezC1 = preparerUnPv(
      parcs,
      valeursPv(pvSain({ machine: { texte: "SER-2" } })),
    );
    expect(chezC1.prete).toBe(true);
    if (chezC1.prete) {
      expect(chezC1.rang).toBe(2);
      expect(chezC1.saisie.machine_id).toBe(MACHINE_2);
      expect(chezC1.saisie.client_id).toBe(CLIENT_1);
    }
    // La colonne porte « client / lieu » : ce qui précède la barre désigne.
    const parRaison = preparerUnPv(
      parcs,
      valeursPv(
        pvSain({
          machine: { texte: "SER-2" },
          clientSite: { texte: "Forge Mirabelle / Atelier" },
        }),
      ),
    );
    expect(parRaison.prete && parRaison.saisie.machine_id).toBe(MACHINE_2);
    // Sans client, SER-2 est AMBIGUË : le rang 2 n'existe pas sans lui.
    const sansClient = preparerUnPv(
      parcs,
      valeursPv(pvSain({ machine: { texte: "SER-2" }, clientSite: undefined })),
    );
    expect(sansClient.prete).toBe(false);
    if (!sansClient.prete) {
      expect(sansClient.motif).toBe(MOTIFS_ATTENTE.serie_ambigue);
    }
  });

  it("une désignation de client que personne ne reconnaît ne REFUSE pas : c'est un contrôle, pas une clé", () => {
    const prepare = preparerUnPv(
      parcsFabriques(),
      valeursPv(pvSain({ clientSite: { texte: "Client Fantôme" } })),
    );
    expect(prepare.prete).toBe(true);
    if (prepare.prete) {
      expect(prepare.saisie.client_id).toBeNull();
      expect(prepare.saisie.machine_id).toBe(MACHINE_1);
    }
  });

  it("le rapport compte l'attente À PART des vrais rejets, ligne à ligne, avec la série lue", () => {
    const lignes = controlerPv([
      pvSain(),
      pvSain({ machine: { texte: "Illisible" } }),
      pvSain({ machine: { texte: "SER-INCONNUE" } }),
      pvSain({ origine: { texte: "??" } }),
    ]);
    const comptes = decompterLesRattachementsVgp(lignes, COLONNES_VGP.machine);
    expect(comptes.rattachees).toBe(1);
    expect(comptes.autresRejets).toBe(1);
    expect(comptes.enAttente).toEqual([
      { rang: 4, serie: "Illisible", motif: MOTIFS_ATTENTE.sans_serie },
      { rang: 5, serie: "SER-INCONNUE", motif: MOTIFS_ATTENTE.serie_inconnue },
    ]);
    // LE TÉMOIN : les trois comptes expliquent chaque ligne de données.
    expect(
      comptes.rattachees + comptes.enAttente.length + comptes.autresRejets,
    ).toBe(lignes.length);
  });
});

describe("la DATE est celle de la grammaire, et rien de plus tolérant", () => {
  it("une date en texte ISO est refusée `date_format` — le fichier se conforme, pas le lecteur", () => {
    const [ligne] = controlerPv([pvSain({ date: { texte: "2019-03-27" } })]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe("date_format");
  });

  it("une vraie date de tableur est écrite au jour près, en UTC", () => {
    const prepare = preparerUnPv(parcsFabriques(), valeursPv(pvSain()));
    expect(prepare.prete).toBe(true);
    if (prepare.prete) {
      expect(prepare.saisie.date_verification.toISOString()).toBe(
        "2019-03-27T00:00:00.000Z",
      );
      // Les colonnes sans arrivée sont VALIDÉES et portées par la saisie.
      expect(prepare.saisie.inspecteur).toBe("M. Dupont");
      expect(prepare.saisie.avis_general).toBe("Réserves à lever sous un mois");
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LE GABARIT « VGP_OBSERVATIONS »
 * ════════════════════════════════════════════════════════════════════════ */

type LigneObservation = Readonly<
  Partial<Record<keyof typeof COLONNES_VGP_OBSERVATIONS, Cellule>>
>;

function observationSaine(surcharge: LigneObservation = {}): LigneObservation {
  return {
    code: { texte: "OBS-0001" },
    reference: { texte: RAPPORT_SIMPLE },
    dateSignalement: { serie: SERIE_27_03_2019 },
    observation: { texte: "Flexible hydraulique fissuré" },
    statut: { texte: "Non rattachée à un document CODIMA" },
    ...surcharge,
  };
}

function feuilleObservations(lignes: readonly LigneObservation[]): FeuilleLue {
  const colonnes = Object.keys(
    COLONNES_VGP_OBSERVATIONS,
  ) as (keyof typeof COLONNES_VGP_OBSERVATIONS)[];
  return {
    nom: "observations",
    lignes: [
      [{ texte: marqueurDu({ type: "vgp_observations", version: 1 }) }],
      colonnes.map((c) => ({ texte: COLONNES_VGP_OBSERVATIONS[c] })),
      ...lignes.map((ligne) => colonnes.map((c) => ligne[c])),
    ],
  };
}

function controlerObservations(
  lignes: readonly LigneObservation[],
): readonly LigneControlee[] {
  const parcs = parcsFabriques();
  const controle = controlerFeuille(
    feuilleObservations(lignes),
    modeleVgp_observations(parcs),
    { cles: new Set(parcs.observations.fiches.keys()), ambigues: new Set() },
  );
  if (!controle.lisible) {
    throw new Error(`illisible : ${JSON.stringify(controle.anomalies)}`);
  }
  return controle.lignes;
}

function valeursObservation(
  ligne: LigneObservation,
): Record<string, string | undefined> {
  const valeurs: Record<string, string | undefined> = {};
  for (const [nom, colonne] of Object.entries(COLONNES_VGP_OBSERVATIONS)) {
    const cellule = ligne[nom as keyof typeof COLONNES_VGP_OBSERVATIONS];
    valeurs[colonne] =
      cellule?.texte ??
      (cellule?.serie === undefined ? undefined : "27/03/2019");
  }
  return valeurs;
}

const CHAMPS_DU_SCHEMA_OBSERVATION = Object.keys(
  schemaLigneObservationVgp.shape,
);

describe("le gabarit « vgp_observations » est confronté à son schéma", () => {
  it("porte les sept colonnes du ticket, plus « Machine (n° de série) » qui départage un rapport", () => {
    expect(Object.values(COLONNES_VGP_OBSERVATIONS)).toEqual([
      "Code observation",
      "Réf. rapport",
      "Machine (n° de série)",
      "Date de 1er signalement",
      "Observation",
      "Statut",
      "Document de réponse",
      "Date de réponse",
    ]);
    const obligatoires = modeleVgp_observations(parcsFabriques())
      .colonnes.filter((c) => c.obligatoire)
      .map((c) => c.nom);
    expect(obligatoires).toEqual([
      COLONNES_VGP_OBSERVATIONS.code,
      COLONNES_VGP_OBSERVATIONS.reference,
      COLONNES_VGP_OBSERVATIONS.dateSignalement,
      COLONNES_VGP_OBSERVATIONS.observation,
      COLONNES_VGP_OBSERVATIONS.statut,
    ]);
  });

  it("chaque champ du schéma est EXPOSÉ ou ÉCARTÉ nommément, et aucune colonne n'est orpheline", () => {
    expect(CHAMPS_DU_SCHEMA_OBSERVATION.length).toBeGreaterThanOrEqual(8);
    const exposes = new Set(Object.values(CHAMPS_VGP_OBSERVATIONS));
    const orphelins = CHAMPS_DU_SCHEMA_OBSERVATION.filter(
      (champ) =>
        !exposes.has(champ) &&
        !Object.hasOwn(CHAMPS_VGP_OBSERVATIONS_ECARTES, champ),
    );
    expect(orphelins).toEqual([]);
    for (const [champ, motif] of Object.entries(
      CHAMPS_VGP_OBSERVATIONS_ECARTES,
    )) {
      expect(motif.trim().length, champ).toBeGreaterThan(20);
      expect(CHAMPS_DU_SCHEMA_OBSERVATION, champ).toContain(champ);
      expect(exposes.has(champ), `${champ} est exposé ET écarté`).toBe(false);
    }
    for (const colonne of Object.values(COLONNES_VGP_OBSERVATIONS)) {
      const alimente =
        Object.hasOwn(CHAMPS_VGP_OBSERVATIONS, colonne) ||
        Object.values(CHAMPS_VGP_OBSERVATIONS_ECARTES).some((motif) =>
          motif.includes(`« ${colonne} »`),
        );
      expect(alimente, `« ${colonne} » ne va nulle part`).toBe(true);
    }
  });
});

describe("le STATUT porte trois valeurs réelles, et « chiffrée » n'est pas « non levée »", () => {
  it("les trois statuts mesurés passent — accents et casse compris — et sont ÉCRITS sous leur forme canonique", () => {
    expect(STATUTS_OBSERVATION_VGP).toHaveLength(3);
    expect(statutDeclare("LEVEE - FACTUREE")).toBe("Levée - facturée");
    expect(statutDeclare("chiffree – devis emis")).toBe(
      "Chiffrée - devis émis",
    );
    for (const statut of STATUTS_OBSERVATION_VGP) {
      const prepare = preparerUneObservationVgp(
        parcsFabriques(),
        valeursObservation(observationSaine({ statut: { texte: statut } })),
      );
      expect(prepare.prete, statut).toBe(true);
      if (prepare.prete) expect(prepare.saisie.statut).toBe(statut);
    }
  });

  it("un quatrième statut est REFUSÉ, jamais rabattu sur un des trois", () => {
    expect(statutDeclare("Levée")).toBeUndefined();
    expect(
      preparerUneObservationVgp(
        parcsFabriques(),
        valeursObservation(observationSaine({ statut: { texte: "Levée" } })),
      ),
    ).toEqual({ prete: false, motif: MOTIF_SAISIE_REFUSEE });
  });
});

describe("le PARENT doit exister — et être UN SEUL", () => {
  it("une référence de rapport inconnue est REFUSÉE avec son motif", () => {
    const [ligne] = controlerObservations([
      observationSaine({ reference: { texte: "999999.9.R" } }),
    ]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_RAPPORT_INTROUVABLE);
  });

  it("un rapport qui couvre PLUSIEURS machines est ambigu sans n° de série — et départagé avec", () => {
    const [sansSerie, avecSerie, serieEtrangere] = controlerObservations([
      observationSaine({ reference: { texte: RAPPORT_PARC } }),
      observationSaine({
        code: { texte: "OBS-0002" },
        reference: { texte: RAPPORT_PARC },
        machine: { texte: "SER-5" },
      }),
      // Une série que ce rapport ne couvre pas : rien ne désigne, ambigu.
      observationSaine({
        code: { texte: "OBS-0003" },
        reference: { texte: RAPPORT_PARC },
        machine: { texte: "SER-1" },
      }),
    ]);
    expect(sansSerie?.rejetMotif).toBe(MOTIF_RAPPORT_AMBIGU);
    expect(avecSerie?.action).toBe("creation");
    expect(serieEtrangere?.rejetMotif).toBe(MOTIF_RAPPORT_AMBIGU);
    const prepare = preparerUneObservationVgp(
      parcsFabriques(),
      valeursObservation(
        observationSaine({
          reference: { texte: RAPPORT_PARC },
          machine: { texte: "SER-5" },
        }),
      ),
    );
    expect(prepare.prete && prepare.saisie.verification_id).toBe(PV_2B);
  });

  it("une ligne saine est une CRÉATION sous la clé (rapport, code), et `intervention_id` n'existe pas dans sa saisie", () => {
    const [ligne] = controlerObservations([observationSaine()]);
    expect(ligne?.action).toBe("creation");
    expect(ligne?.cle?.cle).toBe(cleDeLObservation(RAPPORT_SIMPLE, "OBS-0001"));
    // ARBITRAGE 1 : rien dans ce qui s'écrit ne désigne une intervention.
    expect(CHAMPS_DU_SCHEMA_OBSERVATION).not.toContain("intervention_id");
    const prepare = preparerUneObservationVgp(
      parcsFabriques(),
      valeursObservation(observationSaine()),
    );
    expect(prepare.prete).toBe(true);
    if (prepare.prete) {
      expect(prepare.saisie.verification_id).toBe(PV_1);
      expect(prepare.saisie.libelle).toBe("Flexible hydraulique fissuré");
      expect(prepare.saisie.date_reponse).toBeNull();
    }
  });

  it("le même code sous DEUX rapports est deux observations ; le même couple deux fois est un doublon", () => {
    const lignes = controlerObservations([
      observationSaine(),
      observationSaine({
        reference: { texte: RAPPORT_PARC },
        machine: { texte: "SER-2" },
      }),
      observationSaine(),
    ]);
    expect(lignes.map((l) => l.action)).toEqual(["rejet", "creation", "rejet"]);
    expect(lignes[0]?.rejetMotif).toBe("doublon_fichier");
  });

  it("une observation DÉJÀ reprise est rejetée avec son motif — jamais modifiée, jamais dupliquée", () => {
    const [ligne] = controlerObservations([
      observationSaine({ code: { texte: "OBS-DEJA" } }),
    ]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_OBSERVATION_DEJA_REPRISE);
  });

  it("une date de réponse renseignée est lue par la grammaire, et refusée sous le code de l'anomalie", () => {
    const [iso, vraie] = controlerObservations([
      observationSaine({ dateReponse: { texte: "2020-01-15" } }),
      observationSaine({
        code: { texte: "OBS-0002" },
        dateReponse: { texte: "15/01/2020" },
        documentReponse: { texte: "DEV-2020-0042" },
      }),
    ]);
    expect(iso?.rejetMotif).toBe("date_format");
    expect(vraie?.action).toBe("creation");
  });
});
