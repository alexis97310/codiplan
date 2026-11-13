import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerCompteDeBureau } from "@/lib/auth/acces-bureau";
import { basculerSociete } from "@/lib/auth/societe-active";
import {
  retirerAccesInterne,
  RefusRetraitAcces,
} from "@/lib/auth/retrait-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";
import "./setup/env";

/**
 * 9L03C — RETIRER L'ACCÈS D'UN COMPTE INTERNE (décision d'Alexis du
 * 10/11/2026 puis du 13/11/2026, « Désactiver »).
 *
 * La ligne `utilisateur_societe` n'est jamais supprimée (9L03A a mesuré cinq
 * contraintes RESTRICT qui le bloqueraient) : ce fichier éprouve qu'elle est
 * désactivée, que la désactivation ferme l'accès (bascule refusée), que les
 * sessions sont fermées selon ce qui reste ailleurs, et que le dernier
 * administrateur de la société ne peut pas se voir retirer l'accès.
 *
 * Toutes les fixtures créées ici portent le préfixe `zz9l03c-` et sont
 * détruites par `afterEach` — même patron que
 * `tests/isolation/reinitialisation-second-facteur.test.ts`, describe
 * « D226, exclusivité ».
 */

afterAll(fermerClients);

const ADMS_A = UTILISATEUR_PAR_ROLE[Role.admin_societe];

const CONTEXTE_ADMS_A = {
  utilisateurId: ADMS_A,
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "zz9l03c-";
function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

async function creerTemp(role: Role, societeId = SOCIETE_A): Promise<string> {
  const cree = await creerCompteDeBureau(
    { ...CONTEXTE_ADMS_A, societeId },
    { nom: "9L03C Temporaire", courriel: courriel(), role },
    clientApp(),
  );
  expect(cree.accepte).toBe(true);
  if (!cree.accepte) {
    throw new Error("fixture 9L03C non créée");
  }
  return cree.utilisateurId;
}

async function rattacherAussi(
  utilisateurId: string,
  societeId: string,
  role: Role,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
    uuidv7(),
    utilisateurId,
    societeId,
    role,
  );
}

async function poserSession(
  utilisateurId: string,
  societeIdActive: string | null,
): Promise<string> {
  const token = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "session"
       (id, token, utilisateur_id, expire_le, societe_id_active, role_actif, cree_le, modifie_le)
     VALUES ($1::uuid, $2, $3::uuid, now() + interval '1 day', $4::uuid, $5::"Role", now(), now())`,
    uuidv7(),
    token,
    utilisateurId,
    societeIdActive,
    societeIdActive === null ? null : Role.adv,
  );
  return token;
}

async function sessionsRestantes(utilisateurId: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM "session" WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  return Number(lignes[0]?.n ?? 0);
}

async function ligneHabilitation(
  utilisateurId: string,
  societeId: string,
): Promise<{ actif: boolean } | undefined> {
  const [ligne] = await clientOwner().$queryRawUnsafe<{ actif: boolean }[]>(
    `SELECT actif FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid AND societe_id = $2::uuid`,
    utilisateurId,
    societeId,
  );
  return ligne;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  // Un essai de bascule refusé journalise l'auteur de la TENTATIVE — ici le
  // compte temporaire lui-même (`basculerSociete`) : la ligne doit partir
  // AVANT `utilisateur`, jamais après (I8, jamais de cascade sur `journal_acces`).
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "session" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE email LIKE $1`,
    motif,
  );
});

describe("retirerAccesInterne — la ligne se désactive, jamais ne se supprime", () => {
  it("désactive la ligne, trace l'événement, et la bascule est ensuite refusée", async () => {
    const cibleId = await creerTemp(Role.adv);

    const resultat = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      cibleId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const ligne = await ligneHabilitation(cibleId, SOCIETE_A);
    expect(ligne).toBeDefined();
    expect(ligne?.actif).toBe(false);

    const [trace] = await clientOwner().$queryRawUnsafe<
      { evenement: string; cible: string; detail: string }[]
    >(
      `SELECT evenement::text, societe_id_cible::text AS cible, detail
         FROM "journal_acces"
        WHERE utilisateur_id = $1::uuid AND evenement = 'retrait_acces_interne'
        ORDER BY horodatage DESC LIMIT 1`,
      ADMS_A,
    );
    expect(trace?.evenement).toBe("retrait_acces_interne");
    expect(trace?.cible).toBe(SOCIETE_A);
    expect(trace?.detail).toContain(cibleId);

    const bascule = await basculerSociete(
      {
        utilisateurId: cibleId,
        jetonSession: "jeton-inexistant-9l03c",
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(false);
  });

  it("introuvable : une cible sans habilitation active rend le même refus, rien n'est écrit", async () => {
    const resultat = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      uuidv7(),
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("un rôle sans `administrer_utilisateurs` est refusé avant toute écriture", async () => {
    const cibleId = await creerTemp(Role.adv);
    const ADV_A = UTILISATEUR_PAR_ROLE[Role.adv];

    await expect(
      retirerAccesInterne(
        {
          utilisateurId: ADV_A,
          societeId: SOCIETE_A,
          role: Role.adv,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: null,
        },
        cibleId,
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusRetraitAcces);

    const ligne = await ligneHabilitation(cibleId, SOCIETE_A);
    expect(ligne?.actif).toBe(true);
  });

  it("une cible d'une AUTRE société rend « introuvable »", async () => {
    const cibleId = await creerTemp(Role.adv, SOCIETE_B);
    const resultat = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      cibleId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
    const ligne = await ligneHabilitation(cibleId, SOCIETE_B);
    expect(ligne?.actif).toBe(true);
  });
});

describe("retirerAccesInterne — les sessions, selon ce qui reste ailleurs", () => {
  it("aucune habilitation ailleurs : TOUTES les sessions se ferment", async () => {
    const cibleId = await creerTemp(Role.adv);
    await poserSession(cibleId, SOCIETE_A);
    await poserSession(cibleId, null);
    expect(await sessionsRestantes(cibleId)).toBe(2);

    const resultat = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      cibleId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect(await sessionsRestantes(cibleId)).toBe(0);
  });

  it("une habilitation reste ailleurs : seules les sessions actives sur CETTE société se ferment", async () => {
    const cibleId = await creerTemp(Role.adv);
    await rattacherAussi(cibleId, SOCIETE_B, Role.adv);
    await poserSession(cibleId, SOCIETE_A);
    const tokenB = await poserSession(cibleId, SOCIETE_B);

    const resultat = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      cibleId,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect(await sessionsRestantes(cibleId)).toBe(1);

    const [restante] = await clientOwner().$queryRawUnsafe<{ token: string }[]>(
      `SELECT token FROM "session" WHERE utilisateur_id = $1::uuid`,
      cibleId,
    );
    expect(restante?.token).toBe(tokenB);
  });
});

/**
 * Les comptes qui tiennent AU COMPLET `administrer_utilisateurs` sur la
 * société, ACTIFS en ce moment — jamais supposé être exactement `[ADMS_A,
 * DIR_A]` : d'autres fichiers d'isolation posent, le temps d'un scénario, des
 * comptes `admin_societe`/`direction` supplémentaires sur SOCIETE_A. Compter
 * ce qui existe VRAIMENT, plutôt qu'une liste écrite à la main, est ce qui
 * rend ces trois scénarios robustes à cette population changeante.
 */
async function administrateursActifs(societeId: string): Promise<string[]> {
  const lignes = await clientOwner().$queryRawUnsafe<
    { utilisateur_id: string }[]
  >(
    `SELECT utilisateur_id FROM "utilisateur_societe"
      WHERE societe_id = $1::uuid AND actif = true
        AND role IN ($2::"Role", $3::"Role")`,
    societeId,
    Role.admin_societe,
    Role.direction,
  );
  return lignes.map((l) => l.utilisateur_id);
}

async function poserActif(
  utilisateurIds: readonly string[],
  actif: boolean,
): Promise<void> {
  if (utilisateurIds.length === 0) {
    return;
  }
  await clientOwner().$executeRawUnsafe(
    `UPDATE "utilisateur_societe" SET actif = $1 WHERE utilisateur_id = ANY($2::uuid[])`,
    actif,
    utilisateurIds,
  );
}

describe("retirerAccesInterne — le dernier administrateur de la société", () => {
  it("refuse de retirer le SEUL compte qui tient `administrer_utilisateurs`", async () => {
    const existants = await administrateursActifs(SOCIETE_A);
    await poserActif(existants, false);
    try {
      const dernierId = await creerTemp(Role.admin_societe);

      const resultat = await retirerAccesInterne(
        CONTEXTE_ADMS_A,
        dernierId,
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        motif: "dernier_administrateur",
      });
      const ligne = await ligneHabilitation(dernierId, SOCIETE_A);
      expect(ligne?.actif).toBe(true);
    } finally {
      await poserActif(existants, true);
    }
  });

  it("refuse même quand l'appelant se vise lui-même", async () => {
    const existants = await administrateursActifs(SOCIETE_A);
    const autres = existants.filter((id) => id !== ADMS_A);
    await poserActif(autres, false);
    try {
      const resultat = await retirerAccesInterne(
        CONTEXTE_ADMS_A,
        ADMS_A,
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        motif: "dernier_administrateur",
      });
      const ligne = await ligneHabilitation(ADMS_A, SOCIETE_A);
      expect(ligne?.actif).toBe(true);
    } finally {
      await poserActif(autres, true);
    }
  });

  it("n'est PAS le dernier : l'administrateur se retire lui-même quand un autre reste", async () => {
    const avant = await administrateursActifs(SOCIETE_A);
    expect(avant.length).toBeGreaterThan(1);
    try {
      const resultat = await retirerAccesInterne(
        CONTEXTE_ADMS_A,
        ADMS_A,
        clientApp(),
      );
      expect(resultat).toEqual({ accepte: true });
      const ligne = await ligneHabilitation(ADMS_A, SOCIETE_A);
      expect(ligne?.actif).toBe(false);
    } finally {
      await poserActif([ADMS_A], true);
    }
  });
});
