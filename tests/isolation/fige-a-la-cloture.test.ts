import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { deposerPhotoIntervention } from "@/lib/documents/depot";
import { demarrerLeCompteur } from "@/lib/interventions/depot-compteur";
import { definirPrestationsRealiseesDepuisFile } from "@/lib/interventions/depot-rapport-terrain";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/** Une prestation JETABLE, propre à ce fichier — jamais celles de `rapport-terrain.test.ts`. */
const PRESTATION = "aaaaaaaa-0000-7000-8000-00000000d9e1";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION}', '${SOCIETE_A}', 'FIGE-9L14', 'Prestation 9L14', now())
     ON CONFLICT DO NOTHING`,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_prestation" WHERE "prestation_id" = '${PRESTATION}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "id" = '${PRESTATION}'`,
  );
});

/**
 * 9L14-FIGE-A-LA-CLOTURE (décision d'Alexis du 10/11/2026, précisant I5) —
 * signature, prestations, photos et machine refusent désormais toute
 * écriture dès qu'une intervention est `cloturee`/`annulee` ; une saisie
 * tardive est gardée à part, jamais appliquée ; et rouvrir annule la
 * validation du rapport.
 *
 * La signature est déjà éprouvée dans `rapport-terrain.test.ts` — ce
 * fichier couvre les trois gardes qui n'avaient pas encore leur test
 * jumeau : les prestations et les photos (applicatif + base), la machine
 * (base seule, aucun chemin applicatif ne l'écrit après la création), et la
 * réouverture.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];

/**
 * Une intervention JETABLE, clonée du décor d'`INTERVENTION_A1`, affectée
 * au technicien — NÉE dans le statut demandé (`INSERT` direct, D160 : le
 * déclencheur de cycle de vie ne garde que l'`UPDATE`).
 */
async function jetable(
  statut: "en_cours" | "terminee" | "cloturee" | "annulee",
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  // `terminee`, `cloturee` ET `annulee` portent un rapport déjà validé —
  // `terminee` pour que la réouverture (ci-dessous) ait quelque chose à
  // défaire ; `cloturee`/`annulee` parce qu'aucune clôture n'est possible
  // sans ce rapport (RG-INT-03), et une figée JETABLE sans lui mesurerait
  // un état qui n'existe jamais en pratique.
  const validee = statut !== "en_cours";
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","technicien_id","duree_estimee_min","modifie_le"${
         validee
           ? `,"temps_valide_min","rapport_valide_par","rapport_valide_le"`
           : ""
       }${statut === "cloturee" ? `,"cloturee_le"` : ""})
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', '${statut}', '${TECHNICIEN}', 60, now()${
              validee ? `, 60, '${TECHNICIEN}', now()` : ""
            }${statut === "cloturee" ? `, now()` : ""}
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "saisie_apres_cloture" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("les prestations réalisées, figées à la clôture", () => {
  it("un ajout tenté après la clôture est refusé et gardé à part, jamais appliqué", async () => {
    const id = await jetable("cloturee");

    const resultat = await definirPrestationsRealiseesDepuisFile(
      SESSION_TECH,
      id,
      [PRESTATION],
      [],
      clientApp(),
    );
    expect(resultat).toEqual({
      refuse: true,
      cle: "intervention.refus.cloturee_saisie_gardee",
    });

    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_prestation" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(n)).toBe(0);

    const gardee = await clientOwner().saisieApresCloture.findFirst({
      where: { intervention_id: id, type: "prestations" },
    });
    expect(gardee).not.toBeNull();
    expect(gardee?.auteur_id).toBe(TECHNICIEN);

    const notifiee = await clientOwner().notification.findFirst({
      where: { intervention_id: id, evenement: "saisie_apres_cloture" },
    });
    expect(notifiee).not.toBeNull();
  });

  it("ÉPREUVE — la base mord aussi : un INSERT brut sur une annulée est refusé", async () => {
    const id = await jetable("annulee");

    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_prestation" ("id","societe_id","intervention_id","prestation_id")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${PRESTATION}')`,
      ),
    ).rejects.toThrow(/figée à la clôture/);
  });

  it("passe sur une intervention vivante", async () => {
    const id = await jetable("en_cours");

    const resultat = await definirPrestationsRealiseesDepuisFile(
      SESSION_TECH,
      id,
      [PRESTATION],
      [],
      clientApp(),
    );
    expect(resultat).toEqual({ id });
  });
});

describe("les photos, figées à la clôture", () => {
  it("un dépôt tenté après la clôture est refusé et gardé à part, jamais appliqué", async () => {
    const id = await jetable("cloturee");

    const resultat = await deposerPhotoIntervention(
      SESSION_TECH,
      id,
      {
        classe: "client",
        libelle: "Photo tardive",
        nom_fichier: "tardive.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from([1, 2, 3]),
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      refuse: true,
      cle: "intervention.refus.cloturee_saisie_gardee",
    });

    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(n)).toBe(0);

    const gardee = await clientOwner().saisieApresCloture.findFirst({
      where: { intervention_id: id, type: "photo" },
    });
    expect(gardee).not.toBeNull();
  });

  it("ÉPREUVE — la base mord aussi : un INSERT brut sur une clôturée est refusé", async () => {
    const id = await jetable("cloturee");
    const empreinte = "e".repeat(64);

    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "document" ("id","societe_id","intervention_id","classe","libelle",
           "nom_fichier","type_mime","taille_octets","empreinte","objet_cle","modifie_le")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', 'client', 'Tardive',
           'tardive.jpg', 'image/jpeg', 3, '${empreinte}', 'bd:${empreinte}', now())`,
      ),
    ).rejects.toThrow(/figée à la clôture/);
  });
});

describe("la machine, figée à la clôture — base seule, aucun chemin applicatif ne l'écrit après la création", () => {
  it("ÉPREUVE — un INSERT brut sur une clôturée est refusé", async () => {
    const id = await jetable("cloturee");

    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
         SELECT '${uuidv7()}', "societe_id", '${id}', "id", now()
           FROM "machine" WHERE "societe_id" = '${SOCIETE_A}' LIMIT 1`,
      ),
    ).rejects.toThrow(/figée à la clôture/);
  });
});

describe("rouvrir annule la validation du rapport, dans la même transaction", () => {
  it("redémarrer le compteur sur une terminée déjà validée efface rapport_valide_par/le", async () => {
    const id = await jetable("terminee");

    const avant = await clientOwner().intervention.findUniqueOrThrow({
      where: { id },
      select: { rapport_valide_par: true },
    });
    expect(avant.rapport_valide_par).not.toBeNull();

    const resultat = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date(),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const apres = await clientOwner().intervention.findUniqueOrThrow({
      where: { id },
      select: {
        statut: true,
        rapport_valide_par: true,
        rapport_valide_le: true,
      },
    });
    expect(apres.statut).toBe("en_cours");
    expect(apres.rapport_valide_par).toBeNull();
    expect(apres.rapport_valide_le).toBeNull();
  });
});
