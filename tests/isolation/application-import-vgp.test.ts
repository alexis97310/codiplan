import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { type Cellule } from "@/lib/excel/format";
import {
  annulerLeLotDeVgp,
  annulerLeLotDeVgp_observations,
} from "@/lib/imports/annulation";
import {
  appliquerLeLotDeVgp,
  appliquerLeLotDeVgp_observations,
} from "@/lib/imports/application";
import { enregistrerLeControle } from "@/lib/imports/depot";
import {
  COLONNES_VGP,
  COLONNES_VGP_OBSERVATIONS,
  gabaritDuMarqueur,
  marqueurDu,
  MOTIF_OBSERVATION_DEJA_REPRISE,
  MOTIF_ORIGINE_INCONNUE,
  MOTIF_RAPPORT_AMBIGU,
  MOTIF_RAPPORT_INTROUVABLE,
} from "@/lib/imports/modeles";
import { PARC_VIDE, indexerLeParcCible } from "@/lib/imports/parc-cibles";
import { indexerLesParcs } from "@/lib/imports/parcs";
import { decompterLesRattachementsVgp } from "@/lib/imports/rapport-vgp";
import { applicationDuType } from "@/lib/imports/types-dimport";
import { MOTIFS_ATTENTE } from "@/lib/imports/vgp";
import { informationDeLaMachine } from "@/lib/vgp/registre";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES VÉRIFICATIONS RÉGLEMENTAIRES, DE LA FEUILLE AU REGISTRE — ET RETOUR
 * (VGP-IMPORT ; D88, D114, I6).
 *
 * **C'est l'appelant de la chaîne ENTIÈRE des deux gabarits** : feuille →
 * choix par le MARQUEUR → contrôle → lot en base → application → PV réellement
 * écrits sous leur machine, avec l'origine du fichier → un PV EN ATTENTE qui
 * reste dans le lot sous son motif → l'échéance qui ne bouge PAS (arbitrage 2)
 * → les observations, qui exigent leur PV et n'engendrent AUCUNE demande
 * (arbitrage 1) → le même fichier redéposé → l'annulation, dans l'ordre
 * inverse de l'import. *Une suite qui éprouve tous les maillons n'éprouve pas
 * la chaîne* (§9, 08/09).
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif et sous les
 * politiques. **Les relectures sont faites en SQL sous le PROPRIÉTAIRE** : ce
 * qu'un scénario doit constater est ce que la BASE porte.
 *
 * **CE FICHIER REND LE SEMIS TEL QU'IL L'A TROUVÉ.** Tout ce qu'il crée porte
 * le préfixe `VGP-` sur le nom de fichier, et rien d'autre n'est supprimé.
 */

async function nettoyer(): Promise<void> {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "vgp_observation" WHERE "societe_id" = '${SOCIETE_A}' AND "id" IN (
       SELECT "entite_id"::uuid FROM "import_lot_ligne"
        WHERE "societe_id" = '${SOCIETE_A}' AND "entite" = 'vgp_observation' AND "entite_id" IS NOT NULL
          AND "import_lot_id" IN (SELECT "id" FROM "import_lot" WHERE "nom_fichier" LIKE 'VGP-%'))`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "vgp_verification" WHERE "societe_id" = '${SOCIETE_A}' AND "id" IN (
       SELECT "entite_id"::uuid FROM "import_lot_ligne"
        WHERE "societe_id" = '${SOCIETE_A}' AND "entite" = 'vgp_verification' AND "entite_id" IS NOT NULL
          AND "import_lot_id" IN (SELECT "id" FROM "import_lot" WHERE "nom_fichier" LIKE 'VGP-%'))`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "import_lot" WHERE "societe_id" = '${SOCIETE_A}' AND "nom_fichier" LIKE 'VGP-%'`,
  );
}

beforeAll(nettoyer);
afterAll(async () => {
  await nettoyer();
  await fermerClients();
});

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};
const SESSION_B = { ...SESSION, societeId: SOCIETE_B };

/** Le sérial de tableur du 27 mars 2019 — une VRAIE date de classeur. */
const SERIE_27_03_2019 = 43551;
const SERIE_15_01_2020 = 43845;

const RAPPORT_PARC = "315503594.1.R";
const RAPPORT_SEUL = "31960570/4.1.1.R";

type LignePv = Readonly<Partial<Record<keyof typeof COLONNES_VGP, Cellule>>>;

function pv(surcharge: LignePv): LignePv {
  return {
    date: { serie: SERIE_27_03_2019 },
    organisme: { texte: "Bureau Veritas" },
    reference: { texte: RAPPORT_PARC },
    inspecteur: { texte: "M. Dupont" },
    clientSite: { texte: "C-001 / Atelier" },
    conforme: { texte: "NON" },
    origine: { texte: "rapport_transmis_client" },
    ...surcharge,
  };
}

/**
 * LE FICHIER DES PV — cinq lignes, et chacune répond à une question que les
 * quatre autres ne posent pas : deux PV d'un même rapport sur deux machines,
 * un rapport à une seule machine, un « ? » de conformité, un PV SANS machine
 * (en mots), et une origine que D114 ne connaît pas.
 */
const FICHIER_PV: readonly LignePv[] = [
  pv({ machine: { texte: "SN-A1" } }),
  pv({ machine: { texte: "SN-A2" }, conforme: { texte: "?" } }),
  pv({
    machine: { texte: "SN-A3" },
    reference: { texte: RAPPORT_SEUL },
    origine: { texte: "rapport_organisme" },
    avis: { texte: "RAS" },
  }),
  pv({ machine: { texte: "SANS" } }),
  pv({ machine: { texte: "SN-A1" }, origine: { texte: "on ne sait plus" } }),
];

type LigneObservation = Readonly<
  Partial<Record<keyof typeof COLONNES_VGP_OBSERVATIONS, Cellule>>
>;

function observation(surcharge: LigneObservation): LigneObservation {
  return {
    reference: { texte: RAPPORT_PARC },
    dateSignalement: { serie: SERIE_27_03_2019 },
    observation: { texte: "Flexible hydraulique fissuré" },
    statut: { texte: "Non rattachée à un document CODIMA" },
    ...surcharge,
  };
}

/**
 * LE FICHIER DES OBSERVATIONS — les trois statuts réels, un rapport ambigu
 * départagé par la série, un rapport ambigu non départagé, un rapport inconnu.
 */
const FICHIER_OBSERVATIONS: readonly LigneObservation[] = [
  observation({ code: { texte: "OBS-1" }, machine: { texte: "SN-A1" } }),
  observation({
    code: { texte: "OBS-2" },
    machine: { texte: "SN-A2" },
    statut: { texte: "Levée - facturée" },
    documentReponse: { texte: "FAC-2020-0042" },
    dateReponse: { serie: SERIE_15_01_2020 },
  }),
  observation({
    code: { texte: "OBS-3" },
    reference: { texte: RAPPORT_SEUL },
    statut: { texte: "Chiffrée - devis émis" },
  }),
  // Le rapport couvre DEUX machines et la ligne ne dit pas laquelle.
  observation({ code: { texte: "OBS-4" } }),
  observation({ code: { texte: "OBS-5" }, reference: { texte: "999.9.R" } }),
];

/** Le chemin de la route de contrôle, rejoué — marqueur puis parc de la cible. */
async function deposer<C extends Record<string, string>>(
  nom: string,
  type: string,
  colonnes: C,
  lignes: readonly Readonly<Partial<Record<keyof C, Cellule>>>[],
) {
  const parcs = await indexerLesParcs(SESSION, clientApp());
  const modele = gabaritDuMarqueur({ texte: `CODIPLAN-${type}-v1` }, parcs);
  if (modele === null) throw new Error(`aucun gabarit « ${type} »`);
  const cles = Object.keys(colonnes) as (keyof C)[];
  const feuille: FeuilleLue = {
    nom: type,
    lignes: [
      [{ texte: marqueurDu(modele) }],
      cles.map((c) => ({ texte: colonnes[c] })),
      ...lignes.map((l) => cles.map((c) => l[c])),
    ],
  };
  const parc =
    (await indexerLeParcCible(SESSION, modele.type, clientApp())) ?? PARC_VIDE;
  const controle = controlerFeuille(feuille, modele, parc);
  if (!controle.lisible) {
    throw new Error(
      `feuille illisible : ${JSON.stringify(controle.anomalies)}`,
    );
  }
  const { lotId } = await enregistrerLeControle(
    SESSION,
    { nom: `VGP-${nom}.xlsx`, type: modele.type, version: modele.version },
    controle.lignes,
    clientApp(),
  );
  return {
    lotId,
    lignes: controle.lignes,
    creations: controle.lignes.filter((l) => l.action === "creation").length,
    motifs: controle.lignes.map((l) => l.rejetMotif),
  };
}

type LigneVerification = {
  id: string;
  machine_id: string;
  date_verification: Date;
  organisme: string;
  reference_rapport: string | null;
  origine: string;
  document_id: string | null;
  rang: number;
  valeurs: Record<string, string>;
};

/** Les PV qu'un lot a produits, relus en SQL sous le propriétaire, dans l'ordre du fichier. */
async function lireLesPv(lotId: string): Promise<LigneVerification[]> {
  return clientOwner().$queryRawUnsafe<LigneVerification[]>(
    `SELECT v."id", v."machine_id", v."date_verification", v."organisme", v."reference_rapport",
            v."origine"::text AS "origine", v."document_id", l."rang", l."valeurs"
       FROM "import_lot_ligne" l
       JOIN "vgp_verification" v ON v."id" = l."entite_id"::uuid
      WHERE l."import_lot_id" = '${lotId}' AND l."entite" = 'vgp_verification'
      ORDER BY l."rang"`,
  );
}

async function compter(table: string): Promise<number> {
  const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "${table}" WHERE "societe_id" = '${SOCIETE_A}'`,
  );
  return Number(n);
}

describe("un lot de VGP écrit des vérifications sous leur machine, relues en SQL", () => {
  let lotPv = "";
  let lotObservations = "";

  it("le rapport annonce trois créations, UN PV en attente sous son motif, et un vrai rejet", async () => {
    const depot = await deposer("pv-premier", "vgp", COLONNES_VGP, FICHIER_PV);
    lotPv = depot.lotId;
    expect(depot.creations).toBe(3);
    expect(depot.motifs).toEqual([
      undefined,
      undefined,
      undefined,
      MOTIFS_ATTENTE.sans_serie,
      MOTIF_ORIGINE_INCONNUE,
    ]);
    const comptes = decompterLesRattachementsVgp(
      depot.lignes,
      COLONNES_VGP.machine,
    );
    expect(comptes.rattachees).toBe(3);
    expect(comptes.autresRejets).toBe(1);
    expect(comptes.enAttente).toEqual([
      { rang: 6, serie: "SANS", motif: MOTIFS_ATTENTE.sans_serie },
    ]);
    expect(applicationDuType("vgp")).not.toBeNull();
    expect(applicationDuType("vgp_observations")).not.toBeNull();
  });

  it("l'application écrit trois PV — origine du fichier, « ? » conservé — et l'attente RESTE dans le lot", async () => {
    const avant = await compter("vgp_verification");
    const resultat = await appliquerLeLotDeVgp(SESSION, lotPv, clientApp());
    expect(resultat).toEqual({
      applique: true,
      creations: 3,
      modifications: 0,
      inchangees: 0,
    });
    expect(await compter("vgp_verification")).toBe(avant + 3);

    const pvs = await lireLesPv(lotPv);
    expect(pvs.map((p) => p.machine_id)).toEqual([
      MACHINE_A1,
      MACHINE_A2,
      MACHINE_A3,
    ]);
    // L'ORIGINE EST CELLE DU FICHIER, ligne par ligne — jamais une constante.
    expect(pvs.map((p) => p.origine)).toEqual([
      "rapport_transmis_client",
      "rapport_transmis_client",
      "rapport_organisme",
    ]);
    expect(pvs[0]?.date_verification.toISOString()).toBe(
      "2019-03-27T00:00:00.000Z",
    );
    expect(pvs[0]?.reference_rapport).toBe(RAPPORT_PARC);
    expect(pvs[0]?.organisme).toBe("Bureau Veritas");
    expect(pvs[0]?.document_id).toBeNull();
    // LES COLONNES SANS ARRIVÉE restent lisibles dans la ligne du lot — et le
    // « ? » y est un « ? », ni oui ni non.
    expect(pvs[1]?.valeurs[COLONNES_VGP.conforme]).toBe("?");
    expect(pvs[0]?.valeurs[COLONNES_VGP.inspecteur]).toBe("M. Dupont");

    // LE PV EN ATTENTE : dans le lot, sous son motif, sans fiche — et sa ligne
    // porte encore tout ce que le fichier disait.
    const [attente] = await clientOwner().$queryRawUnsafe<
      Array<{
        action: string;
        rejet_motif: string;
        entite_id: string | null;
        valeurs: Record<string, string>;
      }>
    >(
      `SELECT "action"::text AS "action", "rejet_motif", "entite_id", "valeurs"
         FROM "import_lot_ligne" WHERE "import_lot_id" = '${lotPv}' AND "rang" = 6`,
    );
    expect(attente?.action).toBe("rejet");
    expect(attente?.rejet_motif).toBe(MOTIFS_ATTENTE.sans_serie);
    expect(attente?.entite_id).toBeNull();
    expect(attente?.valeurs[COLONNES_VGP.reference]).toBe(RAPPORT_PARC);
    expect(attente?.valeurs[COLONNES_VGP.date]).toBe("27/03/2019");
  });

  it("ARBITRAGE 2 — un PV importé ne recalcule AUCUNE échéance tant que la famille n'est pas assujettie", async () => {
    // La famille du semis naît « à déterminer » : le registre dit HORS
    // REGISTRE, PV ou pas. Il ne déduit rien des dates reçues.
    const etat = await informationDeLaMachine(
      SESSION,
      MACHINE_A1,
      new Date(Date.UTC(2026, 8, 22)),
      clientApp(),
    );
    expect(etat?.etat).toBe("hors_registre");
    // Et le PV est bien là : ce n'est pas l'absence d'information qui le dit.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "vgp_verification" WHERE "machine_id" = '${MACHINE_A1}'`,
    );
    expect(Number(n)).toBeGreaterThanOrEqual(1);
  });

  it("LE MÊME FICHIER DE PV REDÉPOSÉ recharge tout — la clé est le rang, et c'est écrit", async () => {
    const depot = await deposer("pv-second", "vgp", COLONNES_VGP, FICHIER_PV);
    // Trois créations à nouveau : aucune clé ne rapproche. *L'annulation du
    // lot est le seul recours*, et ce scénario ne l'applique pas.
    expect(depot.creations).toBe(3);
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "import_lot" WHERE "id" = '${depot.lotId}'`,
    );
  });

  it("les observations exigent leur PV : trois entrent, deux sont refusées avec leur motif", async () => {
    const depot = await deposer(
      "obs-premier",
      "vgp_observations",
      COLONNES_VGP_OBSERVATIONS,
      FICHIER_OBSERVATIONS,
    );
    lotObservations = depot.lotId;
    expect(depot.creations).toBe(3);
    expect(depot.motifs).toEqual([
      undefined,
      undefined,
      undefined,
      MOTIF_RAPPORT_AMBIGU,
      MOTIF_RAPPORT_INTROUVABLE,
    ]);
  });

  it("ARBITRAGE 1 — l'application écrit trois observations, et AUCUNE demande ni intervention", async () => {
    const demandesAvant = await compter("demande");
    const interventionsAvant = await compter("intervention");
    const observationsAvant = await compter("vgp_observation");

    const resultat = await appliquerLeLotDeVgp_observations(
      SESSION,
      lotObservations,
      clientApp(),
    );
    expect(resultat).toEqual({
      applique: true,
      creations: 3,
      modifications: 0,
      inchangees: 0,
    });
    expect(await compter("vgp_observation")).toBe(observationsAvant + 3);
    expect(await compter("demande")).toBe(demandesAvant);
    expect(await compter("intervention")).toBe(interventionsAvant);

    const pvs = await lireLesPv(lotPv);
    const observations = await clientOwner().$queryRawUnsafe<
      Array<{
        verification_id: string;
        libelle: string;
        intervention_id: string | null;
        valeurs: Record<string, string>;
      }>
    >(
      `SELECT o."verification_id", o."libelle", o."intervention_id", l."valeurs"
         FROM "import_lot_ligne" l
         JOIN "vgp_observation" o ON o."id" = l."entite_id"::uuid
        WHERE l."import_lot_id" = '${lotObservations}' ORDER BY l."rang"`,
    );
    expect(observations).toHaveLength(3);
    // Chacune sous SON PV — le rapport à deux machines départagé par la série.
    expect(observations.map((o) => o.verification_id)).toEqual([
      pvs[0]?.id,
      pvs[1]?.id,
      pvs[2]?.id,
    ]);
    expect(observations.every((o) => o.intervention_id === null)).toBe(true);
    // LES TROIS STATUTS, conservés tels quels dans la ligne du lot.
    expect(
      observations.map((o) => o.valeurs[COLONNES_VGP_OBSERVATIONS.statut]),
    ).toEqual([
      "Non rattachée à un document CODIMA",
      "Levée - facturée",
      "Chiffrée - devis émis",
    ]);
    expect(
      observations[1]?.valeurs[COLONNES_VGP_OBSERVATIONS.dateReponse],
    ).toBe("15/01/2020");
  });

  it("LE MÊME FICHIER D'OBSERVATIONS REDÉPOSÉ : chacune est « déjà reprise », rien n'est dupliqué", async () => {
    const depot = await deposer(
      "obs-second",
      "vgp_observations",
      COLONNES_VGP_OBSERVATIONS,
      FICHIER_OBSERVATIONS,
    );
    expect(depot.creations).toBe(0);
    expect(depot.motifs.slice(0, 3)).toEqual([
      MOTIF_OBSERVATION_DEJA_REPRISE,
      MOTIF_OBSERVATION_DEJA_REPRISE,
      MOTIF_OBSERVATION_DEJA_REPRISE,
    ]);
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "import_lot" WHERE "id" = '${depot.lotId}'`,
    );
  });

  it("un lot d'une AUTRE société est introuvable — jamais « interdit »", async () => {
    expect(await appliquerLeLotDeVgp(SESSION_B, lotPv, clientApp())).toEqual({
      applique: false,
      motif: "lot_introuvable",
    });
    expect(
      await annulerLeLotDeVgp_observations(
        SESSION_B,
        lotObservations,
        clientApp(),
      ),
    ).toEqual({ annule: false, motif: "lot_introuvable" });
  });

  it("L'ANNULATION DES PV est REFUSÉE ligne à ligne tant que leurs observations existent — jamais de cascade", async () => {
    const avant = await compter("vgp_verification");
    const resultat = await annulerLeLotDeVgp(SESSION, lotPv, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes).toEqual([
      { rang: 5, defaite: false, motif: "referencee_depuis" },
      { rang: 4, defaite: false, motif: "referencee_depuis" },
      { rang: 3, defaite: false, motif: "referencee_depuis" },
    ]);
    expect(await compter("vgp_verification")).toBe(avant);
    // Le lot est passé « annulé » sans rien défaire : il faut le REDÉPOSER pour
    // recommencer — et ce scénario le fait, après les observations.
  });

  it("L'ANNULATION DES OBSERVATIONS défait les trois, sauf celle qu'une intervention a prise en charge", async () => {
    const [premiere] = await clientOwner().$queryRawUnsafe<
      Array<{ id: string }>
    >(
      `SELECT "entite_id" AS "id" FROM "import_lot_ligne"
        WHERE "import_lot_id" = '${lotObservations}' AND "rang" = 3`,
    );
    // Une observation PLANIFIÉE depuis — le travail terrain n'est jamais
    // perdu (I5). L'intervention du semis suffit : seule la colonne compte.
    const [{ intervention_id }] = await clientOwner().$queryRawUnsafe<
      Array<{ intervention_id: string }>
    >(
      `SELECT "id" AS "intervention_id" FROM "intervention" WHERE "societe_id" = '${SOCIETE_A}' LIMIT 1`,
    );
    await clientOwner().$executeRawUnsafe(
      `UPDATE "vgp_observation" SET "intervention_id" = '${intervention_id}' WHERE "id" = '${premiere?.id}'`,
    );

    const avant = await compter("vgp_observation");
    const resultat = await annulerLeLotDeVgp_observations(
      SESSION,
      lotObservations,
      clientApp(),
    );
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes.filter((l) => l.defaite)).toHaveLength(2);
    expect(resultat.lignes.find((l) => !l.defaite)).toEqual({
      rang: 3,
      defaite: false,
      motif: "referencee_depuis",
    });
    expect(await compter("vgp_observation")).toBe(avant - 2);

    // L'observation retenue est rendue au semis, pour la suite.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "vgp_observation" WHERE "id" = '${premiere?.id}'`,
    );
  });

  it("puis L'ANNULATION DES PV défait les trois, une fois les observations parties", async () => {
    // Le premier lot est déjà « annulé » : il se redépose et se réapplique —
    // trois PV de plus, que ce scénario défait pour rendre la base.
    const depot = await deposer(
      "pv-troisieme",
      "vgp",
      COLONNES_VGP,
      FICHIER_PV,
    );
    await appliquerLeLotDeVgp(SESSION, depot.lotId, clientApp());
    const avant = await compter("vgp_verification");

    const resultat = await annulerLeLotDeVgp(SESSION, depot.lotId, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes.map((l) => l.defaite)).toEqual([true, true, true]);
    expect(await compter("vgp_verification")).toBe(avant - 3);
    expect(await lireLesPv(depot.lotId)).toEqual([]);
  });
});
