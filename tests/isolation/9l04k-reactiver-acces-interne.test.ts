import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerCompteDeBureau } from "@/lib/auth/acces-bureau";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { basculerSociete } from "@/lib/auth/societe-active";
import {
  retablirAccesInterne,
  retirerAccesInterne,
  RefusRetablissementAcces,
} from "@/lib/auth/retrait-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { techniciensAccesAOuvrir } from "@/lib/tableau-de-bord/lectures";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9L04K-REACTIVER-ACCES-INTERNE — RÉ-ACCORDER L'ACCÈS D'UN COMPTE INTERNE
 * RETIRÉ (D251, 9L03C).
 *
 * Deux chemins mesurés : le bouton direct de la ligne « Accès retiré »
 * (`retablirAccesInterne`, `lib/auth/retrait-acces.ts`), et le chemin de
 * création resoumis avec la même adresse (`creerCompteDeBureau`,
 * `creerTechnicien`) — exactement le résidu laissé ouvert par la passation
 * de 9L03C.
 *
 * Toutes les fixtures créées ici portent le préfixe `zz9l04k-` et sont
 * détruites par `afterEach` — même patron que
 * `tests/isolation/retrait-acces-interne.test.ts`.
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

const PREFIXE = "zz9l04k-";
function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

async function creerCompteBureauTemp(
  role: Role,
  societeId = SOCIETE_A,
): Promise<{ readonly utilisateurId: string; readonly courriel: string }> {
  const courrielCree = courriel();
  const cree = await creerCompteDeBureau(
    { ...CONTEXTE_ADMS_A, societeId },
    { nom: "9L04K Temporaire", courriel: courrielCree, role },
    clientApp(),
  );
  expect(cree.accepte).toBe(true);
  if (!cree.accepte) {
    throw new Error("fixture 9L04K non créée");
  }
  return { utilisateurId: cree.utilisateurId, courriel: courrielCree };
}

/** Même enveloppe de production que `tests/isolation/bascule-societe.test.ts`. */
async function poserSession(utilisateurId: string): Promise<string> {
  const id = uuidv7();
  const token = `jeton-${id}`;
  await avecDesignationAuth(clientApp()).session.create({
    data: {
      id,
      token,
      utilisateur_id: utilisateurId,
      expire_le: new Date("2030-01-01T00:00:00Z"),
      modifie_le: new Date("2026-08-20T00:00:00Z"),
    },
  });
  return token;
}

async function ligneHabilitation(
  utilisateurId: string,
  societeId: string,
): Promise<{ actif: boolean; role: string } | undefined> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    { actif: boolean; role: string }[]
  >(
    `SELECT actif, role::text FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid AND societe_id = $2::uuid`,
    utilisateurId,
    societeId,
  );
  return ligne;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "session" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE utilisateur_id IN (SELECT id FROM "utilisateur" WHERE email LIKE $1)`,
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

describe("retablirAccesInterne — le bouton direct de la ligne « Accès retiré »", () => {
  it("réactive la ligne dans SA société, SANS toucher au rôle qu'elle portait", async () => {
    const { utilisateurId } = await creerCompteBureauTemp(Role.adv);
    const retrait = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      utilisateurId,
      clientApp(),
    );
    expect(retrait.accepte).toBe(true);
    expect((await ligneHabilitation(utilisateurId, SOCIETE_A))?.actif).toBe(
      false,
    );

    const resultat = await retablirAccesInterne(
      CONTEXTE_ADMS_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const ligne = await ligneHabilitation(utilisateurId, SOCIETE_A);
    expect(ligne?.actif).toBe(true);
    expect(ligne?.role).toBe(Role.adv);
  });

  it("une cible d'une AUTRE société rend « introuvable », rien n'est écrit", async () => {
    const { utilisateurId } = await creerCompteBureauTemp(Role.adv, SOCIETE_B);
    await retirerAccesInterne(
      { ...CONTEXTE_ADMS_A, societeId: SOCIETE_B },
      utilisateurId,
      clientApp(),
    );

    const resultat = await retablirAccesInterne(
      CONTEXTE_ADMS_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
    expect((await ligneHabilitation(utilisateurId, SOCIETE_B))?.actif).toBe(
      false,
    );
  });

  it("une ligne déjà ACTIVE rend « deja_membre », sans rien changer", async () => {
    const { utilisateurId } = await creerCompteBureauTemp(Role.adv);

    const resultat = await retablirAccesInterne(
      CONTEXTE_ADMS_A,
      utilisateurId,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
  });

  it("un rôle sans `administrer_utilisateurs` est refusé avant toute écriture", async () => {
    const { utilisateurId } = await creerCompteBureauTemp(Role.adv);
    await retirerAccesInterne(CONTEXTE_ADMS_A, utilisateurId, clientApp());
    const ADV_A = UTILISATEUR_PAR_ROLE[Role.adv];

    await expect(
      retablirAccesInterne(
        {
          utilisateurId: ADV_A,
          societeId: SOCIETE_A,
          role: Role.adv,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: null,
        },
        utilisateurId,
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusRetablissementAcces);

    expect((await ligneHabilitation(utilisateurId, SOCIETE_A))?.actif).toBe(
      false,
    );
  });

  it("après rétablissement, une connexion ouvre à nouveau la société", async () => {
    const { utilisateurId } = await creerCompteBureauTemp(Role.adv);
    await retirerAccesInterne(CONTEXTE_ADMS_A, utilisateurId, clientApp());
    await retablirAccesInterne(CONTEXTE_ADMS_A, utilisateurId, clientApp());
    const token = await poserSession(utilisateurId);

    const bascule = await basculerSociete(
      {
        utilisateurId,
        jetonSession: token,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);
  });
});

describe("creerCompteDeBureau — resoumis avec la même adresse, il réactive plutôt que de refuser", () => {
  it("une ligne INACTIVE se réactive, avec le RÔLE de ce formulaire", async () => {
    const { utilisateurId, courriel: courrielCree } =
      await creerCompteBureauTemp(Role.adv);
    await retirerAccesInterne(CONTEXTE_ADMS_A, utilisateurId, clientApp());

    const resultat = await creerCompteDeBureau(
      CONTEXTE_ADMS_A,
      {
        nom: "Nom ignoré",
        courriel: courrielCree,
        role: Role.responsable_sav,
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: true,
      utilisateurId,
      rattache: true,
    });

    const ligne = await ligneHabilitation(utilisateurId, SOCIETE_A);
    expect(ligne?.actif).toBe(true);
    expect(ligne?.role).toBe(Role.responsable_sav);
  });

  it("une ligne ACTIVE garde son refus `deja_membre`, inchangé", async () => {
    const { courriel: courrielCree } = await creerCompteBureauTemp(Role.adv);

    const resultat = await creerCompteDeBureau(
      CONTEXTE_ADMS_A,
      { nom: "Nom ignoré", courriel: courrielCree, role: Role.direction },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
  });
});

describe("creerTechnicien — resoumis avec la même adresse, il réactive plutôt que de refuser", () => {
  async function creerTechnicienTemp(): Promise<{
    readonly utilisateurId: string;
    readonly courriel: string;
  }> {
    const courrielCree = courriel();
    const cree = await creerTechnicien(
      CONTEXTE_ADMS_A,
      {
        nom: "9L04K Technicien",
        email: courrielCree,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) {
      throw new Error("fixture 9L04K non créée");
    }
    return { utilisateurId: cree.utilisateurId, courriel: courrielCree };
  }

  it("une ligne INACTIVE se réactive ; la fiche `technicien` n'est jamais recréée ni modifiée", async () => {
    const { utilisateurId, courriel: courrielCree } =
      await creerTechnicienTemp();
    await retirerAccesInterne(CONTEXTE_ADMS_A, utilisateurId, clientApp());

    const resultat = await creerTechnicien(
      CONTEXTE_ADMS_A,
      {
        nom: "Nom ignoré",
        email: courrielCree,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "patente",
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: true,
      utilisateurId,
      rattache: true,
    });

    const ligne = await ligneHabilitation(utilisateurId, SOCIETE_A);
    expect(ligne?.actif).toBe(true);
    expect(ligne?.role).toBe(Role.technicien);

    // LA FICHE `technicien` GARDE SON STATUT D'ORIGINE (« salarié ») — le
    // formulaire resoumis (« patenté ») n'est jamais appliqué à une ligne
    // déjà existante (voir l'en-tête d'`habiliterEtRattacherDans`).
    const [fiche] = await clientOwner().$queryRawUnsafe<
      { statut_ressource: string }[]
    >(
      `SELECT statut_ressource::text FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(fiche?.statut_ressource).toBe("salarie");
  });

  it("une ligne ACTIVE garde son refus `deja_membre`, inchangé", async () => {
    const { courriel: courrielCree } = await creerTechnicienTemp();

    const resultat = await creerTechnicien(
      CONTEXTE_ADMS_A,
      {
        nom: "Nom ignoré",
        email: courrielCree,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
  });
});

describe("techniciensAccesAOuvrir — la tuile « Accès à ouvrir » n'annonce jamais une ligne retirée", () => {
  it("un technicien dont l'accès a été RETIRÉ, jamais ouvert, ne grossit plus la tuile", async () => {
    const courrielCree = courriel();
    const cree = await creerTechnicien(
      CONTEXTE_ADMS_A,
      {
        nom: "9L04K Jamais Ouvert",
        email: courrielCree,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    // AVANT LE RETRAIT — jamais ouvert (`etat.etat === "aucun"`) : la tuile le
    // compte, exactement comme avant ce lot.
    const avant = await techniciensAccesAOuvrir(CONTEXTE_ADMS_A, clientApp());
    expect(avant.some((l) => l.utilisateurId === cree.utilisateurId)).toBe(
      true,
    );

    const retrait = await retirerAccesInterne(
      CONTEXTE_ADMS_A,
      cree.utilisateurId,
      clientApp(),
    );
    expect(retrait.accepte).toBe(true);

    // APRÈS LE RETRAIT — « Rétablir l'accès » est le geste à proposer, jamais
    // « ouvrir l'accès » : la tuile ne doit plus le compter.
    const apres = await techniciensAccesAOuvrir(CONTEXTE_ADMS_A, clientApp());
    expect(apres.some((l) => l.utilisateurId === cree.utilisateurId)).toBe(
      false,
    );
  });
});
