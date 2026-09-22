import { describe, expect, it } from "vitest";

import { type FeuilleLue } from "@/lib/excel/classeur";
import {
  controlerFeuille,
  MOTIF_DOUBLON_FICHIER,
  type LigneControlee,
} from "@/lib/excel/controle";
import { type Cellule } from "@/lib/excel/format";
import { cleDeClient } from "@/lib/excel/rapprochement";
import {
  CHAMPS_HISTORIQUE,
  CHAMPS_HISTORIQUE_ECARTES,
  COLONNES_HISTORIQUE,
  cleDuDocument,
  cleDuSite,
  gabaritDuMarqueur,
  marqueurDu,
  modeleHistorique,
  MOTIF_CLIENT_INTROUVABLE,
  MOTIF_DOCUMENT_DEJA_REPRIS,
  MOTIF_MONTANT_DEVISE,
  MOTIF_MONTANT_ILLISIBLE,
  MOTIF_SAISIE_REFUSEE,
  MOTIF_SITE_INDETERMINE,
  MOTIF_SITE_INTROUVABLE,
  preparerUneReprise,
  TYPES_PUBLIES,
  type ParcsDImport,
} from "@/lib/imports/modeles";
import {
  schemaLigneHistorique,
  STATUT_FACTURATION_REPRISE,
  TYPE_INTERVENTION_REPRISE,
} from "@/lib/imports/reprise";
import { decompterLesRattachements } from "@/lib/imports/rapport-historique";
import { TYPES_INTERVENTION } from "@/lib/interventions/saisie";
import { lireDevise } from "@/lib/money";
import { DEVISES } from "@/prisma/seed-data";

/**
 * LE HUITIÈME GABARIT — L'HISTORIQUE SAV (REPRISE-HISTORIQUE ; D127, I6, I9).
 *
 * ## Ce que ce fichier éprouve, et contre quoi
 *
 * Les parcs sont FABRIQUÉS — aucune base, aucune donnée réelle (I9) — et
 * chaque scénario traverse `controlerFeuille` par le gabarit que la route
 * choisirait : *une suite qui éprouve tous les maillons n'éprouve pas la
 * chaîne* (§9, 08/09). Les identifiants sont des UUID v7 bien formés, parce
 * que le schéma de la ligne les exige.
 *
 * Les cinq épreuves que le ticket nomme sont ici : la CLÉ qui ne duplique
 * pas, le CLIENT introuvable refusé avec son motif, les TROIS RANGS du
 * rapprochement machine, le TECHNICIEN gardé en texte, et — pour l'annulation,
 * qui exige une base — `tests/isolation/application-import-historique.test.ts`.
 */

const CLIENT_1 = "0192aaaa-0000-7000-8000-0000000000c1";
const CLIENT_2 = "0192aaaa-0000-7000-8000-0000000000c2";
const SITE_1A = "0192aaaa-0000-7000-8000-00000000051a";
const SITE_1B = "0192aaaa-0000-7000-8000-00000000051b";
const SITE_2 = "0192aaaa-0000-7000-8000-00000000052a";
const AGENCE = "0192aaaa-0000-7000-8000-0000000000e1";
const MACHINE_1 = "0192aaaa-0000-7000-8000-0000000000a1";
const MACHINE_2 = "0192aaaa-0000-7000-8000-0000000000a2";
const MACHINE_3 = "0192aaaa-0000-7000-8000-0000000000a3";
const MACHINE_4 = "0192aaaa-0000-7000-8000-0000000000a4";
const MACHINE_5 = "0192aaaa-0000-7000-8000-0000000000a5";
const MACHINE_6 = "0192aaaa-0000-7000-8000-0000000000a6";
const INTERVENTION_DEJA = "0192aaaa-0000-7000-8000-0000000000f1";

/** Le document DÉJÀ repris par un lot antérieur — la clé que le parc connaît. */
const DOCUMENT_DEJA_REPRIS = "F-2019-0001";

/**
 * Les PARCS, fabriqués pour que chaque rang existe au moins une fois.
 *
 * - `SER-1` : une seule machine, chez le client 1 → rang 1 ;
 * - `SER-2` : DEUX machines dans le parc (deux modèles), une par client → la
 *   série seule est ambiguë, la conjonction client + série n'en désigne
 *   qu'une → rang 2 ;
 * - `SER-4` : une seule machine, mais chez le client 2 ;
 * - `SER-5` : deux machines chez le MÊME client 1 → indécidable.
 */
/** Les deux devises du semis, telles que `lireDevise` les rend — jamais un chiffre écrit ici. */
const XPF = lireDevise(DEVISES.find((d) => d.code === "XPF"));
const EUR = lireDevise(DEVISES.find((d) => d.code === "EUR"));

function parcsFabriques(devise = XPF): ParcsDImport {
  const cle = (code: string | undefined, raison: string | undefined) =>
    cleDeClient({ codeExterne: code, raisonSociale: raison, rang: 0 }).cle;
  const clients = new Map<string, string>([
    [cle("HIST-C1", undefined), CLIENT_1],
    [cle(undefined, "Forge Mirabelle"), CLIENT_1],
    [cle("HIST-C2", undefined), CLIENT_2],
    [cle(undefined, "Scierie Nuage"), CLIENT_2],
  ]);
  return {
    clients: {
      cles: new Set(clients.keys()),
      ambigues: new Set(),
      fiches: clients,
    },
    agences: { parCode: new Map() },
    familles: { parCode: new Map() },
    sites: {
      fiches: new Map([
        [cleDuSite(CLIENT_1, "Atelier"), SITE_1A],
        [cleDuSite(CLIENT_1, "Dépôt"), SITE_1B],
        [cleDuSite(CLIENT_2, "Scierie"), SITE_2],
      ]),
    },
    sitesDetails: new Map([
      [SITE_1A, { clientId: CLIENT_1, agenceId: AGENCE }],
      [SITE_1B, { clientId: CLIENT_1, agenceId: AGENCE }],
      [SITE_2, { clientId: CLIENT_2, agenceId: AGENCE }],
    ]),
    modeles: { fiches: new Map() },
    machines: {
      parSerie: new Map([
        ["SER-1", [{ id: MACHINE_1, clientId: CLIENT_1 }]],
        [
          "SER-2",
          [
            { id: MACHINE_2, clientId: CLIENT_1 },
            { id: MACHINE_3, clientId: CLIENT_2 },
          ],
        ],
        ["SER-4", [{ id: MACHINE_4, clientId: CLIENT_2 }]],
        [
          "SER-5",
          [
            { id: MACHINE_5, clientId: CLIENT_1 },
            { id: MACHINE_6, clientId: CLIENT_1 },
          ],
        ],
      ]),
    },
    historique: {
      fiches: new Map([
        [cleDuDocument(DOCUMENT_DEJA_REPRIS), INTERVENTION_DEJA],
      ]),
    },
    devise,
    // Les deux parcs de la VGP (VGP-IMPORT) : ce gabarit ne les lit pas, le
    // type les exige pour qu'un oubli ne compile pas.
    verifications: { parRapport: new Map() },
    observations: { fiches: new Map() },
  };
}

/** Le parc de la CIBLE, tel que la route le passerait : les documents repris. */
function parcCible(parcs: ParcsDImport) {
  return {
    cles: new Set(parcs.historique.fiches.keys()),
    ambigues: new Set<string>(),
  };
}

/** Le sérial de tableur du 27 mars 2019 — une VRAIE date de classeur. */
const SERIE_27_03_2019 = 43551;

type LigneDuFichier = Readonly<
  Partial<Record<keyof typeof COLONNES_HISTORIQUE, Cellule>>
>;

/** Une ligne SAINE, que chaque scénario dérange sur un seul point. */
function saine(surcharge: LigneDuFichier = {}): LigneDuFichier {
  return {
    date: { serie: SERIE_27_03_2019 },
    typeDocument: { texte: "FACTURE" },
    numeroDocument: { texte: "F-2019-0042" },
    client: { texte: "HIST-C1" },
    site: { texte: "Atelier" },
    machine: { texte: "SER-1" },
    referenceOr: { texte: "OR-77" },
    technicien: { texte: "Jean" },
    objet: { texte: "Remplacement du flexible" },
    montant: { nombre: 12500 },
    ...surcharge,
  };
}

function feuille(lignes: readonly LigneDuFichier[]): FeuilleLue {
  const colonnes = Object.keys(
    COLONNES_HISTORIQUE,
  ) as (keyof typeof COLONNES_HISTORIQUE)[];
  return {
    nom: "historique",
    lignes: [
      [{ texte: marqueurDu({ type: "historique", version: 1 }) }],
      colonnes.map((c) => ({ texte: COLONNES_HISTORIQUE[c] })),
      ...lignes.map((ligne) => colonnes.map((c) => ligne[c])),
    ],
  };
}

function controler(
  lignes: readonly LigneDuFichier[],
  parcs = parcsFabriques(),
): readonly LigneControlee[] {
  const controle = controlerFeuille(
    feuille(lignes),
    modeleHistorique(parcs),
    parcCible(parcs),
  );
  if (!controle.lisible) {
    throw new Error(`illisible : ${JSON.stringify(controle.anomalies)}`);
  }
  return controle.lignes;
}

/* ════════════════════════════════════════════════════════════════════════
 * LE GABARIT, CONFRONTÉ À SON SCHÉMA — la forme des sept autres
 * ════════════════════════════════════════════════════════════════════════ */

const CHAMPS_DU_SCHEMA = Object.keys(schemaLigneHistorique.shape);

describe("le gabarit « historique » est publié, et confronté à son schéma", () => {
  it("est le huitième gabarit publié, et la route le trouve par son marqueur", () => {
    expect(TYPES_PUBLIES).toContain("historique");
    const modele = gabaritDuMarqueur(
      { texte: "CODIPLAN-historique-v1" },
      parcsFabriques(),
    );
    expect(modele?.type).toBe("historique");
    expect(modele?.version).toBe(1);
  });

  it("porte les DIX colonnes mesurées sur le classeur réel, dans cet ordre", () => {
    expect(Object.values(COLONNES_HISTORIQUE)).toEqual([
      "Date",
      "Type de document",
      "N° document",
      "Client (code ou raison sociale)",
      "Site (libellé)",
      "Machine (n° de série)",
      "Référence OR",
      "Technicien",
      "Objet de l'intervention",
      "Montant HT (XPF)",
    ]);
    const modele = modeleHistorique(parcsFabriques());
    const obligatoires = modele.colonnes
      .filter((c) => c.obligatoire)
      .map((c) => c.nom);
    expect(obligatoires).toEqual([
      COLONNES_HISTORIQUE.date,
      COLONNES_HISTORIQUE.typeDocument,
      COLONNES_HISTORIQUE.numeroDocument,
      COLONNES_HISTORIQUE.client,
      COLONNES_HISTORIQUE.objet,
    ]);
  });

  it("a réellement lu un schéma — le témoin de non-vacuité", () => {
    expect(CHAMPS_DU_SCHEMA.length).toBeGreaterThanOrEqual(10);
  });

  it("chaque champ du schéma est EXPOSÉ ou ÉCARTÉ nommément, et existe", () => {
    const exposes = new Set(Object.values(CHAMPS_HISTORIQUE));
    const orphelins = CHAMPS_DU_SCHEMA.filter(
      (champ) =>
        !exposes.has(champ) && !Object.hasOwn(CHAMPS_HISTORIQUE_ECARTES, champ),
    );
    expect(orphelins).toEqual([]);
    for (const [champ, motif] of Object.entries(CHAMPS_HISTORIQUE_ECARTES)) {
      expect(motif.trim().length, champ).toBeGreaterThan(20);
      expect(CHAMPS_DU_SCHEMA, `${champ} n'existe pas au schéma`).toContain(
        champ,
      );
      expect(exposes.has(champ), `${champ} est exposé ET écarté`).toBe(false);
    }
  });

  it("aucune colonne ORPHELINE : chaque colonne alimente un champ ou une lecture", () => {
    for (const colonne of Object.values(COLONNES_HISTORIQUE)) {
      const alimente =
        Object.hasOwn(CHAMPS_HISTORIQUE, colonne) ||
        Object.values(CHAMPS_HISTORIQUE_ECARTES).some((motif) =>
          motif.includes(`« ${colonne} »`),
        );
      expect(alimente, `« ${colonne} » ne va nulle part`).toBe(true);
    }
  });

  it("le TECHNICIEN est un TEXTE : aucun champ du schéma ne désigne la table technicien", () => {
    expect(CHAMPS_HISTORIQUE[COLONNES_HISTORIQUE.technicien]).toBe(
      "technicien",
    );
    expect(CHAMPS_DU_SCHEMA).not.toContain("technicien_id");
    expect(
      schemaLigneHistorique.shape.technicien.safeParse("Jean").success,
    ).toBe(true);
  });

  it("le TYPE d'intervention est UNE valeur de la liste close, choisie une fois — jamais déduite", () => {
    expect(TYPES_INTERVENTION).toContain(TYPE_INTERVENTION_REPRISE);
    // *Aucun `TypeIntervention` ne se déduit d'un texte libre par
    // ressemblance* (D127) : le schéma de la ligne ne porte AUCUN champ
    // `type`, et « Objet de l'intervention » reste un texte.
    expect(CHAMPS_DU_SCHEMA).not.toContain("type");
    expect(CHAMPS_HISTORIQUE[COLONNES_HISTORIQUE.objet]).toBe("objet");
  });

  it("une intervention reprise naît CLÔTURÉE et FACTURÉE : elle n'entre dans aucune file", () => {
    // Le statut est celui du cycle de vie, tel quel — mesuré au schéma :
    // `StatutIntervention.cloturee`. Le second axe (D8) est FIXÉ à
    // « facturée » : la ligne EST un document de facturation de l'outil tiers
    // — sans cela, le déclencheur `intervention_facturation_a_la_cloture`
    // rangerait l'archive entière dans la file « à facturer ».
    expect(STATUT_FACTURATION_REPRISE).toBe("facturee");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LA CLÉ — le N° document, et il ne duplique pas
 * ════════════════════════════════════════════════════════════════════════ */

describe("la CLÉ est le N° document, et un second passage ne duplique rien", () => {
  it("une ligne saine est une CRÉATION, sous la clé de son document", () => {
    const [ligne] = controler([saine()]);
    expect(ligne?.action).toBe("creation");
    expect(ligne?.cle?.cle).toBe(cleDuDocument("F-2019-0042"));
    expect(ligne?.cle?.forme).toBe("serie");
    expect(ligne?.cle?.complet).toBe(true);
  });

  it("un document DÉJÀ repris est REJETÉ avec son motif — jamais modifié, jamais dupliqué", () => {
    // *Une intervention close est un fait passé* : le cycle de vie refuse
    // toute modification (déclencheur `intervention_cycle_de_vie`), si bien
    // qu'un second passage n'a rien à écrire — il le DIT, ligne à ligne.
    const [ligne] = controler([
      saine({ numeroDocument: { texte: DOCUMENT_DEJA_REPRIS } }),
    ]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_DOCUMENT_DEJA_REPRIS);
  });

  it("la clé tolère la GRAPHIE du numéro — casse, espaces —, jamais un autre numéro", () => {
    expect(cleDuDocument(" f-2019-0001 ")).toBe(cleDuDocument("F-2019-0001"));
    expect(cleDuDocument("F-2019-0001")).not.toBe(cleDuDocument("F-2019-0002"));
    const [ligne] = controler([
      saine({ numeroDocument: { texte: " f-2019-0001 " } }),
    ]);
    expect(ligne?.rejetMotif).toBe(MOTIF_DOCUMENT_DEJA_REPRIS);
  });

  it("deux lignes du MÊME fichier sur le même document sont deux DOUBLONS DE FICHIER", () => {
    const lignes = controler([
      saine({ numeroDocument: { texte: "F-2019-0099" } }),
      saine({ numeroDocument: { texte: "F-2019-0099" } }),
    ]);
    expect(lignes.map((l) => l.rejetMotif)).toEqual([
      MOTIF_DOUBLON_FICHIER,
      MOTIF_DOUBLON_FICHIER,
    ]);
  });

  it("LE MÊME FICHIER REDÉPOSÉ après application : chaque ligne est rejetée, aucune n'est créée", () => {
    // On simule l'application : la clé de la première passe entre au parc.
    const premiere = controler([saine()]);
    const cle = premiere[0]?.cle?.cle ?? "";
    const parcs = parcsFabriques();
    const apres: ParcsDImport = {
      ...parcs,
      historique: {
        fiches: new Map([...parcs.historique.fiches, [cle, INTERVENTION_DEJA]]),
      },
    };
    const seconde = controler([saine()], apres);
    expect(seconde.map((l) => l.action)).toEqual(["rejet"]);
    expect(seconde[0]?.rejetMotif).toBe(MOTIF_DOCUMENT_DEJA_REPRIS);
  });

  it("une ligne sans N° document est une DONNÉE refusée, jamais un reste de gabarit", () => {
    const [ligne] = controler([saine({ numeroDocument: undefined })]);
    expect(ligne?.nature).toBe("donnee");
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_SAISIE_REFUSEE);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LE CLIENT ET LE SITE — la même clé que les autres gabarits
 * ════════════════════════════════════════════════════════════════════════ */

describe("le CLIENT se résout par `cleDeClient` (RG-IMP-05), et le SITE par le couple", () => {
  it("le client se désigne par son CODE, ou à défaut par sa RAISON SOCIALE", () => {
    const lignes = controler([
      saine({ client: { texte: "HIST-C1" } }),
      saine({
        numeroDocument: { texte: "F-2" },
        client: { texte: "Forge Mirabelle" },
      }),
      saine({
        numeroDocument: { texte: "F-3" },
        client: { texte: "forge  MIRABELLE" },
      }),
    ]);
    expect(lignes.map((l) => l.action)).toEqual([
      "creation",
      "creation",
      "creation",
    ]);
  });

  it("un client INTROUVABLE est refusé avec SON motif — celui des équipements", () => {
    const [ligne] = controler([saine({ client: { texte: "Inconnu SARL" } })]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_CLIENT_INTROUVABLE);
  });

  it("un site NOMMÉ qui n'existe pas chez ce client est refusé — pas deviné", () => {
    const [ligne] = controler([saine({ site: { texte: "Hangar" } })]);
    expect(ligne?.rejetMotif).toBe(MOTIF_SITE_INTROUVABLE);
    // Et le témoin : le libellé existe chez l'AUTRE client, et ne sert pas.
    const [autre] = controler([saine({ site: { texte: "Scierie" } })]);
    expect(autre?.rejetMotif).toBe(MOTIF_SITE_INTROUVABLE);
  });

  it("un site ABSENT chez un client qui n'en a qu'UN désigne ce site — c'est le seul possible", () => {
    const prepare = preparerUneReprise(
      parcsFabriques(),
      valeursDe(
        saine({
          client: { texte: "HIST-C2" },
          site: undefined,
          machine: undefined,
        }),
      ),
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.site_id).toBe(SITE_2);
    expect(prepare.saisie.agence_id).toBe(AGENCE);
  });

  it("un site ABSENT chez un client qui en a PLUSIEURS est refusé : la ligne ne dit pas où", () => {
    const [ligne] = controler([saine({ site: undefined })]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe(MOTIF_SITE_INDETERMINE);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LA MACHINE — les trois rangs de D127, et aucun n'est un rejet
 * ════════════════════════════════════════════════════════════════════════ */

function valeursDe(ligne: LigneDuFichier): Record<string, string | undefined> {
  const [controlee] = controler([ligne]);
  return { ...controlee?.valeurs };
}

describe("le rapprochement de la MACHINE suit les trois rangs de D127", () => {
  it("RANG 1 — la série désigne UNE machine du parc, et elle est chez ce client", () => {
    const prepare = preparerUneReprise(parcsFabriques(), valeursDe(saine()));
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.rattachement).toEqual({ rang: 1, machineId: MACHINE_1 });
  });

  it("RANG 2 — la série est ambiguë dans le parc, mais UNE seule chez ce client", () => {
    const chez1 = preparerUneReprise(
      parcsFabriques(),
      valeursDe(saine({ machine: { texte: "SER-2" } })),
    );
    expect(chez1.prete && chez1.rattachement).toEqual({
      rang: 2,
      machineId: MACHINE_2,
    });
    const chez2 = preparerUneReprise(
      parcsFabriques(),
      valeursDe(
        saine({
          client: { texte: "HIST-C2" },
          site: { texte: "Scierie" },
          machine: { texte: "SER-2" },
        }),
      ),
    );
    expect(chez2.prete && chez2.rattachement).toEqual({
      rang: 2,
      machineId: MACHINE_3,
    });
  });

  it("RANG 3 — tout le reste est NON RATTACHÉ, avec son motif, et la ligne ENTRE quand même", () => {
    const cas = [
      ["SER-INCONNUE", "serie_inconnue"],
      ["SER-4", "serie_autre_client"],
      ["SER-5", "serie_ambigue"],
    ] as const;
    for (const [serie, motif] of cas) {
      const prepare = preparerUneReprise(
        parcsFabriques(),
        valeursDe(saine({ machine: { texte: serie } })),
      );
      expect(prepare.prete, serie).toBe(true);
      if (!prepare.prete) continue;
      expect(prepare.rattachement).toEqual({ rang: 3, motif, serie });
      expect(prepare.saisie.machine_id).toBeNull();
    }
    // Et par la chaîne : aucune de ces lignes n'est un REJET — *les écarter
    // perdrait les trois quarts de l'historique* (72 % mesurés).
    const lignes = controler(
      cas.map(([serie], i) =>
        saine({
          numeroDocument: { texte: `F-R3-${i}` },
          machine: { texte: serie },
        }),
      ),
    );
    expect(lignes.map((l) => l.action)).toEqual([
      "creation",
      "creation",
      "creation",
    ]);
  });

  it("SANS série — ni rang ni motif : une intervention peut ne porter sur aucune machine", () => {
    const prepare = preparerUneReprise(
      parcsFabriques(),
      valeursDe(saine({ machine: undefined })),
    );
    expect(prepare.prete && prepare.rattachement).toEqual({
      rang: "sans_serie",
    });
  });

  it("le RAPPORT compte les rangs, et son total explique chaque ligne qui entrera", () => {
    const parcs = parcsFabriques();
    const lignes = controler(
      [
        saine({ numeroDocument: { texte: "F-A" } }),
        saine({
          numeroDocument: { texte: "F-B" },
          machine: { texte: "SER-2" },
        }),
        saine({
          numeroDocument: { texte: "F-C" },
          machine: { texte: "SER-5" },
        }),
        saine({ numeroDocument: { texte: "F-D" }, machine: undefined }),
        saine({
          numeroDocument: { texte: "F-E" },
          client: { texte: "Personne" },
        }),
      ],
      parcs,
    );
    const comptes = decompterLesRattachements(
      lignes.map((l) => ({
        rang: l.rang,
        action: l.action,
        valeurs: l.valeurs,
      })),
      parcs,
    );
    expect(comptes.sansSerie).toBe(1);
    expect(comptes.rang1).toBe(1);
    expect(comptes.rang2).toBe(1);
    expect(comptes.nonRattachees).toEqual([
      { rang: 5, serie: "SER-5", motif: "serie_ambigue" },
    ]);
    // Le TÉMOIN : les quatre lignes qui entreront sont toutes expliquées ; la
    // ligne rejetée n'est pas comptée — elle n'entrera pas.
    expect(
      comptes.sansSerie +
        comptes.rang1 +
        comptes.rang2 +
        comptes.nonRattachees.length,
    ).toBe(lignes.filter((l) => l.action === "creation").length);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LA DATE — le sérial du tableur passe, l'ISO ne passe pas
 * ════════════════════════════════════════════════════════════════════════ */

describe("la DATE se lit par la grammaire de D31, et rien d'autre", () => {
  it("une VRAIE date de tableur traverse le dictionnaire en JJ/MM/AAAA, et se lit", () => {
    const [ligne] = controler([saine()]);
    // *C'est la condition de levée écrite dans `CHAMPS_EQUIPEMENTS_ECARTES`* :
    // le dictionnaire de ligne rend désormais une date — sous la forme que
    // D31 arrête, jamais sous celle du sérial.
    expect(ligne?.valeurs[COLONNES_HISTORIQUE.date]).toBe("27/03/2019");
    const prepare = preparerUneReprise(parcsFabriques(), { ...ligne?.valeurs });
    expect(prepare.prete && prepare.saisie.date.toISOString()).toBe(
      "2019-03-27T00:00:00.000Z",
    );
  });

  it("le texte JJ/MM/AAAA passe aussi — c'est la forme de D31", () => {
    const [ligne] = controler([saine({ date: { texte: "27/03/2019" } })]);
    expect(ligne?.action).toBe("creation");
  });

  it("le texte ISO du classeur d'origine est REFUSÉ `date_format` — la grammaire n'est pas assouplie", () => {
    // *C'est au fichier de se conformer, pas au lecteur de deviner* (ratifié
    // le 09/09/2026). Le fichier remis a été converti ; celui-ci ne l'est pas.
    const [ligne] = controler([saine({ date: { texte: "2019-03-27" } })]);
    expect(ligne?.action).toBe("rejet");
    expect(ligne?.rejetMotif).toBe("date_format");
  });

  it("une date qui n'existe pas, une date avec heure, une date absente : trois refus distincts", () => {
    const lignes = controler([
      saine({
        numeroDocument: { texte: "F-1" },
        date: { texte: "31/02/2019" },
      }),
      saine({ numeroDocument: { texte: "F-2" }, date: { serie: 43551.5 } }),
      saine({ numeroDocument: { texte: "F-3" }, date: undefined }),
    ]);
    expect(lignes.map((l) => l.rejetMotif)).toEqual([
      "date_hors_plage",
      "date_format",
      MOTIF_SAISIE_REFUSEE,
    ]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LE MONTANT — pour mémoire, entier, dans la devise de la société
 * ════════════════════════════════════════════════════════════════════════ */

describe("le MONTANT HT est repris tel quel, ou refusé — jamais converti (I2, I3)", () => {
  it("un entier de francs entre, en entier ; une cellule vide est une absence", () => {
    const avec = preparerUneReprise(parcsFabriques(), valeursDe(saine()));
    expect(avec.prete && avec.saisie.montant_ht).toBe(BigInt(12500));
    expect(avec.prete && avec.saisie.devise_code).toBe("XPF");
    const sans = preparerUneReprise(
      parcsFabriques(),
      valeursDe(saine({ montant: undefined })),
    );
    expect(sans.prete && sans.saisie.montant_ht).toBeNull();
    expect(sans.prete && sans.saisie.devise_code).toBeNull();
  });

  it("un AVOIR porte un montant NÉGATIF, et il entre — c'est ce que l'archive dit", () => {
    const avoir = preparerUneReprise(
      parcsFabriques(),
      valeursDe(
        saine({ typeDocument: { texte: "AVOIR" }, montant: { nombre: -4000 } }),
      ),
    );
    expect(avoir.prete && avoir.saisie.montant_ht).toBe(BigInt(-4000));
  });

  it("des décimales, un séparateur de milliers, un texte : refusés `montant_illisible`", () => {
    const lignes = controler([
      saine({ numeroDocument: { texte: "F-1" }, montant: { texte: "12 500" } }),
      saine({ numeroDocument: { texte: "F-2" }, montant: { texte: "125,5" } }),
      saine({ numeroDocument: { texte: "F-3" }, montant: { texte: "douze" } }),
    ]);
    expect(lignes.map((l) => l.rejetMotif)).toEqual([
      MOTIF_MONTANT_ILLISIBLE,
      MOTIF_MONTANT_ILLISIBLE,
      MOTIF_MONTANT_ILLISIBLE,
    ]);
  });

  it("une société qui ne tient pas ses comptes en XPF ne peut pas recevoir la colonne — refus, pas conversion", () => {
    const euro = parcsFabriques(EUR);
    const [avec, sans] = controler(
      [
        saine({ numeroDocument: { texte: "F-1" } }),
        saine({ numeroDocument: { texte: "F-2" }, montant: undefined }),
      ],
      euro,
    );
    expect(avec?.rejetMotif).toBe(MOTIF_MONTANT_DEVISE);
    // Sans montant, rien n'est à convertir : la ligne passe.
    expect(sans?.action).toBe("creation");
  });
});
