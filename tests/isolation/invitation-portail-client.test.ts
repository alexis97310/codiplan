import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  comptesDuPortailDuClient,
  inviterClientAuPortail,
  RefusInvitationClient,
  revoquerAccesPortailClient,
} from "@/lib/auth/lien-d-acces";
import { Role } from "@/lib/auth/roles";
import { rattachementsDuCompte } from "@/lib/portail/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D96, D230 (9J02A-REPRISE-9J02) — INVITER UN CLIENT AU PORTAIL, ET RÉVOQUER
 * SON ACCÈS.
 *
 * ## Pourquoi `administrer_utilisateurs`, et pas `gerer_client_site`
 *
 * D230 : inviter un client ouvre souvent une identité, et la base ne
 * l'accepte que de `app_peut_administrer_identites()` — admin_societe et
 * direction (D37/D199), jamais l'ADV malgré D130. Ces épreuves rejouent donc,
 * pour `inviterClientAuPortail`/`revoquerAccesPortailClient`, le même refus
 * ADV que `tests/isolation/acces-technicien.test.ts` tient déjà pour le
 * chemin technicien — et c'est cette identité de garde qui vaut pour une
 * REQUÊTE FORGÉE : les routes d'API n'ajoutent rien à `exigerCapacite` puis
 * cet appel direct.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DIRECTION_A = { ...ADMIN_A, role: Role.direction };
const ADV_A = { ...ADMIN_A, role: Role.adv };

const PREFIXE = "9j02acces-";

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
    `DELETE FROM "utilisateur_client_site" WHERE "utilisateur_client_id" IN (
       SELECT "id" FROM "utilisateur_client" WHERE "utilisateur_id" IN (
         SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1))`,
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

describe("inviterClientAuPortail — l'invitation", () => {
  it("ouvre l'identité, accorde le rattachement ACTIF, émet un jeton, trace « ouverture_identite »", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.dejaActif).toBe(false);
    expect(resultat.url).not.toBeNull();
    expect(resultat.url?.length).toBeGreaterThan(0);

    const [rattachement] = await clientOwner().$queryRawUnsafe<
      { actif: boolean; societe_id: string }[]
    >(
      `SELECT uc.actif, uc.societe_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 AND uc.client_id = $2::uuid`,
      email,
      CLIENT_A1,
    );
    expect(rattachement).toBeDefined();
    expect(rattachement?.actif).toBe(true);
    expect(rattachement?.societe_id).toBe(SOCIETE_A);

    // JAMAIS DE LIGNE `utilisateur_societe` (D10, D96).
    const [habilitation] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_societe" us
         JOIN "utilisateur" u ON u.id = us.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(habilitation).toBeUndefined();

    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT c.mot_de_passe FROM "compte" c
         JOIN "utilisateur" u ON u.id = c.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(compte?.mot_de_passe).toBeNull();

    const [trace] = await clientOwner().$queryRawUnsafe<
      {
        evenement: string;
        utilisateur_id: string;
        societe_id_cible: string;
        role: string;
      }[]
    >(
      `SELECT ja.evenement::text, ja.utilisateur_id::text, ja.societe_id_cible::text, ja.role::text
         FROM "journal_acces" ja
         JOIN "utilisateur" u ON u.id = (
           SELECT uc.utilisateur_id FROM "utilisateur_client" uc
            WHERE uc.client_id = $2::uuid AND uc.utilisateur_id IN (
              SELECT id FROM "utilisateur" WHERE email = $1))
        WHERE ja.evenement = 'ouverture_identite'
        ORDER BY ja.horodatage DESC LIMIT 1`,
      email,
      CLIENT_A1,
    );
    expect(trace).toBeDefined();
    // L'AUTEUR EST L'ADMINISTRATEUR, jamais le compte client (D162).
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.societe_id_cible).toBe(SOCIETE_A);
    expect(trace?.role).toBe(Role.admin_societe);
  });

  it("D199 — la DIRECTION invite avec le même succès que l'administrateur", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      DIRECTION_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("un client introuvable (autre société) reçoit un refus NOMMÉ", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_B1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "client_introuvable" });

    const [identite] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identite).toBeUndefined();
  });

  it("un rôle qui n'administre pas (ADV) est refusé AVANT toute écriture — requête forgée (D230)", async () => {
    const email = courriel();
    await expect(
      inviterClientAuPortail(ADV_A, CLIENT_A1, email, clientApp()),
    ).rejects.toBeInstanceOf(RefusInvitationClient);

    const [identite] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identite).toBeUndefined();
  });

  it("une adresse qui est DÉJÀ un compte interne de la société active est refusée NOMMÉMENT (9J21)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Compte interne", email },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: SOCIETE_A,
        role: Role.adv,
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "compte_interne" });

    // AUCUN RATTACHEMENT CLIENT N'A ÉTÉ POSÉ sur ce compte interne.
    const rattachement = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(rattachement).toHaveLength(0);
  });

  it("une seconde invitation POUR LE MÊME client RÉACTIVE la ligne, jamais ne la duplique", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const revocation = await clientOwner().$executeRawUnsafe(
      `UPDATE "utilisateur_client" uc SET actif = false
         FROM "utilisateur" u
        WHERE u.id = uc.utilisateur_id AND u.email = $1`,
      email,
    );
    expect(revocation).toBe(1);

    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(second.accepte).toBe(true);

    const lignes = await clientOwner().$queryRawUnsafe<{ actif: boolean }[]>(
      `SELECT uc.actif FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 AND uc.client_id = $2::uuid`,
      email,
      CLIENT_A1,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.actif).toBe(true);
  });

  it("une IDENTITÉ DÉJÀ SERVIE, invitée à un SECOND client, n'a aucun jeton à transmettre (dejaActif)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test'
         FROM "utilisateur" u
        WHERE u.id = compte.utilisateur_id AND u.email = $1`,
      email,
    );

    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A2,
      email,
      clientApp(),
    );
    expect(second).toEqual({ accepte: true, url: null, dejaActif: true });

    // AUCUNE SECONDE IDENTITÉ N'A ÉTÉ OUVERTE — une seule ligne `utilisateur`.
    const identites = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identites).toHaveLength(1);

    const rattachements = await clientOwner().$queryRawUnsafe<
      { client_id: string }[]
    >(
      `SELECT uc.client_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 ORDER BY uc.client_id`,
      email,
    );
    expect(rattachements.map((r) => r.client_id).sort()).toEqual(
      [CLIENT_A1, CLIENT_A2].sort(),
    );
  });
});

describe("comptesDuPortailDuClient — la lecture pour la fiche client", () => {
  it("rend le compte invité, avec son courriel et son état", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());

    const comptes = await comptesDuPortailDuClient(
      ADMIN_A,
      CLIENT_A1,
      clientApp(),
    );
    const compte = comptes.find((c) => c.email === email);
    expect(compte).toBeDefined();
    expect(compte?.actif).toBe(true);
  });
});

describe("revoquerAccesPortailClient — la révocation (I6 : jamais de suppression)", () => {
  it("bascule actif=false ; le compte ne lit PLUS son rattachement ni son parc", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { id: string; utilisateur_id: string }[]
    >(
      `SELECT uc.id::text, uc.utilisateur_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(ligne).toBeDefined();
    if (ligne === undefined) throw new Error("fixture non créée");

    // TÉMOIN — avant révocation, le compte lit bien son rattachement (D92).
    const avant = await rattachementsDuCompte(
      ligne.utilisateur_id,
      clientApp(),
    );
    expect(avant.map((r) => r.clientId)).toContain(CLIENT_A1);

    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      ligne.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const apres = await rattachementsDuCompte(
      ligne.utilisateur_id,
      clientApp(),
    );
    expect(apres.map((r) => r.clientId)).not.toContain(CLIENT_A1);

    // JAMAIS DE SUPPRESSION (I6) — la ligne existe encore, révoquée.
    const [toujoursLa] = await clientOwner().$queryRawUnsafe<
      { actif: boolean }[]
    >(`SELECT actif FROM "utilisateur_client" WHERE id = $1::uuid`, ligne.id);
    expect(toujoursLa).toBeDefined();
    expect(toujoursLa?.actif).toBe(false);
  });

  it("un identifiant inconnu reçoit un refus NOMMÉ", async () => {
    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      uuidv7(),
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("un rôle qui n'administre pas (ADV) est refusé AVANT toute écriture — requête forgée (D230)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT uc.id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    if (ligne === undefined) throw new Error("fixture non créée");

    await expect(
      revoquerAccesPortailClient(ADV_A, ligne.id, clientApp()),
    ).rejects.toBeInstanceOf(RefusInvitationClient);

    const [toujoursActif] = await clientOwner().$queryRawUnsafe<
      { actif: boolean }[]
    >(`SELECT actif FROM "utilisateur_client" WHERE id = $1::uuid`, ligne.id);
    expect(toujoursActif?.actif).toBe(true);
  });
});
