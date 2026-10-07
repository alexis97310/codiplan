import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { interventionsOuvertesDuSite } from "@/lib/interventions/depot";
import {
  compterSites,
  lireCatalogueTrajets,
  rechercherSites,
  resumeDesCartesSites,
} from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";
import { resoudreTempsTrajet } from "@/lib/sites/trajet-zone";
import { machinesVgpDepasseeParSite } from "@/lib/vgp/registre";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * `resumeDesCartesSites` (9EB-TP-UX3-2-LISTES-1, QE-13c) et les critères
 * `sans_zone`/`trajet_inconnu` (QE-10 (a)) — même discipline que
 * `tests/isolation/resume-cartes-clients.test.ts` : scène dédiée, préfixée,
 * jamais `SITE_A1_S1` (qui porte des exigences transitoires d'autres
 * fichiers).
 */

afterAll(fermerClients);

const PREFIXE = "9EB2-";

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const clientsEngendres: string[] = [];
let familleId: string | undefined;
let modeleId: string | undefined;

afterAll(async () => {
  if (clientsEngendres.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "vgp_verification" WHERE "machine_id" IN (SELECT "id" FROM "machine" WHERE "client_id" = ANY($1::uuid[]))`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "machine" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
  }
  if (modeleId !== undefined) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "modele_materiel" WHERE "id" = $1::uuid`,
      modeleId,
    );
  }
  if (familleId !== undefined) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      familleId,
    );
  }
});

async function familleEtModeleSoumis(): Promise<string> {
  if (modeleId !== undefined) {
    return modeleId;
  }
  const [famille] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "famille_materiel"
       (id, societe_id, code, libelle, actif, assujettissement_vgp, vgp_periodicite_mois, vgp_reference_texte)
     VALUES (gen_random_uuid(), $1::uuid, $2, 'Famille 9EB2', true, 'soumis', 1, 'texte de test')
     RETURNING "id"`,
    SOCIETE_A,
    `9EB2-${uuidv7()}`,
  );
  familleId = famille?.id;
  const [modele] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "modele_materiel" (id, societe_id, famille_id, marque, reference)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, '9EB2', 'Modèle de scénario')
     RETURNING "id"`,
    SOCIETE_A,
    familleId,
  );
  modeleId = modele?.id;
  return modeleId as string;
}

async function creerClientEtSite(
  options: {
    readonly actif?: boolean;
    readonly zoneGeo?: string | null;
    readonly tempsTrajetMin?: number | null;
  } = {},
): Promise<{ readonly clientId: string; readonly siteId: string }> {
  const clientId = uuidv7();
  const siteId = uuidv7();
  clientsEngendres.push(clientId);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    clientId,
    SOCIETE_A,
    `${PREFIXE}Client ${clientId}`,
    options.actif ?? true,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "zone_geo", "temps_trajet_min")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)`,
    siteId,
    SOCIETE_A,
    clientId,
    AGENCE_A,
    `${PREFIXE}Site ${siteId}`,
    options.zoneGeo ?? null,
    options.tempsTrajetMin ?? null,
  );
  return { clientId, siteId };
}

async function poserMachine(
  clientId: string,
  siteId: string,
  statut: string,
  modele: string,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "numero_serie", "qr_token", "statut", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8::"StatutMachine", now())`,
    id,
    SOCIETE_A,
    modele,
    clientId,
    siteId,
    `${PREFIXE}${id}`,
    `QR-${PREFIXE}${id}`,
    statut,
  );
  return id;
}

async function poserIntervention(
  clientId: string,
  siteId: string,
  statut: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "modifie_le")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'curatif', $5::"StatutIntervention", now())`,
    SOCIETE_A,
    clientId,
    siteId,
    AGENCE_A,
    statut,
  );
}

describe("resumeDesCartesSites — parité avec les lectures unitaires (QE-13c)", () => {
  it("compte les machines EN PARC, les interventions ouvertes et les VGP dépassées", async () => {
    const { clientId, siteId } = await creerClientEtSite();
    const modele = await familleEtModeleSoumis();

    await poserMachine(clientId, siteId, "en_service", modele);
    await poserMachine(clientId, siteId, "ferraillee", modele);
    await poserIntervention(clientId, siteId, "a_planifier");
    await poserIntervention(clientId, siteId, "cloturee");

    const idMachineDepassee = await poserMachine(
      clientId,
      siteId,
      "en_service",
      modele,
    );
    const dateVerification = new Date();
    dateVerification.setUTCMonth(dateVerification.getUTCMonth() - 3);
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "vgp_verification" (id, societe_id, machine_id, date_verification, organisme, origine, modifie_le)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::date, 'APAVE', 'rapport_organisme', now())`,
      SOCIETE_A,
      idMachineDepassee,
      dateVerification.toISOString().slice(0, 10),
    );

    const aujourdHui = new Date();
    const resume = await resumeDesCartesSites(
      INTERNE_A,
      [{ id: siteId }],
      aujourdHui,
      clientApp(),
    );
    const carte = resume.get(siteId);
    expect(carte).toBeDefined();
    // Trois machines EN PARC (en_service × 2) sur quatre posées — la
    // ferraillée en est exclue (`STATUTS_HORS_PARC_ACTIF`).
    expect(carte?.nombreMachines).toBe(2);
    // Une seule intervention OUVERTE — `cloturee` est hors
    // `STATUTS_INTERVENTION_FERMES`.
    expect(carte?.nombreOuvertes).toBe(1);
    expect(carte?.vgpDepassee).toBe(1);

    // PARITÉ avec `interventionsOuvertesDuSite`, jamais un second calcul.
    const ouvertesUnitaire = await interventionsOuvertesDuSite(
      INTERNE_A,
      siteId,
      clientApp(),
    );
    expect(carte?.nombreOuvertes).toBe(ouvertesUnitaire);

    // PARITÉ avec `machinesVgpDepasseeParSite` appelée directement.
    const vgpDirect = await machinesVgpDepasseeParSite(
      INTERNE_A,
      [siteId],
      aujourdHui,
      clientApp(),
    );
    expect(carte?.vgpDepassee).toBe(vgpDirect.get(siteId) ?? 0);
  });

  it("rend zéro pour un site sans aucune donnée — jamais une absence de clé", async () => {
    const { siteId } = await creerClientEtSite();
    const resume = await resumeDesCartesSites(
      INTERNE_A,
      [{ id: siteId }],
      new Date(),
      clientApp(),
    );
    expect(resume.get(siteId)).toEqual({
      nombreMachines: 0,
      nombreOuvertes: 0,
      vgpDepassee: 0,
    });
  });
});

describe("trajet_inconnu / sans_zone — la traduction du `where` confrontée à resoudreTempsTrajet (9EB-TP-UX3-2-LISTES-1)", () => {
  it("couvre les quatre cas : mesuré sur le site, zone nulle, zone avec estimation, zone sans estimation", async () => {
    const sousPrefixe = `${PREFIXE}TRAJ-${uuidv7()}`;
    // ZONE posée AUSSI sur ce site — `resoudreTempsTrajet` fait toujours
    // passer la mesure du site avant la zone, mais `sans_zone` ne lit QUE
    // `zone_geo` : un site mesuré sans zone renseignée s'y confondrait avec
    // `siteSansZone` par accident, pas par la règle.
    const { siteId: siteMesure } = await creerClientEtSite({
      tempsTrajetMin: 45,
      zoneGeo: "sud",
    });
    const { siteId: siteSansZone } = await creerClientEtSite({
      zoneGeo: null,
    });
    const { siteId: siteZoneEstimee } = await creerClientEtSite({
      zoneGeo: "grand_noumea",
    });
    const { siteId: siteZoneSansEstimation } = await creerClientEtSite({
      zoneGeo: "iles",
    });
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "libelle" = $1 WHERE "id" = ANY($2::uuid[])`,
      sousPrefixe,
      [siteMesure, siteSansZone, siteZoneEstimee, siteZoneSansEstimation],
    );

    const catalogue = await lireCatalogueTrajets(INTERNE_A, clientApp());
    const sites = await clientOwner().$queryRawUnsafe<
      { id: string; temps_trajet_min: number | null; zone_geo: string | null }[]
    >(
      `SELECT "id", "temps_trajet_min", "zone_geo" FROM "site" WHERE "id" = ANY($1::uuid[])`,
      [siteMesure, siteSansZone, siteZoneEstimee, siteZoneSansEstimation],
    );
    const attendusInconnus = new Set(
      sites
        .filter((s) => resoudreTempsTrajet(s, catalogue).minutes === null)
        .map((s) => s.id),
    );
    expect(attendusInconnus).toEqual(
      new Set([siteSansZone, siteZoneSansEstimation]),
    );

    const criteresInconnu = schemaRechercheSite.parse({
      texte: sousPrefixe,
      trajet_inconnu: true,
      client_actif: null,
    });
    const resultatInconnu = await rechercherSites(
      INTERNE_A,
      criteresInconnu,
      clientApp(),
    );
    expect(new Set(resultatInconnu.map((s) => s.id))).toEqual(attendusInconnus);

    const criteresSansZone = schemaRechercheSite.parse({
      texte: sousPrefixe,
      sans_zone: true,
      client_actif: null,
    });
    const resultatSansZone = await rechercherSites(
      INTERNE_A,
      criteresSansZone,
      clientApp(),
    );
    expect(resultatSansZone.map((s) => s.id)).toEqual([siteSansZone]);
  });

  it("client_actif: false isole les sites d'un client inactif", async () => {
    const sousPrefixe = `${PREFIXE}INACTIF-${uuidv7()}`;
    const { siteId: siteActif } = await creerClientEtSite({ actif: true });
    const { siteId: siteInactif } = await creerClientEtSite({ actif: false });
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "libelle" = $1 WHERE "id" = ANY($2::uuid[])`,
      sousPrefixe,
      [siteActif, siteInactif],
    );

    const criteres = schemaRechercheSite.parse({
      texte: sousPrefixe,
      client_actif: false,
    });
    const compte = await compterSites(INTERNE_A, criteres, clientApp());
    expect(compte).toBe(1);
    const resultat = await rechercherSites(INTERNE_A, criteres, clientApp());
    expect(resultat.map((s) => s.id)).toEqual([siteInactif]);
  });
});
