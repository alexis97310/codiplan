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
import {
  avertirApresPlanification,
  clesAvertissementCourriel,
} from "@/lib/avertissements/planification";
import { uuidv7 } from "@/lib/db/uuid";
import type { EtatAvantPlanification } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D141 (9CO-PG-G14A-TRANSMETTRE, 02/10/2026) — LE TECHNICIEN N'EST PRÉVENU
 * QU'UNE FOIS L'INTERVENTION « AFFECTÉE », JAMAIS SUR UNE SIMPLE « PLANIFIÉE ».
 *
 * `tests/isolation/avertissements-reaffectation.test.ts` éprouve déjà le
 * changement de technicien (sur une Affectée, puis sur une Planifiée) ; ce
 * fichier éprouve les AUTRES transitions de la même matrice — planifier,
 * transmettre, déplacer une Affectée, déplacer une Planifiée, remettre dans
 * la file —, chacune à sa propre ligne, jamais `SCENE.*`.
 *
 * `avertirApresPlanification` est appelée DIRECTEMENT (même choix que le
 * fichier voisin) : c'est la fonction de décision qui est éprouvée, pas la
 * chaîne complète des routes, déjà couverte par
 * `tests/e2e/pg-g14a-transmettre.spec.ts`.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-d141-transmission",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

type CorpsResend = { to: readonly string[]; subject: string; text: string };

function coupleFetchDeTest(): { envois: CorpsResend[] } {
  const envois: CorpsResend[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body ?? "{}")) as CorpsResend;
      envois.push(corps);
      return new Response(
        JSON.stringify({ id: `test-d141-${envois.length}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { envois };
}

afterAll(fermerClients);

describe("QUI REÇOIT QUOI, TRANSITION PAR TRANSITION (D141)", () => {
  const TECHNICIEN = uuidv7();
  const EMAIL_TECHNICIEN = "technicien-d141@example.test";
  let interventionId = "";

  const CONTEXTE = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
    societeId: SOCIETE_A,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  const DATE_SQL = "2026-10-19";
  const DATE = new Date(`${DATE_SQL}T00:00:00.000Z`);
  const AUTRE_DATE_SQL = "2026-10-26";

  beforeEach(async () => {
    interventionId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" ("id", "nom", "email", "actif", "modifie_le")
       VALUES ($1::uuid, 'D141 — Technicien', $2, true, now())`,
      TECHNICIEN,
      EMAIL_TECHNICIEN,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'technicien'::"Role")`,
      uuidv7(),
      TECHNICIEN,
      SOCIETE_A,
    );
  });

  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" = $1::uuid`,
      TECHNICIEN,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE "id" = $1::uuid`,
      TECHNICIEN,
    );
    vi.unstubAllGlobals();
  });

  async function creerLigne(
    statut: "a_planifier" | "planifiee" | "affectee",
    datePlanifiee: string | null,
  ): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "type", "statut", "technicien_id", "date_planifiee",
         "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               $6::"StatutIntervention", $7::uuid, $8::date, 60, now())`,
      interventionId,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      statut,
      statut === "a_planifier" ? null : TECHNICIEN,
      datePlanifiee,
    );
  }

  it("PLANIFIER (a_planifier → planifiee) : le technicien n'est PAS prévenu, pas encore transmise", async () => {
    await creerLigne("planifiee", DATE_SQL);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "a_planifier",
      technicienId: null,
      datePlanifiee: null,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu).not.toBeNull();
    expect(compteRendu?.technicien).toBeNull();
    expect(envois.some((e) => e.to.includes(EMAIL_TECHNICIEN))).toBe(false);
  });

  it("TRANSMETTRE (planifiee → affectee) : le technicien est prévenu, raison « planification » (D141)", async () => {
    await creerLigne("affectee", DATE_SQL);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "planifiee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu?.technicien).toEqual({ type: "parti" });
    expect(clesAvertissementCourriel(compteRendu!)).toContain(
      "intervention.avertissement.courriel_technicien_parti",
    );
    const versTechnicien = envois.find((e) => e.to.includes(EMAIL_TECHNICIEN));
    expect(versTechnicien).toBeDefined();
    expect(versTechnicien!.subject).toBe(
      "CODIPLAN — Nouvelle intervention affectée",
    );
  });

  it("DÉPLACER UNE AFFECTÉE : le technicien est prévenu aussitôt, raison « déplacement »", async () => {
    await creerLigne("affectee", AUTRE_DATE_SQL);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "affectee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu?.technicien).toEqual({ type: "parti" });
    const versTechnicien = envois.find((e) => e.to.includes(EMAIL_TECHNICIEN));
    expect(versTechnicien).toBeDefined();
    expect(versTechnicien!.subject).toBe("CODIPLAN — Intervention déplacée");
  });

  it("DÉPLACER UNE PLANIFIÉE : le technicien n'est PAS prévenu, invisible du terrain", async () => {
    await creerLigne("planifiee", AUTRE_DATE_SQL);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "planifiee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu?.technicien).toBeNull();
    expect(envois.some((e) => e.to.includes(EMAIL_TECHNICIEN))).toBe(false);
  });

  it("PLANIFIÉE REMISE DANS LA FILE : rien à annoncer, le technicien n'a jamais été prévenu", async () => {
    // Décision d'Alexis du 02/10/2026, point 6 (D141, 9CT-RETOUCHES-5) :
    // seule une AFFECTÉE remise dans la file prévient — une PLANIFIÉE, elle,
    // reste silencieuse pour le technicien comme avant, puisqu'il n'a jamais
    // été prévenu d'une ligne encore invisible du terrain.
    await creerLigne("a_planifier", null);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "planifiee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu).toBeNull();
    expect(envois).toHaveLength(0);
  });

  it("AFFECTÉE REMISE DANS LA FILE : UN envoi « retirée » au technicien d'avant (décision d'Alexis du 02/10/2026, point 6, D141)", async () => {
    // Chemin TIROIR (components/planning/tiroir.tsx) — le technicien est
    // EFFACÉ en même temps que la date : `creerLigne("a_planifier", null)`
    // pose `technicien_id` à `null` en base, comme ce chemin le fait
    // réellement. Seul `avant.technicienId` dit qui prévenir.
    await creerLigne("a_planifier", null);
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "affectee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu?.client).toBeNull();
    expect(compteRendu?.technicien).toBeNull();
    expect(compteRendu?.ancienTechnicien).toEqual({ type: "parti" });
    expect(clesAvertissementCourriel(compteRendu!)).toEqual([
      "intervention.avertissement.courriel_ancien_technicien_parti",
    ]);
    expect(envois).toHaveLength(1);
    const versTechnicien = envois.find((e) => e.to.includes(EMAIL_TECHNICIEN));
    expect(versTechnicien).toBeDefined();
    expect(versTechnicien!.subject).toBe(
      "CODIPLAN — Intervention retirée de votre planning",
    );
  });

  it("AFFECTÉE REMISE DANS LA FILE, chemin FICHE : le technicien reste écrit en base, mais c'est `avant.technicienId` qui prévient", async () => {
    // Chemin FICHE (app/(back-office)/interventions/[id]/page.tsx) — le
    // technicien est GARDÉ en base, contrairement au tiroir ci-dessus : ce
    // test prouve que la même préséance s'applique quand même.
    await creerLigne("a_planifier", null);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "technicien_id" = $2::uuid WHERE "id" = $1::uuid`,
      interventionId,
      TECHNICIEN,
    );
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "affectee",
      technicienId: TECHNICIEN,
      datePlanifiee: DATE,
      creneauDebut: null,
    };

    const compteRendu = await avertirApresPlanification(
      CONTEXTE,
      interventionId,
      avant,
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    expect(compteRendu?.ancienTechnicien).toEqual({ type: "parti" });
    expect(envois).toHaveLength(1);
  });
});
