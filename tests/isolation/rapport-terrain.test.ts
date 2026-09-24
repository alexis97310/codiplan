import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  deposerPhotoIntervention,
  photosDeLIntervention,
} from "@/lib/documents/depot";
import {
  definirPrestationsRealisees,
  derniereSignature,
  enregistrerRapportTexte,
  enregistrerSignature,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * LE RAPPORT DE TERRAIN, ÉPROUVÉ SUR LES VRAIES TABLES (ticket 17-BON-2).
 *
 * Trois formes à mesurer : « filiation » sur `intervention_prestation` et
 * `intervention_signature` (D103), « héritage » à trois cibles sur `document`
 * (D93, étendu par BON-2). Chaque table est fille d'`intervention`, de forme
 * « parc » — société, `app.client_id`, `app.perimetre_sites` s'y propagent
 * sans être réécrits ici.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Le compte portail restreint au site de INTERVENTION_A1 — et lui seul. */
const PORTAIL_SUR_S1 = {
  societeId: SOCIETE_A,
  clientId: CLIENT_A1,
  perimetreSites: [SITE_A1_S1],
};

const PRESTATION_A = uuidv7();
const PRESTATION_B = uuidv7();

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_A}', '${SOCIETE_A}', 'BON2-A', 'Prestation A', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_B}', '${SOCIETE_B}', 'BON2-B', 'Prestation B', now())`,
  );
});

afterEach(async () => {
  // Chaque scénario nettoie ses propres écritures ; ce filet ramène
  // `intervention` et les tables filles à leur état de fixture pour le
  // scénario suivant. Le STATUT n'est PAS touché ici : une intervention
  // CLÔTURÉE refuse toute modification hors annulation
  // (`intervention_cycle_de_vie`) — le scénario qui la clôture la restaure
  // lui-même, trigger désactivé le temps du geste.
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "commentaire_technicien" = NULL, "suite_a_donner" = NULL WHERE "id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_prestation" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_signature" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "document" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "id" IN ('${PRESTATION_A}', '${PRESTATION_B}')`,
  );
});

describe("le TÉMOIN PRÉALABLE — RLS en vigueur sur les deux tables neuves", () => {
  it.each(["intervention_prestation", "intervention_signature"])(
    "les deux drapeaux sont posés sur « %s »",
    async (table) => {
      const [etat] = await clientOwner().$queryRawUnsafe<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >(
        `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
          WHERE "relname" = $1 AND "relnamespace" = 'public'::regnamespace`,
        table,
      );
      expect(etat?.relrowsecurity).toBe(true);
      expect(etat?.relforcerowsecurity).toBe(true);
    },
  );
});

describe("le commentaire et la suite à donner", () => {
  it("s'écrivent sous la société qui voit l'intervention, jamais sous l'autre", async () => {
    const ecrite = await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: "Filtre changé",
        suite_a_donner: "Revoir dans 3 mois",
      },
      clientApp(),
    );
    expect(ecrite).not.toBeNull();

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{
        commentaire_technicien: string | null;
        suite_a_donner: string | null;
      }>
    >(
      `SELECT "commentaire_technicien", "suite_a_donner" FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
    );
    expect(ligne?.commentaire_technicien).toBe("Filtre changé");
    expect(ligne?.suite_a_donner).toBe("Revoir dans 3 mois");

    // LE CAS QUI DOIT ÉCHOUER : la société B ne voit pas l'intervention de A,
    // et l'écriture rend `null` plutôt qu'une erreur (D35, D50).
    const refus = await enregistrerRapportTexte(
      SESSION_B,
      INTERVENTION_A1,
      { commentaire_technicien: "détourné", suite_a_donner: null },
      clientApp(),
    );
    expect(refus).toBeNull();
    const [intacte] = await clientOwner().$queryRawUnsafe<
      Array<{ commentaire_technicien: string | null }>
    >(
      `SELECT "commentaire_technicien" FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
    );
    expect(intacte?.commentaire_technicien).toBe("Filtre changé");
  });
});

describe("les prestations réalisées — forme « filiation »", () => {
  it("se lisent et s'écrivent sous la société propriétaire, jamais sous l'autre", async () => {
    const ecrite = await definirPrestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      clientApp(),
    );
    expect(ecrite).not.toBeNull();

    const lues = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues?.map((l) => l.prestation_id)).toEqual([PRESTATION_A]);

    // Société B : l'intervention de A lui est invisible, `null` et non `[]`.
    const horsSociete = await prestationsRealisees(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(horsSociete).toBeNull();
  });

  it("un compte portail sur le BON site les voit ; sur un autre site, non", async () => {
    await definirPrestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      clientApp(),
    );
    await definirPrestationsRealisees(
      SESSION_A,
      INTERVENTION_A2,
      [PRESTATION_A],
      clientApp(),
    );

    const surSonSite = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.interventionPrestation.findMany({
        where: { intervention_id: INTERVENTION_A1 },
        select: { id: true },
      }),
    );
    expect(surSonSite).toHaveLength(1);

    // INTERVENTION_A2 est sur SITE_A1_S2 : hors du périmètre du compte.
    const surLAutreSite = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.interventionPrestation.findMany({
        where: { intervention_id: INTERVENTION_A2 },
        select: { id: true },
      }),
    );
    expect(surLAutreSite).toEqual([]);
  });

  it("l'ensemble DÉFINI remplace l'ancien : un retrait efface la ligne", async () => {
    await definirPrestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      clientApp(),
    );
    const ecrite = await definirPrestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      [],
      clientApp(),
    );
    expect(ecrite).not.toBeNull();
    const lues = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues).toEqual([]);
  });
});

describe("la signature — HISTORISÉE, jamais réécrite", () => {
  it("une re-signature AJOUTE une ligne ; la plus récente est celle qu'on montre", async () => {
    const image1 = "data:image/png;base64,AAAA";
    const image2 = "data:image/png;base64,BBBB";

    const premiere = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { image_base64: image1, signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(premiere).not.toBeNull();

    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { image_base64: image2, signataire_nom: "Jean Dupont" },
      clientApp(),
    );

    const derniere = await derniereSignature(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(derniere?.image_base64).toBe(image2);

    // LES DEUX LIGNES EXISTENT TOUJOURS EN BASE — l'ancienne n'a pas disparu.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_A1}'`,
    );
    expect(Number(n)).toBe(2);
  });

  it("s'ajoute même sur une intervention CLÔTURÉE — I5, le travail terrain n'est jamais perdu", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'cloturee', "temps_valide_min" = 60 WHERE "id" = '${INTERVENTION_A1}'`,
    );
    try {
      const ecrite = await enregistrerSignature(
        SESSION_A,
        INTERVENTION_A1,
        { image_base64: "data:image/png;base64,CCCC", signataire_nom: "Jean Dupont" },
        clientApp(),
      );
      expect(ecrite).not.toBeNull();
    } finally {
      // RESTAURATION : une intervention clôturée refuse toute modification
      // hors annulation (`intervention_cycle_de_vie`) — le trigger est
      // désactivé le temps de ramener la fixture à son état de départ, sur
      // CETTE connexion (propriétaire) et pour la durée de ces deux requêtes.
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "intervention" DISABLE TRIGGER "intervention_cycle_de_vie"`,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'planifiee', "temps_valide_min" = NULL WHERE "id" = '${INTERVENTION_A1}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "intervention" ENABLE TRIGGER "intervention_cycle_de_vie"`,
      );
    }
  });

  it("ne se lit ni ne s'écrit sous la société qui ne voit pas l'intervention", async () => {
    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { image_base64: "data:image/png;base64,AAAA", signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    const refusEcriture = await enregistrerSignature(
      SESSION_B,
      INTERVENTION_A1,
      { image_base64: "data:image/png;base64,DDDD", signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(refusEcriture).toBeNull();

    const refusLecture = await derniereSignature(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(refusLecture).toBeNull();
  });

  it("est IMMUABLE : ni UPDATE ni DELETE ne sont accordés au rôle applicatif", async () => {
    const pose = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { image_base64: "data:image/png;base64,AAAA", signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(pose).not.toBeNull();

    await expect(
      clientApp().$executeRawUnsafe(
        `UPDATE "intervention_signature" SET "image_base64" = 'x' WHERE "id" = '${pose?.id}'`,
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      clientApp().$executeRawUnsafe(
        `DELETE FROM "intervention_signature" WHERE "id" = '${pose?.id}'`,
      ),
    ).rejects.toThrow(/permission denied/i);

    // LA LIGNE EST TOUJOURS LÀ — ni l'un ni l'autre n'a mordu.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "id" = '${pose?.id}'`,
    );
    expect(Number(n)).toBe(1);
  });
});

describe("les photos — `document`, forme « héritage » à trois cibles", () => {
  it("se déposent et se lisent sous la société propriétaire, jamais sous l'autre", async () => {
    const depot = await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "client",
        libelle: "Avant intervention",
        nom_fichier: "avant.jpg",
        type_mime: "image/jpeg",
        objet: {
          objetCle: `test/${uuidv7()}.jpg`,
          empreinte: "a".repeat(64),
          tailleOctets: 1024,
        },
      },
      clientApp(),
    );
    expect(depot).not.toBeNull();

    const lues = await photosDeLIntervention(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues?.map((p) => p.id)).toEqual([depot.id]);

    const horsSociete = await photosDeLIntervention(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(horsSociete).toBeNull();
  });

  it("la classe `interne` ne franchit pas le portail, `client` si", async () => {
    await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "client",
        libelle: "Photo client",
        nom_fichier: "client.jpg",
        type_mime: "image/jpeg",
        objet: {
          objetCle: `test/${uuidv7()}.jpg`,
          empreinte: "b".repeat(64),
          tailleOctets: 1024,
        },
      },
      clientApp(),
    );
    await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "interne",
        libelle: "Photo interne",
        nom_fichier: "interne.jpg",
        type_mime: "image/jpeg",
        objet: {
          objetCle: `test/${uuidv7()}.jpg`,
          empreinte: "c".repeat(64),
          tailleOctets: 1024,
        },
      },
      clientApp(),
    );

    const auPortail = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.document.findMany({
        where: { intervention_id: INTERVENTION_A1 },
        select: { classe: true },
      }),
    );
    expect(auPortail.map((d) => d.classe)).toEqual(["client"]);

    const enInterne = await photosDeLIntervention(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(enInterne?.map((p) => p.classe).sort()).toEqual([
      "client",
      "interne",
    ]);
  });

  it("la contrainte de cible unique refuse une ligne à DEUX cibles, INTERVENTION comprise", async () => {
    const id = uuidv7();
    let motif = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "document" ("id", "societe_id", "intervention_id", "machine_id",
             "classe", "libelle", "nom_fichier", "type_mime", "taille_octets",
             "empreinte", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'client', 'x', 'x.jpg',
             'image/jpeg', 1, $5, 'iso/x.jpg', now())`,
          id,
          SOCIETE_A,
          INTERVENTION_A1,
          // Une machine réelle n'est pas nécessaire : la contrainte se lit
          // avant toute clé étrangère, et n'importe quel UUID suffit à
          // remplir la DEUXIÈME colonne.
          uuidv7(),
          "d".repeat(64),
        );
        throw new Error("ANNULATION");
      });
    } catch (erreur) {
      motif = String(erreur);
    }
    expect(motif).toContain("document_cible_unique");
  });
});
