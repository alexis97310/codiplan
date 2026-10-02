import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Role } from "@/lib/auth/roles";
import { avertirApresTransmissionGroupee } from "@/lib/avertissements/planification";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D141 (9CP-PG-G14B-TRANSMETTRE-GROUPE, 02/10/2026) — LE RÉCAPITULATIF D'UNE
 * TRANSMISSION GROUPÉE : UN COURRIEL PAR TECHNICIEN, ET UN ENVOI EN ÉCHEC
 * N'EN ANNULE PAS UN AUTRE.
 *
 * `tests/unit/avertissements/composition.test.ts` éprouve la composition PURE
 * (regroupement, tri, sujet, corps) ; ce fichier éprouve `avertirApresTransmissionGroupee`
 * elle-même — relecture sous le contexte cloisonné, puis UN envoi par groupe.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-d141-groupe",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

type CorpsResend = { to: readonly string[]; subject: string; text: string };

function coupleFetchDeTest(
  echoue: (destinataire: string) => boolean = () => false,
): { envois: CorpsResend[] } {
  const envois: CorpsResend[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body ?? "{}")) as CorpsResend;
      envois.push(corps);
      if (corps.to.some((destinataire) => echoue(destinataire))) {
        return new Response(JSON.stringify({ message: "refusé" }), {
          status: 422,
        });
      }
      return new Response(
        JSON.stringify({ id: `test-d141-groupe-${envois.length}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { envois };
}

afterAll(fermerClients);

const TECHNICIEN_1 = UTILISATEUR_PAR_ROLE[Role.technicien];
const TECHNICIEN_2 = UTILISATEUR_PAR_ROLE[Role.adv];

const CONTEXTE = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const JOUR = "2026-11-23";

let interventionT1A = "";
let interventionT1B = "";
let interventionT2 = "";

async function creerLigne(
  id: string,
  technicienId: string,
  heure: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'affectee', $6::uuid, $7::date, $8::timestamptz, 60, now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    technicienId,
    JOUR,
    `${JOUR}T${heure}:00.000Z`,
  );
}

async function email(utilisateurId: string): Promise<string> {
  const utilisateur = await clientOwner().utilisateur.findFirstOrThrow({
    where: { id: utilisateurId },
    select: { email: true },
  });
  return utilisateur.email;
}

beforeEach(async () => {
  interventionT1A = uuidv7();
  interventionT1B = uuidv7();
  interventionT2 = uuidv7();
  await creerLigne(interventionT1A, TECHNICIEN_1, "09:00");
  await creerLigne(interventionT1B, TECHNICIEN_1, "08:00");
  await creerLigne(interventionT2, TECHNICIEN_2, "10:00");
});

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid)`,
    interventionT1A,
    interventionT1B,
    interventionT2,
  );
  vi.unstubAllGlobals();
});

describe("avertirApresTransmissionGroupee", () => {
  it("UN courriel par technicien, jamais un par intervention", async () => {
    const { envois } = coupleFetchDeTest();

    const comptesRendus = await avertirApresTransmissionGroupee(
      CONTEXTE,
      [interventionT1A, interventionT1B, interventionT2],
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(comptesRendus).toHaveLength(2);
    expect(envois).toHaveLength(2);
    const versT1 = comptesRendus.find((c) => c.technicienId === TECHNICIEN_1);
    expect(versT1).toEqual({
      technicienId: TECHNICIEN_1,
      nombre: 2,
      envoi: { type: "parti" },
    });
    const emailT1 = await email(TECHNICIEN_1);
    const envoiT1 = envois.find((e) => e.to.includes(emailT1));
    expect(envoiT1?.subject).toBe("CODIPLAN — Interventions transmises (2)");
  });

  it("un envoi en échec n'annule pas la transmission ni l'autre envoi", async () => {
    const emailT2 = await email(TECHNICIEN_2);
    const { envois } = coupleFetchDeTest(
      (destinataire) => destinataire === emailT2,
    );

    const comptesRendus = await avertirApresTransmissionGroupee(
      CONTEXTE,
      [interventionT1A, interventionT1B, interventionT2],
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(envois).toHaveLength(2);
    const versT1 = comptesRendus.find((c) => c.technicienId === TECHNICIEN_1);
    const versT2 = comptesRendus.find((c) => c.technicienId === TECHNICIEN_2);
    expect(versT1?.envoi).toEqual({ type: "parti" });
    expect(versT2?.envoi.type).toBe("non_parti");

    // Les lignes restent « affectee » — seul le COURRIEL a échoué, la
    // transmission elle-même (déjà faite par `transmettreEnGroupe`, en
    // amont) n'est ni rejouée ni défaite par cette fonction.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string }>
    >(
      `SELECT "statut" FROM "intervention" WHERE "id" = $1::uuid`,
      interventionT2,
    );
    expect(ligne.statut).toBe("affectee");
  });

  it("rend un tableau vide sans appeler le réseau, sur une liste vide", async () => {
    const { envois } = coupleFetchDeTest();
    const comptesRendus = await avertirApresTransmissionGroupee(
      CONTEXTE,
      [],
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );
    expect(comptesRendus).toEqual([]);
    expect(envois).toHaveLength(0);
  });
});
