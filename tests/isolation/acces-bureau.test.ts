import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  creerCompteDeBureau,
  envoyerLienDAccesBureau,
  estRoleDeBureau,
  etatsAccesDesComptes,
  listerComptesDeBureau,
} from "@/lib/auth/acces-bureau";
import { RefusEnvoiAcces } from "@/lib/auth/lien-d-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * D196 (9ET-COMPTES-BUREAU-1) — comptes de bureau : lister, créer avec un
 * rôle, envoyer et renvoyer le lien d'accès.
 *
 * Modèle : `tests/isolation/acces-technicien.test.ts`. Un seul environnement
 * `{}` : le canal est donc TOUJOURS « non configuré » (voir l'en-tête de ce
 * fichier modèle pour la raison).
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

const PREFIXE = "zz9ET-";

function courriel(): string {
  return `${PREFIXE.toLowerCase()}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

afterEach(async () => {
  const motif = `${PREFIXE.toLowerCase()}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "detail" LIKE $1 OR "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
  // LA FUITE SIMULÉE DE L'ADMINISTRATEUR SUR LA SOCIÉTÉ B (voir plus bas) —
  // jamais une fixture permanente, toujours retirée après son propre test.
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" = $1::uuid AND "societe_id" = $2::uuid`,
    ADMIN_A.utilisateurId,
    SOCIETE_B,
  );
});

afterAll(fermerClients);

describe("estRoleDeBureau", () => {
  it("accepte les cinq rôles, refuse le technicien", () => {
    expect(estRoleDeBureau(Role.adv)).toBe(true);
    expect(estRoleDeBureau(Role.technicien)).toBe(false);
  });
});

describe("creerCompteDeBureau", () => {
  it("crée l'identité et l'habilitation, et trace n'est PAS encore écrite (seul l'envoi du lien trace)", async () => {
    const courrielCree = courriel();
    const resultat = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte d'épreuve 9ET", courriel: courrielCree, role: Role.adv },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.rattache).toBe(false);

    const [habilitation] = await clientOwner().$queryRawUnsafe<
      { role: string; societe_id: string }[]
    >(
      `SELECT role::text, societe_id::text FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
      resultat.utilisateurId,
    );
    expect(habilitation?.role).toBe(Role.adv);
    expect(habilitation?.societe_id).toBe(SOCIETE_A);
  });

  it("rattache une identité déjà connue de la plateforme, sans créer de doublon", async () => {
    const courrielConnu = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" (id, nom, email, modifie_le)
       VALUES ($1::uuid, 'Identité déjà connue 9ET', $2, now())`,
      utilisateurId,
      courrielConnu,
    );

    const resultat = await creerCompteDeBureau(
      ADMIN_A,
      {
        nom: "Nom ignoré",
        courriel: courrielConnu,
        role: Role.responsable_sav,
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: true,
      utilisateurId,
      rattache: true,
    });
  });

  it("refuse un rôle hors liste, avant toute écriture (D50)", async () => {
    const courrielTente = courriel();
    const resultat = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Jamais écrit", courriel: courrielTente, role: Role.technicien },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "role_hors_liste" });

    const existe = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      courrielTente,
    );
    expect(existe).toHaveLength(0);
  });

  it("refuse un doublon — cette personne est déjà membre de la société active", async () => {
    const courrielDoublon = courriel();
    const premier = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET", courriel: courrielDoublon, role: Role.direction },
      clientApp(),
    );
    expect(premier.accepte).toBe(true);

    const second = await creerCompteDeBureau(
      ADMIN_A,
      {
        nom: "Compte 9ET",
        courriel: courrielDoublon,
        role: Role.responsable_materiel,
      },
      clientApp(),
    );
    expect(second).toEqual({ accepte: false, motif: "deja_membre" });
  });
});

describe("listerComptesDeBureau", () => {
  it("ne rend pas les propres habilitations de l'administrateur dans une AUTRE société (piège RLS D61)", async () => {
    // LA FUITE, SI LE FILTRE EXPLICITE ÉTAIT RETIRÉ : `utilisateur_societe`
    // porte la forme « appartenance » (D61) EN PLUS de la forme « société » ;
    // sous `avecContexteApplicatif`, qui pose `app.utilisateur_id`, une
    // lecture non filtrée rendrait AUSSI cette ligne de la société B.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      ADMIN_A.utilisateurId,
      SOCIETE_B,
      Role.direction,
    );

    const comptes = await listerComptesDeBureau(ADMIN_A, clientApp());
    const lignesDeLAdmin = comptes.filter(
      (compte) => compte.utilisateurId === ADMIN_A.utilisateurId,
    );
    expect(lignesDeLAdmin).toHaveLength(1);
    expect(lignesDeLAdmin[0]?.role).toBe(Role.admin_societe);
  });

  it("rend le compte créé, avec le second facteur exigé pour son rôle", async () => {
    const courrielCree = courriel();
    const resultat = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET listé", courriel: courrielCree, role: Role.direction },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    const comptes = await listerComptesDeBureau(ADMIN_A, clientApp());
    const ligne = comptes.find(
      (c) => c.utilisateurId === resultat.utilisateurId,
    );
    expect(ligne).toMatchObject({
      nom: "Compte 9ET listé",
      email: courrielCree,
      role: Role.direction,
      secondFacteurExige: true,
    });
  });
});

describe("envoyerLienDAccesBureau", () => {
  it("un technicien de la société active est introuvable — ce n'est pas un compte de bureau", async () => {
    const resultat = await envoyerLienDAccesBureau(
      ADMIN_A,
      UTILISATEUR_PAR_ROLE[Role.technicien],
      clientApp(),
      {},
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("envoie le lien, trace ouverture_identite, auteur l'administrateur (D196)", async () => {
    const courrielCree = courriel();
    const cree = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET accès", courriel: courrielCree, role: Role.adv },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    const resultat = await envoyerLienDAccesBureau(
      ADMIN_A,
      cree.utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.destinataire).toBe(courrielCree);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string; utilisateur_id: string; detail: string }[]
    >(
      `SELECT evenement::text, utilisateur_id::text, detail
         FROM "journal_acces"
        WHERE evenement = 'ouverture_identite' AND detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      cree.utilisateurId,
    );
    expect(trace).toBeDefined();
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.detail).toContain("compte de bureau (D196)");
  });

  it("un rôle qui n'administre pas est refusé avant toute écriture", async () => {
    const courrielCree = courriel();
    const cree = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET refus", courriel: courrielCree, role: Role.adv },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    await expect(
      envoyerLienDAccesBureau(DIRECTION_A, cree.utilisateurId, clientApp(), {}),
    ).rejects.toBeInstanceOf(RefusEnvoiAcces);

    const [compte] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "compte" WHERE utilisateur_id = $1::uuid`,
      cree.utilisateurId,
    );
    expect(compte).toBeUndefined();
  });

  it("le cliquet de D65 : une identité qui a déjà choisi son mot de passe refuse", async () => {
    const courrielCree = courriel();
    const cree = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET cliquet", courriel: courrielCree, role: Role.adv },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    await envoyerLienDAccesBureau(ADMIN_A, cree.utilisateurId, clientApp(), {});
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      cree.utilisateurId,
    );

    const resultat = await envoyerLienDAccesBureau(
      ADMIN_A,
      cree.utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat).toEqual({ accepte: false, motif: "deja_un_mot_de_passe" });
  });
});

describe("etatsAccesDesComptes — l'état par compte, pour l'écran Équipe", () => {
  it("aucun → lien envoyé → lien expiré → actif", async () => {
    const courrielCree = courriel();
    const cree = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Compte 9ET états", courriel: courrielCree, role: Role.adv },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    const avant = await etatsAccesDesComptes(
      ADMIN_A,
      [cree.utilisateurId],
      clientApp(),
    );
    expect(avant.get(cree.utilisateurId)).toEqual({ etat: "aucun" });

    await envoyerLienDAccesBureau(ADMIN_A, cree.utilisateurId, clientApp(), {});
    const apresEnvoi = await etatsAccesDesComptes(
      ADMIN_A,
      [cree.utilisateurId],
      clientApp(),
    );
    expect(apresEnvoi.get(cree.utilisateurId)?.etat).toBe("lien_envoye");

    // PLUS D'UNE HEURE — le lien est réputé expiré (3600s, mesuré dans
    // Better Auth, voir `lib/auth/config.ts`).
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET cree_le = now() - interval '2 hours'
        WHERE utilisateur_id = $1::uuid`,
      cree.utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `UPDATE "journal_acces" SET horodatage = now() - interval '2 hours'
        WHERE detail LIKE '%cible:' || $1`,
      cree.utilisateurId,
    );
    const apresExpiration = await etatsAccesDesComptes(
      ADMIN_A,
      [cree.utilisateurId],
      clientApp(),
    );
    expect(apresExpiration.get(cree.utilisateurId)?.etat).toBe("lien_expire");

    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      cree.utilisateurId,
    );
    const apresChoix = await etatsAccesDesComptes(
      ADMIN_A,
      [cree.utilisateurId],
      clientApp(),
    );
    expect(apresChoix.get(cree.utilisateurId)).toEqual({ etat: "actif" });
  });
});
