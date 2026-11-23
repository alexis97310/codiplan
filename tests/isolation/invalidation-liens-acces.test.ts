import { afterAll, describe, expect, it } from "vitest";

import {
  envoyerLienDAcces,
  envoyerNouveauLienDAcces,
} from "@/lib/auth/acces-technicien";
import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import {
  identifiantLienAcces,
  invaliderLiensAnterieurs,
} from "@/lib/auth/invalidation-liens-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L35-LIENS-ACCES-ANCIENS-ANNULES (D281) — un nouveau lien d'accès annule
 * les liens antérieurs NON UTILISÉS du même compte. Ferme le point 3 laissé
 * ouvert par D266 (9L09).
 */

afterAll(fermerClients);

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADMIN_B = { ...ADMIN_A, societeId: SOCIETE_B };

/** Les identifiants de lien, préfixe `reset-password:` compris, pour CE compte. */
async function identifiantsEmis(utilisateurId: string): Promise<string[]> {
  const lignes = await clientOwner().$queryRawUnsafe<{ identifiant: string }[]>(
    `SELECT identifiant FROM "verification"
      WHERE valeur = $1 AND identifiant LIKE 'reset-password:%'
      ORDER BY cree_le ASC`,
    utilisateurId,
  );
  return lignes.map((l) => l.identifiant);
}

async function seConnecte(email: string, motDePasse: string): Promise<number> {
  const reponse = await dansUnEchangeAuth(() =>
    creerAuth(clientApp()).api.signInEmail({
      body: { email, password: motDePasse },
      asResponse: true,
    }),
  );
  return reponse.status;
}

async function nettoyerTechnicien(utilisateurId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "verification" WHERE valeur = $1`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
    utilisateurId,
  );
}

describe("app_invalider_liens_anterieurs — la fonction SECURITY DEFINER elle-même (D281)", () => {
  it("supprime le lien antérieur du MÊME compte, épargne celui qu'on lui désigne, épargne un AUTRE compte et un AUTRE usage", async () => {
    const compte = uuidv7();
    const autreCompte = uuidv7();
    const jetonAncien = `ancien-${uuidv7()}`;
    const jetonNouveau = `nouveau-${uuidv7()}`;
    const jetonAutreCompte = `autre-compte-${uuidv7()}`;
    const identifiantAutreUsage = `2fa-${uuidv7()}`;

    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "verification" (id, identifiant, valeur, expire_le, cree_le, modifie_le)
       VALUES
         (gen_random_uuid(), $1, $3, now() + interval '1 hour', now(), now()),
         (gen_random_uuid(), $2, $3, now() + interval '1 hour', now(), now()),
         (gen_random_uuid(), $4, $5, now() + interval '1 hour', now(), now()),
         (gen_random_uuid(), $6, $3, now() + interval '1 hour', now(), now())`,
      `reset-password:${jetonAncien}`,
      `reset-password:${jetonNouveau}`,
      compte,
      `reset-password:${jetonAutreCompte}`,
      autreCompte,
      identifiantAutreUsage,
    );

    try {
      await invaliderLiensAnterieurs(
        clientApp(),
        compte,
        identifiantLienAcces(jetonNouveau),
      );

      // ── LE MÊME COMPTE, LE MÊME USAGE : l'ancien a disparu, le nouveau reste
      expect(await identifiantsEmis(compte)).toEqual([
        `reset-password:${jetonNouveau}`,
      ]);

      // ── UN AUTRE COMPTE N'EST JAMAIS TOUCHÉ ──────────────────────────────
      expect(await identifiantsEmis(autreCompte)).toEqual([
        `reset-password:${jetonAutreCompte}`,
      ]);

      // ── UN AUTRE USAGE (second facteur, confiance d'appareil) N'EST JAMAIS
      // TOUCHÉ — même compte, préfixe différent ───────────────────────────
      const autreUsage = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "verification" WHERE identifiant = $1`,
        identifiantAutreUsage,
      );
      expect(Number(autreUsage[0]?.n)).toBe(1);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "verification" WHERE valeur IN ($1, $2) OR identifiant = $3`,
        compte,
        autreCompte,
        identifiantAutreUsage,
      );
    }
  });

  it("JUMEAU — appelée une seconde fois sur un compte déjà invalidé, elle ne lève pas et ne supprime rien de plus", async () => {
    const compte = uuidv7();
    const jeton = `seul-${uuidv7()}`;
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "verification" (id, identifiant, valeur, expire_le, cree_le, modifie_le)
       VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now(), now())`,
      `reset-password:${jeton}`,
      compte,
    );
    try {
      await invaliderLiensAnterieurs(
        clientApp(),
        compte,
        identifiantLienAcces(jeton),
      );
      expect(await identifiantsEmis(compte)).toEqual([
        `reset-password:${jeton}`,
      ]);

      // Rien d'antérieur à invalider : un second appel, sur le MÊME lien à
      // conserver, ne lève pas et ne retire rien.
      await invaliderLiensAnterieurs(
        clientApp(),
        compte,
        identifiantLienAcces(jeton),
      );
      expect(await identifiantsEmis(compte)).toEqual([
        `reset-password:${jeton}`,
      ]);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "verification" WHERE valeur = $1`,
        compte,
      );
    }
  });
});

describe("le geste réel (envoyer un lien, puis un NOUVEAU) — D281, 9L35", () => {
  it("lien 1 envoyé, lien 2 envoyé → lien 1 refusé, lien 2 accepté ; un AUTRE compte, dans une AUTRE société, n'est jamais touché", async () => {
    const email = `9l35-${uuidv7()}@codima.test`;
    const emailAutreSociete = `9l35-autre-${uuidv7()}@codima.test`;

    const creation = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien 9L35",
        email,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    const { utilisateurId } = creation;

    const creationAutreSociete = await creerTechnicien(
      ADMIN_B,
      {
        nom: "Technicien 9L35 (société B)",
        email: emailAutreSociete,
        agence_id: AGENCE_B,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(creationAutreSociete.accepte).toBe(true);
    if (!creationAutreSociete.accepte) return;
    const { utilisateurId: utilisateurIdAutreSociete } = creationAutreSociete;

    try {
      // ── LE LIEN DE LA SOCIÉTÉ B, ÉMIS AVANT TOUT CE QUI SUIT ─────────────
      const envoiAutreSociete = await envoyerLienDAcces(
        ADMIN_B,
        utilisateurIdAutreSociete,
        clientApp(),
        {},
      );
      expect(envoiAutreSociete.accepte).toBe(true);
      const [identifiantAutreSociete] = await identifiantsEmis(
        utilisateurIdAutreSociete,
      );
      expect(identifiantAutreSociete).toBeDefined();

      // ── LIEN 1 ────────────────────────────────────────────────────────
      const envoi1 = await envoyerLienDAcces(
        ADMIN_A,
        utilisateurId,
        clientApp(),
        {},
      );
      expect(envoi1.accepte).toBe(true);
      const [identifiant1] = await identifiantsEmis(utilisateurId);
      expect(identifiant1).toBeDefined();
      const jeton1 = (identifiant1 ?? "").slice("reset-password:".length);

      // ── LIEN 2 (D86, « nouveau lien ») — DOIT INVALIDER LE LIEN 1 ────────
      const envoi2 = await envoyerNouveauLienDAcces(
        ADMIN_A,
        utilisateurId,
        clientApp(),
        {},
      );
      expect(envoi2.accepte).toBe(true);

      // UN SEUL LIEN RESTE EN BASE POUR CE COMPTE — le premier a disparu.
      const restants = await identifiantsEmis(utilisateurId);
      expect(restants).toHaveLength(1);
      const jeton2 = (restants[0] ?? "").slice("reset-password:".length);
      expect(jeton2).not.toBe(jeton1);

      // ── LE LIEN 1 EST REFUSÉ, AU MÊME MOTIF UNIQUE QUE TOUT JETON INVALIDE
      const choix1 = await choisirLePremierMotDePasse(
        {
          jeton: jeton1,
          motDePasse: "MotDePasseChoisi1!",
          confirmation: "MotDePasseChoisi1!",
        },
        creerAuth(clientApp()),
        clientApp(),
      );
      expect(choix1.issue).toBe("refuse");

      // ── LE LIEN 2, LUI, ABOUTIT ──────────────────────────────────────────
      const choix2 = await choisirLePremierMotDePasse(
        {
          jeton: jeton2,
          motDePasse: "MotDePasseChoisi2!",
          confirmation: "MotDePasseChoisi2!",
        },
        creerAuth(clientApp()),
        clientApp(),
      );
      expect(choix2.issue).toBe("abouti");
      expect(await seConnecte(email, "MotDePasseChoisi2!")).toBe(200);

      // ── LE LIEN DE LA SOCIÉTÉ B N'A JAMAIS ÉTÉ TOUCHÉ ────────────────────
      expect(await identifiantsEmis(utilisateurIdAutreSociete)).toEqual([
        identifiantAutreSociete,
      ]);
    } finally {
      await nettoyerTechnicien(utilisateurId);
      await nettoyerTechnicien(utilisateurIdAutreSociete);
    }
  });
});
