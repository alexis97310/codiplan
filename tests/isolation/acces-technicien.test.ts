import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  envoyerLienDAcces,
  etatsAccesDesTechniciens,
  RefusEnvoiAcces,
} from "@/lib/auth/acces-technicien";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien } from "@/lib/techniciens/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D162 (9DJ-TP-ACC1-DONNER-ACCES) — `envoyerLienDAcces`, le geste administratif
 * qui donne l'accès à un technicien déjà créé.
 *
 * ## UN ENVIRONNEMENT VIDE, PARTOUT
 *
 * `{}` ne porte ni `COURRIEL_API_CLE` ni `COURRIEL_EXPEDITEUR` : le canal est
 * donc TOUJOURS « non configuré », et `envoyerLienPremierAcces` rend
 * `{ parti: false, motif }` de façon déterministe, sans jamais toucher le
 * réseau — exactement la forme que l'écran « Le lien n'est pas parti » doit
 * savoir montrer (I9 : aucune clé, même factice, n'entre au dépôt).
 *
 * ## CE QUI N'EST PAS ÉPROUVÉ ICI, ET POURQUOI
 *
 * Le refus « habilité dans une autre société » n'est pas implémenté (voir
 * l'en-tête de `lib/auth/acces-technicien.ts` et D162) : aucun scénario ne
 * l'éprouve donc.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DIRECTION_A = {
  ...ADMIN_A,
  role: Role.direction,
};

const PREFIXE = "9DJACC-";

function courriel(): string {
  return `${PREFIXE.toLowerCase()}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

async function creerTechnicienDeTest(
  actif = true,
): Promise<{ utilisateurId: string; email: string }> {
  const email = courriel();
  const resultat = await creerTechnicien(
    ADMIN_A,
    {
      nom: "Technicien d'épreuve 9DJACC",
      email,
      agence_id: AGENCE_A,
      actif,
      statut_ressource: "salarie",
    },
    clientApp(),
  );
  expect(resultat.accepte).toBe(true);
  if (!resultat.accepte) throw new Error("fixture non créée");
  return { utilisateurId: resultat.utilisateurId, email };
}

/** Un technicien de la société B, posé à la main — introuvable depuis A. */
async function creerTechnicienDeB(): Promise<string> {
  const utilisateurId = uuidv7();
  const email = courriel();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "utilisateur" (id, nom, email, modifie_le)
     VALUES ($1::uuid, 'Technicien B 9DJACC', $2, now())`,
    utilisateurId,
    email,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" (id, societe_id, utilisateur_id, agence_id, actif, modifie_le)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true, now())`,
    uuidv7(),
    SOCIETE_B,
    utilisateurId,
    AGENCE_B,
  );
  return utilisateurId;
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
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
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
});

afterAll(fermerClients);

describe("envoyerLienDAcces — le premier envoi", () => {
  it("pose le compte au repos, émet un envoi et trace ouverture_identite, auteur l'administrateur", async () => {
    const { utilisateurId, email } = await creerTechnicienDeTest();

    const resultat = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.destinataire).toBe(email);
    // Environnement vide : le canal n'est jamais configuré dans ce scénario.
    expect(resultat.envoi.parti).toBe(false);

    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT mot_de_passe FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte).toBeDefined();
    expect(compte?.mot_de_passe).toBeNull();

    const [trace] = await clientOwner().$queryRawUnsafe<
      {
        evenement: string;
        utilisateur_id: string;
        societe_id_cible: string;
        role: string;
        detail: string;
      }[]
    >(
      `SELECT evenement::text, utilisateur_id::text, societe_id_cible::text, role::text, detail
         FROM "journal_acces"
        WHERE evenement = 'ouverture_identite' AND detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    expect(trace).toBeDefined();
    // L'AUTEUR EST L'ADMINISTRATEUR, jamais le technicien visé (D162).
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.societe_id_cible).toBe(SOCIETE_A);
    expect(trace?.role).toBe(Role.admin_societe);
    expect(trace?.detail).toContain(utilisateurId);
  });

  it("un second envoi réémet — reemission_premier_acces, jamais un second ouverture_identite", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});

    const second = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(second.accepte).toBe(true);

    const traces = await clientOwner().$queryRawUnsafe<{ evenement: string }[]>(
      `SELECT evenement::text FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage ASC`,
      utilisateurId,
    );
    expect(traces.map((t) => t.evenement)).toEqual([
      "ouverture_identite",
      "reemission_premier_acces",
    ]);
  });
});

describe("envoyerLienDAcces — les refus nommés (D50)", () => {
  it("un technicien de la société B est introuvable depuis A — même refus qu'un identifiant inconnu", async () => {
    const technicienDeB = await creerTechnicienDeB();
    const resultatB = await envoyerLienDAcces(
      ADMIN_A,
      technicienDeB,
      clientApp(),
      {},
    );
    expect(resultatB).toEqual({ accepte: false, motif: "introuvable" });

    const resultatInconnu = await envoyerLienDAcces(
      ADMIN_A,
      uuidv7(),
      clientApp(),
      {},
    );
    expect(resultatInconnu).toEqual({ accepte: false, motif: "introuvable" });

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      technicienDeB,
    );
  });

  it("un technicien inactif reçoit un refus nommé, jamais un envoi", async () => {
    const { utilisateurId } = await creerTechnicienDeTest(false);
    const resultat = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat).toEqual({ accepte: false, motif: "membre_inactif" });
  });

  it("une identité qui a déjà choisi son mot de passe refuse — le cliquet de D65", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );

    const resultat = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });
  });
});

describe("envoyerLienDAcces — ce que le module refuse, lisiblement", () => {
  it("un rôle qui n'administre pas est refusé avant toute écriture", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await expect(
      envoyerLienDAcces(DIRECTION_A, utilisateurId, clientApp(), {}),
    ).rejects.toBeInstanceOf(RefusEnvoiAcces);

    const [compte] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte).toBeUndefined();
  });
});

describe("etatsAccesDesTechniciens — l'état par technicien, pour l'écran Équipe", () => {
  it("aucun → lien envoyé → actif", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();

    const avant = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(avant.get(utilisateurId)).toEqual({ etat: "aucun" });

    await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});
    const apresEnvoi = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    const etat = apresEnvoi.get(utilisateurId);
    expect(etat?.etat).toBe("lien_envoye");
    if (etat?.etat === "lien_envoye") {
      expect(etat.horodatage).toBeInstanceOf(Date);
    }

    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    const apresChoix = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(apresChoix.get(utilisateurId)).toEqual({ etat: "actif" });
  });
});
