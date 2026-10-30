import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  copierLienDAcces,
  copierNouveauLienDAcces,
  envoyerLienDAcces,
  envoyerNouveauLienDAcces,
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

const ADV_A = {
  ...ADMIN_A,
  role: Role.adv,
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

describe("envoyerLienDAcces — ce que le module accepte désormais aussi (D199)", () => {
  it("D199 (13/10/2026, décision n° 85) — la direction administre désormais les identités, elle envoie le lien avec succès", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    const resultat = await envoyerLienDAcces(
      DIRECTION_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat.accepte).toBe(true);

    const [compte] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte).toBeDefined();
  });
});

describe("envoyerLienDAcces — ce que le module refuse encore, lisiblement", () => {
  // D199 élargit à la direction, il n'ouvre pas à tous : un rôle qui n'a
  // jamais administré les identités reste refusé AVANT toute écriture.
  it("un rôle qui n'administre pas est refusé avant toute écriture (D199 ne l'élargit pas)", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await expect(
      envoyerLienDAcces(ADV_A, utilisateurId, clientApp(), {}),
    ).rejects.toBeInstanceOf(RefusEnvoiAcces);

    const [compte] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte).toBeUndefined();
  });
});

describe("etatsAccesDesTechniciens — l'état par technicien, pour l'écran Équipe", () => {
  // POINT 1 (9EXA-EQUIPE-TECHNICIENS-MAQUETTE, D204) — un lien envoyé il y a
  // plus d'une heure (`DUREE_LIEN_PREMIER_ACCES_SECONDES`) et jamais suivi
  // d'un mot de passe devient « lien_expire », même forme et même seuil que
  // `etatsAccesDesComptes` (`lib/auth/acces-bureau.ts`).
  it("aucun → lien envoyé → EXPIRÉ → actif", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});

    const apresEnvoi = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(apresEnvoi.get(utilisateurId)?.etat).toBe("lien_envoye");

    // PLUS D'UNE HEURE — le lien est réputé expiré.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET cree_le = now() - interval '2 hours'
        WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `UPDATE "journal_acces" SET horodatage = now() - interval '2 hours'
        WHERE detail LIKE '%cible:' || $1`,
      utilisateurId,
    );
    const apresExpiration = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(apresExpiration.get(utilisateurId)?.etat).toBe("lien_expire");

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

  // POINT 1 — l'historique de TOUS les administrateurs de la société active
  // (`admin_societe` ET direction, D199), pas seulement celui qui regarde —
  // même correctif que le solde 175 de `etatsAccesDesComptes`.
  // 9EXB-EQUIPE-EPREUVES-CAPTURES, point 2 — AUCUN filtre explicite sur
  // `societeId` n'existait dans cette fonction (contrairement à
  // `etatsAccesDesComptes`, qui calcule `idsValides` avant de répondre) : le
  // seul rempart était la DISCIPLINE DE L'APPELANT (toujours une liste de
  // techniciens déjà filtrée par `listerLesTechniciens`). Un appel DIRECT
  // (cette fonction est exportée et visible depuis `lib/tableau-de-bord/
  // lectures.ts` aussi) avec l'identifiant d'un technicien de la société B
  // rendait un état RÉEL (« actif », donc « cette personne a déjà un mot de
  // passe ») — la fuite que ce test fige avant correctif.
  it("un technicien de la société B n'est jamais rendu, même avec un accès ACTIF (fuite inter-société)", async () => {
    const technicienDeB = await creerTechnicienDeB();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "compte" (id, utilisateur_id, emetteur, compte_externe_id, fournisseur_id, mot_de_passe, modifie_le)
       VALUES ($1::uuid, $2::uuid, 'local:credential', $2, 'credential', 'empreinte-de-test', now())`,
      uuidv7(),
      technicienDeB,
    );

    const etats = await etatsAccesDesTechniciens(
      ADMIN_A,
      [technicienDeB],
      clientApp(),
    );
    expect(etats.has(technicienDeB)).toBe(false);

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      technicienDeB,
    );
  });

  it("rend « lien envoyé » même si c'est la DIRECTION, pas ADMIN_A, qui a envoyé le lien", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();

    const envoi = await envoyerLienDAcces(
      DIRECTION_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(envoi.accepte).toBe(true);

    const etats = await etatsAccesDesTechniciens(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(etats.get(utilisateurId)?.etat).toBe("lien_envoye");
  });

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

  // B6 (relecture de 9I6B, 9I7D) — le dernier lien COPIÉ se distingue du
  // dernier lien ENVOYÉ, sans migration : le texte déjà journalisé par
  // `detailCopie`/`detailEnvoi` (`lib/auth/lien-d-acces.ts`) suffit.
  it("distingue le dernier lien COPIÉ du dernier lien ENVOYÉ (copie)", async () => {
    const technicienCopie = await creerTechnicienDeTest();
    await copierLienDAcces(ADMIN_A, technicienCopie.utilisateurId, clientApp());
    const technicienEnvoye = await creerTechnicienDeTest();
    await envoyerLienDAcces(ADMIN_A, technicienEnvoye.utilisateurId, clientApp(), {});

    const etats = await etatsAccesDesTechniciens(
      ADMIN_A,
      [technicienCopie.utilisateurId, technicienEnvoye.utilisateurId],
      clientApp(),
    );
    const etatCopie = etats.get(technicienCopie.utilisateurId);
    const etatEnvoye = etats.get(technicienEnvoye.utilisateurId);
    if (etatCopie?.etat !== "lien_envoye" || etatEnvoye?.etat !== "lien_envoye") {
      throw new Error("les deux états attendus sont « lien_envoye »");
    }
    expect(etatCopie.copie).toBe(true);
    expect(etatEnvoye.copie).toBe(false);
  });
});

describe("envoyerNouveauLienDAcces — le geste du menu « … » (D86, point 3)", () => {
  it("SAUTE le cliquet de D65 sur un compte qui a DÉJÀ un mot de passe, trace « reemission_premier_acces »", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );

    // LE PREMIER ENVOI GARDE SON REFUS (non touché par ce lot).
    const refusPremierEnvoi = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(refusPremierEnvoi).toEqual({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });

    // LE NOUVEAU LIEN, LUI, RÉUSSIT MALGRÉ LE MOT DE PASSE DÉJÀ POSÉ.
    const resultat = await envoyerNouveauLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(resultat.accepte).toBe(true);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string; detail: string; utilisateur_id: string }[]
    >(
      `SELECT evenement::text, detail, utilisateur_id::text
         FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    expect(trace?.evenement).toBe("reemission_premier_acces");
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.detail).toContain("nouveau lien");
    expect(trace?.detail).toContain("D86");

    // LE MOT DE PASSE DÉJÀ CHOISI N'EST PAS EFFACÉ : seul un jeton s'ajoute.
    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT mot_de_passe FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte?.mot_de_passe).toBe("empreinte-de-test");
  });

  it("refuse nommément un technicien de la société B, comme le premier envoi (D50)", async () => {
    const technicienDeB = await creerTechnicienDeB();
    const resultat = await envoyerNouveauLienDAcces(
      ADMIN_A,
      technicienDeB,
      clientApp(),
      {},
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      technicienDeB,
    );
  });
});

/**
 * COPIER LE LIEN D'ACCÈS, SANS L'ENVOYER (9I6B-LIEN-ACCES-A-COPIER, D170,
 * 29/10/2026) — même garde, même cliquet de D65, même jeton que l'envoi
 * ci-dessus (`preparerLienDAcces`, partagée, `lib/auth/lien-d-acces.ts`).
 * Ces épreuves rejouent donc, pour `copierLienDAcces`/
 * `copierNouveauLienDAcces`, EXACTEMENT les mêmes refus que ci-dessus pour
 * `envoyerLienDAcces`/`envoyerNouveauLienDAcces` — même route
 * (`administrer_utilisateurs`), même forme « société » (I1) — et c'est cette
 * identité de code qui vaut ici pour une REQUÊTE FORGÉE : la route d'API
 * (`app/api/equipe/[id]/copier-lien/route.ts`) n'ajoute rien à
 * `exigerCapacite` puis cet appel direct.
 */
describe("copierLienDAcces — le premier envoi, copié plutôt qu'envoyé", () => {
  it("pose le compte au repos, rend l'URL et trace « lien copié par l'administrateur », jamais le jeton", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();

    const resultat = await copierLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.url.length).toBeGreaterThan(0);

    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT mot_de_passe FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
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
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.societe_id_cible).toBe(SOCIETE_A);
    expect(trace?.role).toBe(Role.admin_societe);
    expect(trace?.detail).toContain("lien copié par l'administrateur");
    // LE JETON N'EST JAMAIS ÉCRIT EN TRACE — seule l'URL rendue à l'appelant
    // le porte (interdit de ce lot).
    expect(trace?.detail).not.toContain("http");
    expect(trace?.detail).not.toBe(resultat.url);
  });

  it("un second appel réémet — reemission_premier_acces, toujours copié, jamais envoyé", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await copierLienDAcces(ADMIN_A, utilisateurId, clientApp());

    const second = await copierLienDAcces(ADMIN_A, utilisateurId, clientApp());
    expect(second.accepte).toBe(true);

    const traces = await clientOwner().$queryRawUnsafe<
      { evenement: string; detail: string }[]
    >(
      `SELECT evenement::text, detail FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage ASC`,
      utilisateurId,
    );
    expect(traces.map((t) => t.evenement)).toEqual([
      "ouverture_identite",
      "reemission_premier_acces",
    ]);
    for (const trace of traces) {
      expect(trace.detail).toContain("lien copié par l'administrateur");
    }
  });

  it("une requête forgée depuis une AUTRE société est introuvable — même refus que l'envoi (D50)", async () => {
    const technicienDeB = await creerTechnicienDeB();
    const resultatB = await copierLienDAcces(
      ADMIN_A,
      technicienDeB,
      clientApp(),
    );
    expect(resultatB).toEqual({ accepte: false, motif: "introuvable" });

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      technicienDeB,
    );
  });

  it("un technicien inactif reçoit un refus nommé, jamais une copie", async () => {
    const { utilisateurId } = await creerTechnicienDeTest(false);
    const resultat = await copierLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "membre_inactif" });
  });

  it("une identité qui a déjà choisi son mot de passe refuse — le cliquet de D65", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await copierLienDAcces(ADMIN_A, utilisateurId, clientApp());
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );

    const resultat = await copierLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });
  });

  it("un rôle qui n'administre pas (ADV) est refusé avant toute écriture — requête forgée", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await expect(
      copierLienDAcces(ADV_A, utilisateurId, clientApp()),
    ).rejects.toBeInstanceOf(RefusEnvoiAcces);

    const [compte] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte).toBeUndefined();
  });
});

describe("copierNouveauLienDAcces — le geste du menu « … », copié (9I6B)", () => {
  it("SAUTE le cliquet de D65, trace « reemission_premier_acces » avec « lien copié », sans toucher au mot de passe", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await copierLienDAcces(ADMIN_A, utilisateurId, clientApp());
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );

    const resultat = await copierNouveauLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string; detail: string }[]
    >(
      `SELECT evenement::text, detail FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    expect(trace?.evenement).toBe("reemission_premier_acces");
    expect(trace?.detail).toContain("lien copié par l'administrateur");
    expect(trace?.detail).toContain("D86");

    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT mot_de_passe FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(compte?.mot_de_passe).toBe("empreinte-de-test");
  });

  it("refuse nommément un technicien de la société B, comme le premier envoi (D50)", async () => {
    const technicienDeB = await creerTechnicienDeB();
    const resultat = await copierNouveauLienDAcces(
      ADMIN_A,
      technicienDeB,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      technicienDeB,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      technicienDeB,
    );
  });

  // (M2, 9I7D) — manquait ici : `copierLienDAcces` le portait déjà (voir
  // « un rôle qui n'administre pas (ADV) est refusé » plus haut).
  it("un rôle qui n'administre pas (ADV) est refusé avant toute écriture — requête forgée", async () => {
    const { utilisateurId } = await creerTechnicienDeTest();
    await copierLienDAcces(ADMIN_A, utilisateurId, clientApp());
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );

    await expect(
      copierNouveauLienDAcces(ADV_A, utilisateurId, clientApp()),
    ).rejects.toBeInstanceOf(RefusEnvoiAcces);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string }[]
    >(
      `SELECT evenement::text FROM "journal_acces"
        WHERE detail LIKE '%cible:' || $1
        ORDER BY horodatage DESC LIMIT 1`,
      utilisateurId,
    );
    // La SEULE trace reste celle du premier lien, copié par ADMIN_A —
    // l'appel refusé n'en a écrit aucune.
    expect(trace?.evenement).toBe("ouverture_identite");
  });
});
