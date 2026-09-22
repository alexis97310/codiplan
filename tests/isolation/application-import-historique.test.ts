import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { type Cellule } from "@/lib/excel/format";
import { annulerLeLotDeHistorique } from "@/lib/imports/annulation";
import { appliquerLeLotDeHistorique } from "@/lib/imports/application";
import { enregistrerLeControle } from "@/lib/imports/depot";
import {
  COLONNES_HISTORIQUE,
  gabaritDuMarqueur,
  marqueurDu,
  MOTIF_DOCUMENT_DEJA_REPRIS,
  MOTIF_SITE_INDETERMINE,
} from "@/lib/imports/modeles";
import { PARC_VIDE, indexerLeParcCible } from "@/lib/imports/parc-cibles";
import { indexerLesParcs } from "@/lib/imports/parcs";
import { decompterLesRattachements } from "@/lib/imports/rapport-historique";
import { applicationDuType } from "@/lib/imports/types-dimport";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MODELE_A,
  MODELE_A_AILLEURS,
  SITE_A1_S1,
  SITE_A2_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * L'ARCHIVE SAV, DE LA FEUILLE À L'INTERVENTION CLOSE — ET RETOUR
 * (REPRISE-HISTORIQUE ; D127, I6, I5).
 *
 * **C'est l'appelant de la chaîne ENTIÈRE du huitième gabarit** : feuille →
 * choix par le MARQUEUR → contrôle contre les documents déjà repris → lot en
 * base → application → interventions réellement écrites, closes, sans temps,
 * rattachées ou non → second dépôt du même fichier → annulation. *Une suite
 * qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09).
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif et sous
 * les politiques. **Les relectures sont faites en SQL sous le PROPRIÉTAIRE** :
 * ce qu'un scénario doit constater est ce que la BASE porte — un statut, un
 * temps NUL, un second axe posé —, jamais ce que le code affirme avoir écrit.
 *
 * **CE FICHIER REND LE SEMIS TEL QU'IL L'A TROUVÉ.** Deux machines sont posées
 * pour que le rang 2 existe — la même série sous deux modèles, chez deux
 * clients — et retirées après. Tout ce que ce fichier crée porte le préfixe
 * `RH-`, et rien d'autre n'est supprimé.
 */

/** Les deux machines du rang 2 : même série, deux modèles, deux clients. */
const MACHINE_RH_A1 = "aaaaaaaa-0000-7000-8000-00000000c0a1";
const MACHINE_RH_A2 = "aaaaaaaa-0000-7000-8000-00000000c0a2";
const SERIE_DOUBLE = "RH-SER-DBL";

async function poserLesMachinesDuRang2(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "qr_token", "numero_serie", "modifie_le") VALUES
       ('${MACHINE_RH_A1}', '${SOCIETE_A}', '${MODELE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', 'RH2QMZ4TXWB2NRJ5FHCV3PDGSA', '${SERIE_DOUBLE}', now()),
       ('${MACHINE_RH_A2}', '${SOCIETE_A}', '${MODELE_A_AILLEURS}', '${CLIENT_A2}', '${SITE_A2_S1}', 'RH3XNVB7KQZ4MRT2WJFHD5CGSA', '${SERIE_DOUBLE}', now())`,
  );
}

async function nettoyer(): Promise<void> {
  const owner = clientOwner();
  // Les interventions d'archive que l'annulation n'aurait pas défaites — et
  // leurs rattachements, que la clé étrangère emporte (la seule CASCADE).
  await owner.$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "societe_id" = '${SOCIETE_A}' AND "id" IN (
       SELECT "entite_id"::uuid FROM "import_lot_ligne"
        WHERE "societe_id" = '${SOCIETE_A}' AND "entite" = 'intervention' AND "entite_id" IS NOT NULL
          AND "import_lot_id" IN (SELECT "id" FROM "import_lot" WHERE "nom_fichier" LIKE 'RH-%'))`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "import_lot" WHERE "societe_id" = '${SOCIETE_A}' AND "nom_fichier" LIKE 'RH-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "societe_id" = '${SOCIETE_A}' AND "numero_serie" = '${SERIE_DOUBLE}'`,
  );
}

beforeAll(async () => {
  await nettoyer();
  await poserLesMachinesDuRang2();
});

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

type Ligne = Readonly<
  Partial<Record<keyof typeof COLONNES_HISTORIQUE, Cellule>>
>;

/**
 * LE FICHIER D'ÉPREUVE — six lignes, et chacune répond à une question que les
 * cinq autres ne posent pas : rang 1, sans série, rang 2, rang 3, site
 * indéterminé, avoir négatif.
 */
const F1 = "RH-F-0001";
const F2 = "RH-F-0002";
const F3 = "RH-F-0003";
const F4 = "RH-F-0004";
const F5 = "RH-F-0005";
const A1 = "RH-A-0001";

function ligne(surcharge: Ligne): Ligne {
  return {
    date: { serie: SERIE_27_03_2019 },
    typeDocument: { texte: "FACTURE" },
    client: { texte: "C-001" },
    site: { texte: "Site A1-1" },
    technicien: { texte: "Jean" },
    objet: { texte: "Remplacement du flexible" },
    montant: { nombre: 12500 },
    ...surcharge,
  };
}

const FICHIER: readonly Ligne[] = [
  ligne({ numeroDocument: { texte: F1 }, machine: { texte: "SN-A1" } }),
  // Par sa RAISON SOCIALE, sans site ni machine : le client A2 n'a qu'un site.
  ligne({
    numeroDocument: { texte: F2 },
    client: { texte: "Client A2" },
    site: undefined,
  }),
  ligne({ numeroDocument: { texte: F3 }, machine: { texte: SERIE_DOUBLE } }),
  ligne({ numeroDocument: { texte: F4 }, machine: { texte: "RH-INCONNUE" } }),
  // Sans site chez un client qui en a DEUX : la ligne ne dit pas où.
  ligne({ numeroDocument: { texte: F5 }, site: undefined }),
  ligne({
    numeroDocument: { texte: A1 },
    typeDocument: { texte: "AVOIR" },
    montant: { nombre: -3000 },
  }),
];

/** Le chemin de la route de contrôle, rejoué — marqueur puis parc de la cible. */
async function deposer(nom: string, lignes: readonly Ligne[]) {
  const parcs = await indexerLesParcs(SESSION, clientApp());
  const modele = gabaritDuMarqueur({ texte: "CODIPLAN-historique-v1" }, parcs);
  if (modele === null) throw new Error("aucun gabarit « historique »");
  const colonnes = Object.keys(
    COLONNES_HISTORIQUE,
  ) as (keyof typeof COLONNES_HISTORIQUE)[];
  const feuille: FeuilleLue = {
    nom: "historique",
    lignes: [
      [{ texte: marqueurDu(modele) }],
      colonnes.map((c) => ({ texte: COLONNES_HISTORIQUE[c] })),
      ...lignes.map((l) => colonnes.map((c) => l[c])),
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
    { nom: `RH-${nom}.xlsx`, type: modele.type, version: modele.version },
    controle.lignes,
    clientApp(),
  );
  return {
    lotId,
    lignes: controle.lignes,
    creations: controle.lignes.filter((l) => l.action === "creation").length,
    motifs: controle.lignes.map((l) => l.rejetMotif),
    rattachements: decompterLesRattachements(controle.lignes, parcs),
  };
}

type LigneIntervention = {
  id: string;
  statut: string;
  statut_facturation: string | null;
  type: string;
  client_id: string;
  site_id: string;
  agence_id: string;
  date_planifiee: Date | null;
  cloturee_le: Date | null;
  temps_mesure_min: number | null;
  temps_valide_min: number | null;
  montant_ht: bigint | null;
  devise_code: string | null;
  forfait_deplacement_id: string | null;
  machines: string[];
};

/** L'intervention qu'une ligne de lot a produite, relue en SQL sous le propriétaire. */
async function lireLIntervention(
  lotId: string,
  numeroDocument: string,
): Promise<LigneIntervention | undefined> {
  const [i] = await clientOwner().$queryRawUnsafe<LigneIntervention[]>(
    `SELECT i."id", i."statut"::text AS "statut", i."statut_facturation"::text AS "statut_facturation",
            i."type"::text AS "type", i."client_id", i."site_id", i."agence_id",
            i."date_planifiee", i."cloturee_le", i."temps_mesure_min", i."temps_valide_min",
            i."montant_ht", i."devise_code", i."forfait_deplacement_id",
            COALESCE(array_agg(im."machine_id"::text) FILTER (WHERE im."machine_id" IS NOT NULL), '{}') AS "machines"
       FROM "import_lot_ligne" l
       JOIN "intervention" i ON i."id" = l."entite_id"::uuid
       LEFT JOIN "intervention_machine" im ON im."intervention_id" = i."id"
      WHERE l."import_lot_id" = '${lotId}' AND l."entite" = 'intervention'
        AND l."valeurs"->>'${COLONNES_HISTORIQUE.numeroDocument}' = '${numeroDocument}'
      GROUP BY i."id"`,
  );
  return i;
}

async function compter(table: string): Promise<number> {
  const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "${table}" WHERE "societe_id" = '${SOCIETE_A}'`,
  );
  return Number(n);
}

describe("un lot d'HISTORIQUE écrit des interventions CLOSES, relues en SQL", () => {
  let premierLot = "";

  it("le rapport annonce cinq créations et un rejet motivé, avec ses comptes par rang", async () => {
    const depot = await deposer("premier", FICHIER);
    premierLot = depot.lotId;
    expect(depot.creations).toBe(5);
    expect(depot.motifs.filter((m) => m !== undefined)).toEqual([
      MOTIF_SITE_INDETERMINE,
    ]);
    // LES TROIS RANGS, ET LE SANS-SÉRIE — comptés par la fonction que
    // l'application appellera.
    // F1 seule est au rang 1 ; F2 et l'avoir n'ont pas de série.
    expect(depot.rattachements.rang1).toBe(1);
    expect(depot.rattachements.rang2).toBe(1);
    expect(depot.rattachements.sansSerie).toBe(2);
    expect(depot.rattachements.nonRattachees).toEqual([
      { rang: 6, serie: "RH-INCONNUE", motif: "serie_inconnue" },
    ]);
    // Le type sait s'appliquer ET s'annuler — la table des routes le dit.
    expect(applicationDuType("historique")).not.toBeNull();
  });

  it("l'application écrit cinq interventions closes, sans temps, facturées — et AUCUNE machine", async () => {
    const machinesAvant = await compter("machine");
    const interventionsAvant = await compter("intervention");

    const resultat = await appliquerLeLotDeHistorique(
      SESSION,
      premierLot,
      clientApp(),
    );
    expect(resultat).toEqual({
      applique: true,
      creations: 5,
      modifications: 0,
      inchangees: 0,
    });

    // **AUCUNE MACHINE N'EST CRÉÉE** (D127, troisième fait) — et cinq
    // interventions le sont.
    expect(await compter("machine")).toBe(machinesAvant);
    expect(await compter("intervention")).toBe(interventionsAvant + 5);

    // RANG 1 — rattachée à SN-A1, close, facturée, datée, sans temps.
    const f1 = await lireLIntervention(premierLot, F1);
    expect(f1).toBeDefined();
    expect(f1?.statut).toBe("cloturee");
    expect(f1?.statut_facturation).toBe("facturee");
    expect(f1?.type).toBe("curatif");
    expect(f1?.client_id).toBe(CLIENT_A1);
    expect(f1?.site_id).toBe(SITE_A1_S1);
    expect(f1?.agence_id).toBe(AGENCE_A);
    expect(f1?.date_planifiee?.toISOString()).toBe("2019-03-27T00:00:00.000Z");
    expect(f1?.cloturee_le).not.toBeNull();
    // **LE TEMPS N'EST PAS REPRIS** (D127, deuxième fait) — et la base a
    // accepté une insertion close sans lui : `intervention_cycle_de_vie` ne
    // juge qu'un UPDATE.
    expect(f1?.temps_mesure_min).toBeNull();
    expect(f1?.temps_valide_min).toBeNull();
    expect(f1?.montant_ht).toBe(BigInt(12500));
    expect(f1?.devise_code).toBe("XPF");
    expect(f1?.forfait_deplacement_id).toBeNull();
    expect(f1?.machines).toEqual([MACHINE_A1]);

    // SANS SÉRIE, ET LE SEUL SITE DU CLIENT A2 — par sa raison sociale.
    const f2 = await lireLIntervention(premierLot, F2);
    expect(f2?.client_id).toBe(CLIENT_A2);
    expect(f2?.site_id).toBe(SITE_A2_S1);
    expect(f2?.machines).toEqual([]);

    // RANG 2 — la série est portée par deux machines, une seule chez A1.
    const f3 = await lireLIntervention(premierLot, F3);
    expect(f3?.machines).toEqual([MACHINE_RH_A1]);

    // RANG 3 — entrée, NON rattachée : ce n'est pas un rejet.
    const f4 = await lireLIntervention(premierLot, F4);
    expect(f4).toBeDefined();
    expect(f4?.machines).toEqual([]);

    // LE REJET n'a rien écrit.
    expect(await lireLIntervention(premierLot, F5)).toBeUndefined();

    // L'AVOIR entre avec son montant négatif — c'est ce que l'archive dit.
    const a1 = await lireLIntervention(premierLot, A1);
    expect(a1?.montant_ht).toBe(BigInt(-3000));

    // LA LIGNE porte ce qu'elle a produit, et les cinq colonnes sans arrivée
    // — objet, technicien, document — y restent lisibles.
    const [trace] = await clientOwner().$queryRawUnsafe<
      Array<{ entite: string; valeurs: Record<string, string> }>
    >(
      `SELECT "entite", "valeurs" FROM "import_lot_ligne"
        WHERE "import_lot_id" = '${premierLot}' AND "entite_id" = '${f1?.id}'`,
    );
    expect(trace.entite).toBe("intervention");
    expect(trace.valeurs[COLONNES_HISTORIQUE.technicien]).toBe("Jean");
    expect(trace.valeurs[COLONNES_HISTORIQUE.objet]).toBe(
      "Remplacement du flexible",
    );
  });

  it("LE MÊME FICHIER REDÉPOSÉ : chaque document repris est REJETÉ, rien n'est dupliqué", async () => {
    const interventionsAvant = await compter("intervention");
    const depot = await deposer("second", FICHIER);
    expect(depot.creations).toBe(0);
    expect(depot.motifs).toEqual([
      MOTIF_DOCUMENT_DEJA_REPRIS,
      MOTIF_DOCUMENT_DEJA_REPRIS,
      MOTIF_DOCUMENT_DEJA_REPRIS,
      MOTIF_DOCUMENT_DEJA_REPRIS,
      MOTIF_SITE_INDETERMINE,
      MOTIF_DOCUMENT_DEJA_REPRIS,
    ]);
    // Le lot s'applique — il n'a simplement rien à écrire.
    const resultat = await appliquerLeLotDeHistorique(
      SESSION,
      depot.lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (resultat.applique) expect(resultat.creations).toBe(0);
    expect(await compter("intervention")).toBe(interventionsAvant);
  });

  it("un lot d'une AUTRE société est introuvable — jamais « interdit »", async () => {
    const resultat = await appliquerLeLotDeHistorique(
      SESSION_B,
      premierLot,
      clientApp(),
    );
    expect(resultat).toEqual({ applique: false, motif: "lot_introuvable" });
  });

  it("l'ANNULATION défait les cinq interventions, garde les machines, et rend les documents reprenables", async () => {
    const machinesAvant = await compter("machine");
    const interventionsAvant = await compter("intervention");

    // UNE LIGNE EST RETENUE : un segment de compteur posé depuis sur la
    // première intervention — *le travail terrain n'est jamais perdu* (I5).
    const f1 = await lireLIntervention(premierLot, F1);
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id", "societe_id", "intervention_id", "utilisateur_id", "debut", "modifie_le")
       VALUES ('aaaaaaaa-0000-7000-8000-00000000c0f1', '${SOCIETE_A}', '${f1?.id}', '${UTILISATEUR_INTERNE_A}', now(), now())`,
    );

    const resultat = await annulerLeLotDeHistorique(
      SESSION,
      premierLot,
      clientApp(),
    );
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    // Cinq lignes rendues : quatre défaites, une refusée AVEC son motif.
    expect(resultat.lignes).toHaveLength(5);
    expect(resultat.lignes.filter((l) => l.defaite)).toHaveLength(4);
    expect(resultat.lignes.find((l) => !l.defaite)).toEqual({
      rang: 3,
      defaite: false,
      motif: "referencee_depuis",
    });

    expect(await compter("intervention")).toBe(interventionsAvant - 4);
    expect(await compter("machine")).toBe(machinesAvant);
    // Le rattachement du rang 2 est parti avec son intervention (la seule
    // cascade du dépôt) ; la machine, elle, est toujours là.
    expect(await lireLIntervention(premierLot, F3)).toBeUndefined();

    // Le segment est retiré pour rendre le semis, puis la ligne retenue.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "id" = 'aaaaaaaa-0000-7000-8000-00000000c0f1'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${f1?.id}'`,
    );

    // **UN DOCUMENT DONT L'INTERVENTION A DISPARU N'EST PLUS « DÉJÀ REPRIS »** :
    // l'index vérifie l'existence, et le même fichier redevient importable.
    const depot = await deposer("troisieme", FICHIER);
    expect(depot.creations).toBe(5);
  });
});
