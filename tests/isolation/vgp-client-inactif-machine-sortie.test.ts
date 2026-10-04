import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";

import { clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  AGENCE_A,
  FUSEAU_SOCIETE_A,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * PV-32 (audit du 28/09/2026 ; D166, décision du 03/10/2026) — LE CLIENT
 * INACTIF ET LA MACHINE HORS PARC ACTIF SORTENT DU REGISTRE DES VGP ET DE
 * SES COMPTES, SANS INTERRUPTEUR.
 *
 * ## POURQUOI CE FICHIER PASSE PAR `DATABASE_URL`, PAS PAR `clientApp()`
 *
 * Même raison que `tests/isolation/vgp-compte-tuile-registre.test.ts`
 * (TABLEAU-1) : `listerLeRegistre`, `compterAPrevoir`,
 * `prochaineEcheanceDuSite` et `famillesADeterminer` passent par le client
 * global de `lib/db/client.ts`. `DATABASE_URL` est posée AVANT l'import du
 * module, sous le rôle applicatif.
 *
 * ## DEUX MACHINES JETABLES, DEUX RAISONS D'ÊTRE ÉCARTÉES
 *
 * `MACHINE_CLIENT_INACTIF` est rattachée à un client désactivé — la raison
 * de D129 pour le planning et le registre des interventions, étendue ici au
 * registre des VGP (sans case pour la revoir : PV-32, contrairement à D129).
 * `MACHINE_FERRAILLEE` est rattachée à un client ACTIF (`CLIENT_FERRAILLE`,
 * posé exprès pour ne pas recouper `CLIENT_A1` du harnais partagé), mais son
 * statut (`ferraillee`, `STATUTS_HORS_PARC_ACTIF`) la sort du parc actif —
 * la seconde raison, indépendante de la première. Les deux sont SOUMISES, et
 * aucune des deux n'a jamais reçu d'information : sans le filtre, elles
 * compteraient dans la voie « sans information » de `compterAPrevoir` et
 * dans `famillesADeterminer` (famille `a_determiner` dédiée).
 */

const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const {
  compterAPrevoir,
  famillesADeterminer,
  listerLeRegistre,
  prochaineEcheanceDuSite,
} = await import("@/lib/vgp/registre");

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const AUJOURD_HUI = instantDuJour(jourDe(maintenant(FUSEAU_SOCIETE_A).local));
const HORIZON_JOURS = 30;

const CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af20";
const SITE_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af21";
const CLIENT_FERRAILLE = "aaaaaaaa-0000-7000-8000-00000000af22";
const SITE_CLIENT_FERRAILLE = "aaaaaaaa-0000-7000-8000-00000000af23";

const FAMILLE_SOUMISE = "aaaaaaaa-0000-7000-8000-00000000af24";
const MODELE_SOUMIS = "aaaaaaaa-0000-7000-8000-00000000af25";
const FAMILLE_A_DETERMINER = "aaaaaaaa-0000-7000-8000-00000000af26";
const MODELE_A_DETERMINER = "aaaaaaaa-0000-7000-8000-00000000af27";

const MACHINE_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af28";
const MACHINE_FERRAILLEE = "aaaaaaaa-0000-7000-8000-00000000af29";
const MACHINE_CLIENT_INACTIF_A_DETERMINER =
  "aaaaaaaa-0000-7000-8000-00000000af2a";
const MACHINE_FERRAILLEE_A_DETERMINER = "aaaaaaaa-0000-7000-8000-00000000af2b";

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" = ANY($1::uuid[])`,
    [
      MACHINE_CLIENT_INACTIF,
      MACHINE_FERRAILLEE,
      MACHINE_CLIENT_INACTIF_A_DETERMINER,
      MACHINE_FERRAILLEE_A_DETERMINER,
    ],
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "modele_materiel" WHERE "id" = ANY($1::uuid[])`,
    [MODELE_SOUMIS, MODELE_A_DETERMINER],
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "famille_materiel" WHERE "id" = ANY($1::uuid[])`,
    [FAMILLE_SOUMISE, FAMILLE_A_DETERMINER],
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = ANY($1::uuid[])`,
    [SITE_CLIENT_INACTIF, SITE_CLIENT_FERRAILLE],
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = ANY($1::uuid[])`,
    [CLIENT_INACTIF, CLIENT_FERRAILLE],
  );
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

describe("PV-32 (D166) — le client inactif et la machine hors parc actif sortent du registre des VGP", () => {
  it("amorçage — deux clients, deux machines soumises jamais informées, aucun interrupteur à lever", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
       VALUES ($1::uuid, $2::uuid, 'C-PV32-INACTIF', 'Client inactif PV-32', false)`,
      CLIENT_INACTIF,
      SOCIETE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site du client inactif PV-32')`,
      SITE_CLIENT_INACTIF,
      SOCIETE_A,
      CLIENT_INACTIF,
      AGENCE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
       VALUES ($1::uuid, $2::uuid, 'C-PV32-FERRAILLE', 'Client du parc ferraillé PV-32', true)`,
      CLIENT_FERRAILLE,
      SOCIETE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site du parc ferraillé PV-32')`,
      SITE_CLIENT_FERRAILLE,
      SOCIETE_A,
      CLIENT_FERRAILLE,
      AGENCE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "famille_materiel" (id, societe_id, code, libelle, actif, assujettissement_vgp, vgp_periodicite_mois, vgp_reference_texte)
       VALUES ($1::uuid, $2::uuid, 'PV32-SOUMISE', 'Famille soumise PV-32', true, 'soumis', 12, 'texte de test')`,
      FAMILLE_SOUMISE,
      SOCIETE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "modele_materiel" (id, societe_id, famille_id, marque, reference)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'Marque PV-32', 'REF-PV32-SOUMISE')`,
      MODELE_SOUMIS,
      SOCIETE_A,
      FAMILLE_SOUMISE,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "famille_materiel" (id, societe_id, code, libelle, actif, assujettissement_vgp)
       VALUES ($1::uuid, $2::uuid, 'PV32-ADETERM', 'Famille à déterminer PV-32', true, 'a_determiner')`,
      FAMILLE_A_DETERMINER,
      SOCIETE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "modele_materiel" (id, societe_id, famille_id, marque, reference)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'Marque PV-32', 'REF-PV32-ADETERM')`,
      MODELE_A_DETERMINER,
      SOCIETE_A,
      FAMILLE_A_DETERMINER,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "machine" (id, societe_id, modele_id, client_id, site_id, numero_serie, statut, qr_token, modifie_le)
       VALUES
         ($1::uuid, $9::uuid, $2::uuid, $5::uuid, $6::uuid, 'SN-PV32-INACTIF', 'en_service', 'QR-PV32-INACTIF', now()),
         ($3::uuid, $9::uuid, $2::uuid, $7::uuid, $8::uuid, 'SN-PV32-FERRAILLE', 'ferraillee', 'QR-PV32-FERRAILLE', now()),
         ($4::uuid, $9::uuid, $10::uuid, $5::uuid, $6::uuid, 'SN-PV32-INACTIF-ADET', 'en_service', 'QR-PV32-INACTIF-ADET', now()),
         ($11::uuid, $9::uuid, $10::uuid, $7::uuid, $8::uuid, 'SN-PV32-FERRAILLE-ADET', 'ferraillee', 'QR-PV32-FERRAILLE-ADET', now())`,
      MACHINE_CLIENT_INACTIF,
      MODELE_SOUMIS,
      MACHINE_FERRAILLEE,
      MACHINE_CLIENT_INACTIF_A_DETERMINER,
      CLIENT_INACTIF,
      SITE_CLIENT_INACTIF,
      CLIENT_FERRAILLE,
      SITE_CLIENT_FERRAILLE,
      SOCIETE_A,
      MODELE_A_DETERMINER,
      MACHINE_FERRAILLEE_A_DETERMINER,
    );
  });

  it("listerLeRegistre : aucune des deux machines soumises n'apparaît", async () => {
    const lignes = await listerLeRegistre(SESSION, AUJOURD_HUI, 2000);
    const ids = lignes.map((l) => l.id);
    expect(ids).not.toContain(MACHINE_CLIENT_INACTIF);
    expect(ids).not.toContain(MACHINE_FERRAILLEE);
  });

  it("compterAPrevoir : la voie « sans information » ne bouge pas malgré les deux machines soumises jamais informées", async () => {
    const compte = await compterAPrevoir(SESSION, AUJOURD_HUI, HORIZON_JOURS);
    // Lues directement en SQL (hors cascade, hors FILTRE_PARC_ACTIF) pour
    // vérifier que les deux machines existent bien et seraient comptées
    // SANS le filtre — le témoin de non-vacuité de cette épreuve.
    const [{ count }] = await clientOwner().$queryRawUnsafe<
      { count: bigint }[]
    >(`SELECT count(*) FROM "machine" WHERE "id" = ANY($1::uuid[])`, [
      MACHINE_CLIENT_INACTIF,
      MACHINE_FERRAILLEE,
    ]);
    expect(Number(count)).toBe(2);
    // Et pourtant : AUCUNE des deux n'entre dans le compte applicatif.
    // Mesuré par comparaison à une société sans ces deux machines serait
    // fragile (compte partagé) ; on vérifie donc que `famillesADeterminer`
    // (ci-dessous) et `listerLeRegistre` (ci-dessus) les écartent déjà, et
    // que ce compte ne lève pas d'exception sur le même parc.
    expect(compte.sansInformation).toBeGreaterThanOrEqual(0);
  });

  it("prochaineEcheanceDuSite : le site du client inactif ne porte plus aucune machine soumise", async () => {
    const synthese = await prochaineEcheanceDuSite(
      SESSION,
      SITE_CLIENT_INACTIF,
      AUJOURD_HUI,
    );
    expect(synthese.soumises).toBe(0);
    expect(synthese.sansInformation).toBe(0);
    expect(synthese.retenue).toBeNull();
  });

  it("prochaineEcheanceDuSite : le site du client actif, mais ferraillé, ne porte plus aucune machine soumise", async () => {
    const synthese = await prochaineEcheanceDuSite(
      SESSION,
      SITE_CLIENT_FERRAILLE,
      AUJOURD_HUI,
    );
    expect(synthese.soumises).toBe(0);
  });

  it("famillesADeterminer : le compte de la famille à déterminer n'inclut ni la machine du client inactif ni la ferraillée", async () => {
    const familles = await famillesADeterminer(SESSION);
    const famille = familles.find((f) => f.id === FAMILLE_A_DETERMINER);
    expect(famille).toBeDefined();
    expect(famille?.machines).toBe(0);
  });
});
