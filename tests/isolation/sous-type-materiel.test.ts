import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  avecPortail,
  clientOwner,
  fermerClients,
  sousSociete,
} from "./setup/db";
import {
  FAMILLE_A,
  FAMILLE_A_AILLEURS,
  FAMILLE_B,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  VAR_CLIENT,
  VAR_PERIMETRE,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * LE SOUS-TYPE STRUCTURÉ DE MATÉRIEL, ÉPROUVÉ SUR LA VRAIE TABLE (D238,
 * ticket 9K17A-MATERIEL-SOUS-TYPE).
 *
 * Quatre mesures, chacune nommée au ticket :
 *   1. le cloisonnement de base — société B ne lit ni n'écrit les sous-types
 *      de A ;
 *   2. le chaînage composite à trois colonnes — un sous-type d'une AUTRE
 *      famille, même dans la MÊME société, est refusé par la clé sur
 *      `modele_materiel` ;
 *   3. l'exclusivité sur `checklist_modele` — au plus un niveau de
 *      rattachement ;
 *   4. la forme « ascendance » (D93), éprouvée comme pour `famille_materiel` :
 *      un compte portail ne voit un sous-type que si un de ses MODÈLES porte
 *      une machine visible dans son périmètre, et le JUMEAU qui dégrade
 *      réellement la politique pour montrer que la mesure dépend d'elle.
 *
 * Fixtures DÉDIÉES, posées et retirées par ce fichier — `FAMILLE_A`,
 * `FAMILLE_A_AILLEURS`, `FAMILLE_B`, `CLIENT_A1` et `SITE_A1_S1` sont ceux du
 * harnais partagé (lecture seule, jamais modifiés ici).
 */

afterAll(fermerClients);

const SOUS_TYPE_A = "aaaaaaaa-0000-7000-8000-00000000e001";
const SOUS_TYPE_A_SANS_MODELE = "aaaaaaaa-0000-7000-8000-00000000e002";
const SOUS_TYPE_A_AILLEURS = "aaaaaaaa-0000-7000-8000-00000000e003";
const SOUS_TYPE_B = "bbbbbbbb-0000-7000-8000-00000000e004";

const MODELE_AVEC_SOUS_TYPE = "aaaaaaaa-0000-7000-8000-00000000e011";
const MACHINE_DU_MODELE_AVEC_SOUS_TYPE = "aaaaaaaa-0000-7000-8000-00000000e012";
const QR_SOUS_TYPE = "Q9SOUSTYPEXZ4MRJ5FHCV3PDGSA6K7";

const CHECKLIST_SOUS_TYPE_SEUL = "aaaaaaaa-0000-7000-8000-00000000e021";

beforeAll(async () => {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `INSERT INTO "sous_type_materiel" ("id", "societe_id", "famille_id", "code", "libelle")
     VALUES
       ($1::uuid, $2::uuid, $3::uuid, 'E-4COL', 'Pont 4 colonnes (épreuve)'),
       ($4::uuid, $2::uuid, $3::uuid, 'E-CISEAUX', 'Pont ciseaux (épreuve, sans modèle)'),
       ($5::uuid, $2::uuid, $6::uuid, 'E-AILLEURS', 'Sous-type d''une autre famille (épreuve)')
     ON CONFLICT ("id") DO NOTHING`,
    SOUS_TYPE_A,
    SOCIETE_A,
    FAMILLE_A,
    SOUS_TYPE_A_SANS_MODELE,
    SOUS_TYPE_A_AILLEURS,
    FAMILLE_A_AILLEURS,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "sous_type_materiel" ("id", "societe_id", "famille_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'E-VIS', 'Compresseur à vis (épreuve)')
     ON CONFLICT ("id") DO NOTHING`,
    SOUS_TYPE_B,
    SOCIETE_B,
    FAMILLE_B,
  );

  // LE MODÈLE ET SA MACHINE — le témoin de non-vacuité de l'ascendance :
  // sans eux, « le portail ne voit rien » serait vrai d'une base qui n'a
  // jamais eu l'occasion de le montrer.
  await owner.$executeRawUnsafe(
    `INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "sous_type_id", "marque", "reference")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Marque épreuve', 'REF-E-9K17A')
     ON CONFLICT ("id") DO NOTHING`,
    MODELE_AVEC_SOUS_TYPE,
    SOCIETE_A,
    FAMILLE_A,
    SOUS_TYPE_A,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "qr_token", "numero_serie", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, 'SN-E-9K17A', now())
     ON CONFLICT ("id") DO NOTHING`,
    MACHINE_DU_MODELE_AVEC_SOUS_TYPE,
    SOCIETE_A,
    MODELE_AVEC_SOUS_TYPE,
    CLIENT_A1,
    SITE_A1_S1,
    QR_SOUS_TYPE,
  );

  await owner.$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "sous_type_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, 'E-CHK-ST', 'Checklist sur sous-type (épreuve)', $3::uuid, now())
     ON CONFLICT ("id") DO NOTHING`,
    CHECKLIST_SOUS_TYPE_SEUL,
    SOCIETE_A,
    SOUS_TYPE_A,
  );
});

afterAll(async () => {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "checklist_modele" WHERE "id" = $1::uuid`,
    CHECKLIST_SOUS_TYPE_SEUL,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" = $1::uuid`,
    MACHINE_DU_MODELE_AVEC_SOUS_TYPE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "modele_materiel" WHERE "id" = $1::uuid`,
    MODELE_AVEC_SOUS_TYPE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "sous_type_materiel" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    SOUS_TYPE_A,
    SOUS_TYPE_A_SANS_MODELE,
    SOUS_TYPE_A_AILLEURS,
    SOUS_TYPE_B,
  );
});

describe("le CLOISONNEMENT de base — société B ne lit ni n'écrit les sous-types de A", () => {
  it("société B ne LIT aucun sous-type de A", async () => {
    const vus = await sousSociete(SOCIETE_B, (tx) =>
      tx.sousTypeMateriel.findMany({ select: { id: true } }),
    );
    expect(vus.map((v) => v.id)).not.toContain(SOUS_TYPE_A);
  });

  it("société B ne peut pas DÉSACTIVER un sous-type de A — zéro ligne touchée", async () => {
    const touchees = await sousSociete(SOCIETE_B, (tx) =>
      tx.sousTypeMateriel.updateMany({
        where: { id: SOUS_TYPE_A },
        data: { actif: false },
      }),
    );
    expect(touchees.count).toBe(0);
  });

  it("société A lit bien SON sous-type — le témoin de non-vacuité", async () => {
    const vus = await sousSociete(SOCIETE_A, (tx) =>
      tx.sousTypeMateriel.findMany({ select: { id: true } }),
    );
    expect(vus.map((v) => v.id)).toContain(SOUS_TYPE_A);
  });
});

describe("LE CHAÎNAGE À TROIS COLONNES — un sous-type d'une autre famille est refusé PAR LA CLÉ", () => {
  it("MÊME SOCIÉTÉ, autre famille : refusé", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "sous_type_id", "marque", "reference")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'Marque refusée', 'REF-REFUS-1')`,
        SOCIETE_A,
        FAMILLE_A,
        SOUS_TYPE_A_AILLEURS,
      ),
    ).rejects.toThrow();
  });

  it("AUTRE SOCIÉTÉ : refusé — le même chemin que « hors de la famille »", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "sous_type_id", "marque", "reference")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'Marque refusée', 'REF-REFUS-2')`,
        SOCIETE_A,
        FAMILLE_A,
        SOUS_TYPE_B,
      ),
    ).rejects.toThrow();
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA RAISON — la bonne famille passe", async () => {
    const id = "aaaaaaaa-0000-7000-8000-00000000e013";
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "sous_type_id", "marque", "reference")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Marque acceptée', 'REF-ACCEPTE')`,
      id,
      SOCIETE_A,
      FAMILLE_A,
      SOUS_TYPE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "modele_materiel" WHERE "id" = $1::uuid`,
      id,
    );
  });
});

describe("`checklist_modele` — AU PLUS UN niveau de rattachement (D238)", () => {
  it("LE JUMEAU : famille SEULE passe aussi — un seul niveau à la fois, pas forcément le sous-type", async () => {
    const id = "aaaaaaaa-0000-7000-8000-00000000e022";
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "famille_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, 'E-CHK-FAM', 'Checklist sur famille (épreuve)', $3::uuid, now())`,
      id,
      SOCIETE_A,
      FAMILLE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_modele" WHERE "id" = $1::uuid`,
      id,
    );
  });

  it("famille ET sous-type ENSEMBLE : refusé par la contrainte CHECK", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "famille_id", "sous_type_id", "modifie_le")
         VALUES (gen_random_uuid(), $1::uuid, 'E-CHK-DEUX', 'Refusée', $2::uuid, $3::uuid, now())`,
        SOCIETE_A,
        FAMILLE_A,
        SOUS_TYPE_A,
      ),
    ).rejects.toThrow();
  });
});

/** Sentinelle d'annulation : fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/**
 * Retire RÉELLEMENT la clause `app.client_id` de la politique « ascendance »
 * de `sous_type_materiel`, pose un contexte de PORTAIL, joue `travail`, puis
 * ANNULE — même patron que `sousPortailDegrade` de `document.test.ts` (L8-02).
 * Sous le PROPRIÉTAIRE : remplacer une politique est un droit de propriétaire,
 * et il est soumis à `FORCE ROW LEVEL SECURITY` — la lecture qui suit passe
 * donc bien sous la politique dégradée, pas à côté.
 */
async function sousAscendanceDegradee(
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DROP POLICY "cloisonnement_ascendance" ON "sous_type_materiel"`,
      );
      await tx.$executeRawUnsafe(
        `CREATE POLICY "cloisonnement_ascendance" ON "sous_type_materiel"
           USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
           WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_CLIENT,
        CLIENT_A1,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_PERIMETRE,
        "",
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) throw erreur;
  }
}

describe("la forme « ASCENDANCE » (D93) sur `sous_type_materiel`, éprouvée comme pour `famille_materiel`", () => {
  it("LE TÉMOIN PRÉALABLE — les deux drapeaux RLS sont posés", async () => {
    const [etat] = await clientOwner().$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" = 'sous_type_materiel' AND "relnamespace" = 'public'::regnamespace`,
    );
    expect(etat?.relrowsecurity).toBe(true);
    expect(etat?.relforcerowsecurity).toBe(true);
  });

  it("un compte portail voit le sous-type d'un modèle dont il possède une machine", async () => {
    const vus = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) => tx.sousTypeMateriel.findMany({ select: { id: true } }),
    );
    expect(vus.map((v) => v.id)).toContain(SOUS_TYPE_A);
  });

  it("le MÊME compte NE VOIT PAS un sous-type sans aucun modèle visible", async () => {
    const vus = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) => tx.sousTypeMateriel.findMany({ select: { id: true } }),
    );
    expect(vus.map((v) => v.id)).not.toContain(SOUS_TYPE_A_SANS_MODELE);
  });

  it("un utilisateur INTERNE (sans client posé) voit les deux — l'ascendance ne mord que le portail", async () => {
    const vus = await sousSociete(SOCIETE_A, (tx) =>
      tx.sousTypeMateriel.findMany({ select: { id: true } }),
    );
    const ids = vus.map((v) => v.id);
    expect(ids).toContain(SOUS_TYPE_A);
    expect(ids).toContain(SOUS_TYPE_A_SANS_MODELE);
  });

  it("LE JUMEAU : la politique dégradée en clause de société SEULE laisse fuir ce que l'ascendance refusait", async () => {
    // C'est le geste exact qu'un correcteur bien intentionné jouerait en
    // base — rendre à `sous_type_materiel` la forme que onze autres tables
    // portent. Sans ce témoin, les deux tests ci-dessus pourraient passer
    // pour une autre raison que la politique réelle.
    await sousAscendanceDegradee(async (tx) => {
      const vus = await tx.sousTypeMateriel.findMany({
        select: { id: true },
      });
      expect(vus.map((v) => v.id)).toContain(SOUS_TYPE_A_SANS_MODELE);
    });
  });
});
