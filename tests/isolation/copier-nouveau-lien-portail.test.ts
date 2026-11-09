import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  copierNouveauLienDAccesPortail,
  inviterClientAuPortail,
  RefusInvitationClient,
  revoquerAccesPortailClient,
} from "@/lib/auth/lien-d-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9K14-PORTAIL-COPIER-NOUVEAU-LIEN (backlog B7) — « COPIER UN NOUVEAU LIEN »
 * POUR UN COMPTE DU PORTAIL, D223/D226 APPLIQUÉES COMME POUR UN COMPTE DE
 * BUREAU.
 *
 * Modèle : `tests/isolation/acces-bureau.test.ts`, section
 * `copierNouveauLienDAccesBureau` (D226, décision B/D223). Même garde
 * `administrer_utilisateurs` que `inviterClientAuPortail`/
 * `revoquerAccesPortailClient` (`tests/isolation/invitation-portail-client.test.ts`).
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADV_A = { ...ADMIN_A, role: Role.adv };

const PREFIXE = "9k14lien-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_client" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
});

afterAll(fermerClients);

/** Invite, puis lit l'identifiant de l'identité posée — même recette que l'épreuve de l'invitation. */
async function inviterEtLire(clientId: string): Promise<string> {
  const email = courriel();
  const resultat = await inviterClientAuPortail(
    ADMIN_A,
    clientId,
    email,
    clientApp(),
  );
  expect(resultat.accepte).toBe(true);
  const [ligne] = await clientOwner().$queryRawUnsafe<
    { utilisateur_id: string }[]
  >(`SELECT id::text AS utilisateur_id FROM "utilisateur" WHERE email = $1`, email);
  if (ligne === undefined) throw new Error("fixture non créée");
  return ligne.utilisateur_id;
}

describe("copierNouveauLienDAccesPortail — l'accepté, et la trace", () => {
  it("un compte ACTIF de CE client copie un nouveau lien, trace « lien copié » (D223/D226)", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);

    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_A1,
      utilisateurId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.url.length).toBeGreaterThan(0);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string; detail: string }[]
    >(
      `SELECT evenement::text, detail
         FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    expect(trace?.evenement).toBe("reemission_premier_acces");
    expect(trace?.detail).toContain("lien copié par l'administrateur");
    expect(trace?.detail).toContain("compte du portail client");
    // L'AUTEUR EST L'ADMINISTRATEUR, jamais le compte client (D162) — même
    // vérification que `tests/isolation/invitation-portail-client.test.ts`.
    const [auteur] = await clientOwner().$queryRawUnsafe<
      { utilisateur_id: string }[]
    >(
      `SELECT utilisateur_id::text FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    expect(auteur?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
  });

  it("D199 — la DIRECTION copie avec le même succès que l'administrateur", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);
    const DIRECTION_A = { ...ADMIN_A, role: Role.direction };
    const resultat = await copierNouveauLienDAccesPortail(
      DIRECTION_A,
      CLIENT_A1,
      utilisateurId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("copierNouveauLienDAccesPortail — « introuvable », sans rien dire de plus", () => {
  it("un compte rattaché à un AUTRE client de la MÊME société est introuvable", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);

    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_A2,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("un client ET un compte d'une AUTRE société sont introuvables, sans rien apprendre (I1)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Client de B", email },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
      },
    });

    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_B1,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("un identifiant de compte inconnu est introuvable", async () => {
    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_A1,
      uuidv7(),
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });
});

describe("copierNouveauLienDAccesPortail — « revoque », un accès révoqué se ré-invite", () => {
  it("un compte RÉVOQUÉ de ce client est refusé, sans jeton émis", async () => {
    const email = courriel();
    const invitation = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(invitation.accepte).toBe(true);
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { id: string; utilisateur_id: string }[]
    >(
      `SELECT uc.id::text, uc.utilisateur_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    if (ligne === undefined) throw new Error("fixture non créée");

    const revocation = await revoquerAccesPortailClient(
      ADMIN_A,
      ligne.id,
      clientApp(),
    );
    expect(revocation).toEqual({ accepte: true });

    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_A1,
      ligne.utilisateur_id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "revoque" });
  });
});

describe("copierNouveauLienDAccesPortail — D226, exclusivité", () => {
  it("un compte EXCLUSIF à la société active reste permis", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);
    const resultat = await copierNouveauLienDAccesPortail(
      ADMIN_A,
      CLIENT_A1,
      utilisateurId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("refuse « autre_societe » pour une identité aussi rattachée à une AUTRE société, chez A ET chez B", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);

    // LE RATTACHEMENT À LA SOCIÉTÉ B, QUI REND L'IDENTITÉ NON EXCLUSIVE —
    // même recette que `tests/isolation/acces-bureau.test.ts` (D226).
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      utilisateurId,
      SOCIETE_B,
      Role.adv,
    );
    try {
      const chezA = await copierNouveauLienDAccesPortail(
        ADMIN_A,
        CLIENT_A1,
        utilisateurId,
        clientApp(),
      );
      expect(chezA).toEqual({ accepte: false, motif: "autre_societe" });
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" = $1::uuid AND "societe_id" = $2::uuid`,
        utilisateurId,
        SOCIETE_B,
      );
    }
  });
});

describe("copierNouveauLienDAccesPortail — requête forgée (D230)", () => {
  it("un rôle qui n'administre pas (ADV) est refusé AVANT toute écriture", async () => {
    const utilisateurId = await inviterEtLire(CLIENT_A1);

    await expect(
      copierNouveauLienDAccesPortail(
        ADV_A,
        CLIENT_A1,
        utilisateurId,
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusInvitationClient);

    // SEULE la trace de l'invitation existe (« ouverture_identite ») — la
    // copie du NOUVEAU lien, elle, trace « reemission_premier_acces », et
    // cette ligne n'existe pas : rien n'a été écrit par le rôle refusé.
    const traces = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1 AND evenement = 'reemission_premier_acces'`,
      utilisateurId,
    );
    expect(traces).toHaveLength(0);
  });
});
