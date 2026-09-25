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
 * AVERTISSEMENTS-2 (25/09/2026) — LA RÉAFFECTATION PRÉVIENT AUSSI L'ANCIEN
 * TECHNICIEN.
 *
 * Point ouvert de AVERTISSEMENTS-1 : `avertirApresPlanification` connaissait
 * déjà `avant.technicienId`, mais ne s'en servait que pour DÉCIDER (le badge
 * repart à zéro), jamais pour PRÉVENIR. Ce fichier éprouve la troisième
 * branche du compte-rendu — `ancienTechnicien` — à sa propre scène, préfixée
 * et nettoyée, sans toucher à `tests/isolation/avertissements-planification.test.ts`.
 *
 * `avertirApresPlanification` est appelée DIRECTEMENT, comme
 * `marquerVuParTechnicien` l'est dans le fichier voisin : c'est le module qui
 * est éprouvé, pas la chaîne complète de `affecterTechnicien` (habilitations,
 * absences, RG-PLA-06) — déjà couverte ailleurs.
 *
 * Le transport de courriel est un double local — même principe que
 * `tests/unit/courriel/envoi.test.ts` (`vi.stubGlobal("fetch", …)`) — jamais
 * un vrai appel réseau.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-77-avertissements-2",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

type CorpsResend = { to: readonly string[]; subject: string; text: string };

function coupleFetchDeTest(): {
  envois: CorpsResend[];
} {
  const envois: CorpsResend[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body ?? "{}")) as CorpsResend;
      envois.push(corps);
      return new Response(
        JSON.stringify({ id: `test-77-avertissements-2-${envois.length}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { envois };
}

afterAll(fermerClients);

describe("UNE RÉAFFECTATION PRÉVIENT L'ANCIEN TECHNICIEN, PAS SEULEMENT LE NOUVEAU", () => {
  const ANCIEN_TECHNICIEN = uuidv7();
  const NOUVEAU_TECHNICIEN = uuidv7();
  const EMAIL_ANCIEN = "ancien-77av2@example.test";
  const EMAIL_NOUVEAU = "nouveau-77av2@example.test";
  let interventionId = "";

  const CONTEXTE = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
    societeId: SOCIETE_A,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  const DATE_PLANIFIEE_SQL = "2026-10-05";
  const DATE_PLANIFIEE = new Date(`${DATE_PLANIFIEE_SQL}T00:00:00.000Z`);
  const AUTRE_DATE_PLANIFIEE_SQL = "2026-10-12";

  beforeEach(async () => {
    interventionId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" ("id", "nom", "email", "actif", "modifie_le")
       VALUES ($1::uuid, 'AV2 — Ancien technicien', $2, true, now()),
              ($3::uuid, 'AV2 — Nouveau technicien', $4, true, now())`,
      ANCIEN_TECHNICIEN,
      EMAIL_ANCIEN,
      NOUVEAU_TECHNICIEN,
      EMAIL_NOUVEAU,
    );
    // La politique RLS de « utilisateur » (L1-02c) ne rend une identité
    // visible que rattachée à une société — sans ce rattachement,
    // `envoyerAuTechnicien`/`envoyerAlAncienTechnicien` ne trouveraient
    // personne et rendraient « sans_destinataire ».
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'technicien'::"Role"),
              ($4::uuid, $5::uuid, $3::uuid, 'technicien'::"Role")`,
      uuidv7(),
      ANCIEN_TECHNICIEN,
      SOCIETE_A,
      uuidv7(),
      NOUVEAU_TECHNICIEN,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "type", "statut", "technicien_id", "date_planifiee",
         "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', $6::uuid, $7::date, 60, now())`,
      interventionId,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      NOUVEAU_TECHNICIEN,
      DATE_PLANIFIEE_SQL,
    );
  });

  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN ($1::uuid, $2::uuid)`,
      ANCIEN_TECHNICIEN,
      NOUVEAU_TECHNICIEN,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE "id" IN ($1::uuid, $2::uuid)`,
      ANCIEN_TECHNICIEN,
      NOUVEAU_TECHNICIEN,
    );
    vi.unstubAllGlobals();
  });

  it("réaffecter A → B envoie deux courriels techniciens : B « planifiée », A « retirée »", async () => {
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "planifiee",
      technicienId: ANCIEN_TECHNICIEN,
      datePlanifiee: DATE_PLANIFIEE,
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
    expect(compteRendu?.client).toBeNull();
    expect(compteRendu?.technicien).toEqual({ type: "parti" });
    expect(compteRendu?.ancienTechnicien).toEqual({ type: "parti" });

    const cles = clesAvertissementCourriel(compteRendu!);
    expect(cles).toEqual([
      "intervention.avertissement.courriel_technicien_parti",
      "intervention.avertissement.courriel_ancien_technicien_parti",
    ]);

    expect(envois).toHaveLength(2);
    const versNouveau = envois.find((e) => e.to.includes(EMAIL_NOUVEAU));
    const versAncien = envois.find((e) => e.to.includes(EMAIL_ANCIEN));
    expect(versNouveau).toBeDefined();
    expect(versAncien).toBeDefined();

    // Le courriel de l'ANCIEN technicien ne porte ni lien terrain, ni
    // adresse du nouveau — cette intervention n'est plus la sienne.
    expect(versAncien!.subject).toBe(
      "CODIPLAN — Intervention retirée de votre planning",
    );
    expect(versAncien!.text).not.toContain("/terrain/");
    expect(versAncien!.text).not.toContain(EMAIL_NOUVEAU);

    expect(versNouveau!.text).toContain(`/terrain/${interventionId}`);
  });

  it("première planification (aucun ancien technicien) → aucun courriel « retirée »", async () => {
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
    expect(compteRendu?.ancienTechnicien ?? null).toBeNull();
    expect(clesAvertissementCourriel(compteRendu!)).not.toContain(
      "intervention.avertissement.courriel_ancien_technicien_parti",
    );
    expect(envois.some((e) => e.to.includes(EMAIL_ANCIEN))).toBe(false);
  });

  it("déplacement sans changement de technicien → aucun courriel « retirée »", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "date_planifiee" = $2::date WHERE "id" = $1::uuid`,
      interventionId,
      AUTRE_DATE_PLANIFIEE_SQL,
    );
    const { envois } = coupleFetchDeTest();
    const avant: EtatAvantPlanification = {
      statut: "planifiee",
      technicienId: NOUVEAU_TECHNICIEN,
      datePlanifiee: DATE_PLANIFIEE,
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
    expect(compteRendu?.ancienTechnicien ?? null).toBeNull();
    expect(clesAvertissementCourriel(compteRendu!)).not.toContain(
      "intervention.avertissement.courriel_ancien_technicien_parti",
    );
    expect(envois.some((e) => e.to.includes(EMAIL_ANCIEN))).toBe(false);
  });
});
