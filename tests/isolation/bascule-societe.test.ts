import { afterAll, describe, expect, it } from "vitest";

import { motifRefusContexte } from "@/lib/auth/contexte";
import { motifRefusUniforme } from "@/lib/auth/reponse-uniforme";
import { Role } from "@/lib/auth/roles";
import { basculerSociete } from "@/lib/auth/societe-active";
import { uuidv7 } from "@/lib/db/uuid";

import { avecSocieteEtRole, clientApp, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * Bascule de société active (critères d'acceptation de L0-06) :
 * « un utilisateur habilité sur A ne peut pas basculer sur B ; tout changement
 * de société active est journalisé ».
 *
 * Les scénarios tournent sous le rôle applicatif réel, contre la vraie base :
 * l'habilitation est relue à travers les politiques RLS, comme en production.
 */

/** Crée une session serveur vierge pour un compte, et renvoie son identifiant. */
async function ouvrirSession(utilisateurId: string): Promise<string> {
  const id = uuidv7();
  await clientApp().session.create({
    data: {
      id,
      token: `jeton-${id}`,
      utilisateur_id: utilisateurId,
      expire_le: new Date("2030-01-01T00:00:00Z"),
      modifie_le: new Date("2026-08-20T00:00:00Z"),
    },
  });
  return id;
}

async function journalDe(utilisateurId: string) {
  return clientApp().journalAcces.findMany({
    where: { utilisateur_id: utilisateurId },
    orderBy: { horodatage: "asc" },
  });
}

describe("bascule de société — habilitation", () => {
  afterAll(fermerClients);

  it("un utilisateur habilité sur A bascule sur A, et son rôle est relu en base", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.adv];
    const sessionId = await ouvrirSession(utilisateurId);

    const resultat = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) {
      return;
    }
    // Le rôle n'a pas été fourni par l'appelant : il vient de la base.
    expect(resultat.contexte.role).toBe(Role.adv);

    const session = await clientApp().session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.societe_id_active).toBe(SOCIETE_A);
    expect(session.role_actif).toBe(Role.adv);
  });

  it("le même utilisateur ne peut PAS basculer sur B, et la session reste sur A", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.technicien];
    const sessionId = await ouvrirSession(utilisateurId);

    const accepte = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(accepte.accepte).toBe(true);

    const refuse = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_B,
        societeIdSource: SOCIETE_A,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    expect(refuse.accepte).toBe(false);
    if (refuse.accepte) {
      return;
    }
    // D35 — le motif rendu à l'appelant est le motif UNIFORME : dire « aucune
    // habilitation » ici reviendrait à confirmer que la société B existe et que
    // ce compte n'en est pas. Le motif réel est au journal, qui est interne, et
    // `reponses-indiscernables.test.ts` éprouve les trois cas ensemble.
    expect(refuse.motif).toBe(motifRefusUniforme());

    const session = await clientApp().session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.societe_id_active).toBe(SOCIETE_A);
  });

  it("un rôle éditeur n'est habilité sur aucune société (§22.5)", async () => {
    for (const role of [
      Role.admin_plateforme,
      Role.editeur_commercial,
      Role.editeur_support,
    ]) {
      const utilisateurId = UTILISATEUR_PAR_ROLE[role];
      const sessionId = await ouvrirSession(utilisateurId);

      for (const societeId of [SOCIETE_A, SOCIETE_B]) {
        const resultat = await basculerSociete(
          {
            utilisateurId,
            sessionId,
            societeId,
            societeIdSource: null,
            secondFacteurValide: true,
          },
          clientApp(),
        );
        expect(resultat.accepte, `${role} sur ${societeId}`).toBe(false);
      }
    }
  });

  it("un compte portail bascule sur sa société, avec le rôle `client` (D10)", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.client];
    const sessionId = await ouvrirSession(utilisateurId);

    const resultat = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    expect(resultat.accepte).toBe(true);
    if (resultat.accepte) {
      expect(resultat.contexte.role).toBe(Role.client);
    }
  });
});

describe("bascule de société — second facteur", () => {
  afterAll(fermerClients);

  it("refuse `admin_societe` sans second facteur, l'accepte avec (D40)", async () => {
    // Il administre les comptes ET les habilitations de sa société : le
    // compromettre permet de se créer un accès n'importe où chez ce client.
    // C'est le seul rôle de la liste dont la contrainte pèse sur l'utilisateur
    // d'un client, et non sur l'un des nôtres.
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.admin_societe];
    const sessionId = await ouvrirSession(utilisateurId);

    const sans = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(sans.accepte).toBe(false);
    if (!sans.accepte) {
      expect(sans.motif).toContain("second facteur");
    }

    const avec = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: true,
      },
      clientApp(),
    );
    expect(avec.accepte).toBe(true);
  });

  it("refuse `direction` sans second facteur, l'accepte avec", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.direction];
    const sessionId = await ouvrirSession(utilisateurId);

    const sans = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(sans.accepte).toBe(false);
    if (!sans.accepte) {
      expect(sans.motif).toContain("second facteur");
    }

    const avec = await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: true,
      },
      clientApp(),
    );
    expect(avec.accepte).toBe(true);
  });
});

describe("bascule de société — journalisation (D32)", () => {
  afterAll(fermerClients);

  it("journalise l'acceptation, avec la société d'avant et celle d'après", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.responsable_sav];
    const sessionId = await ouvrirSession(utilisateurId);

    await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    const journal = await journalDe(utilisateurId);
    expect(journal).toHaveLength(1);
    expect(journal[0]?.evenement).toBe("bascule_societe");
    expect(journal[0]?.societe_id_cible).toBe(SOCIETE_A);
    expect(journal[0]?.societe_id_source).toBeNull();
    expect(journal[0]?.role).toBe(Role.responsable_sav);
  });

  it("journalise aussi le REFUS — un refus non tracé ne se voit jamais", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.responsable_materiel];
    const sessionId = await ouvrirSession(utilisateurId);

    await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_B,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    const journal = await journalDe(utilisateurId);
    expect(journal).toHaveLength(1);
    expect(journal[0]?.evenement).toBe("bascule_refusee");
    expect(journal[0]?.societe_id_cible).toBe(SOCIETE_B);
  });

  it("le journal est en ajout seul : ni correction ni effacement", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.adv];
    const sessionId = await ouvrirSession(utilisateurId);
    await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );

    const [ligne] = await journalDe(utilisateurId);
    expect(ligne).toBeDefined();

    await expect(
      clientApp().journalAcces.update({
        where: { id: ligne!.id },
        data: { detail: "réécriture" },
      }),
    ).rejects.toThrow(/permission denied|denied/i);

    await expect(
      clientApp().journalAcces.delete({ where: { id: ligne!.id } }),
    ).rejects.toThrow(/permission denied|denied/i);
  });
});

describe("la société de la session est ce qui alimente app.societe_id", () => {
  afterAll(fermerClients);

  it("après bascule, le contexte lu depuis la session ouvre bien la société", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.direction];
    const sessionId = await ouvrirSession(utilisateurId);

    await basculerSociete(
      {
        utilisateurId,
        sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: true,
      },
      clientApp(),
    );

    const session = await clientApp().session.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const contexte = {
      utilisateurId,
      societeId: session.societe_id_active,
      role: session.role_actif,
      secondFacteurValide: true,
      adresseIp: null,
    };
    expect(motifRefusContexte(contexte)).toBeNull();

    const agences = await avecSocieteEtRole(
      contexte.societeId,
      contexte.role,
      (tx) => tx.agence.findMany({ select: { id: true } }),
    );
    expect(agences.map((agence) => agence.id)).toEqual([AGENCE_A]);
  });

  it("une session sans société active ne lit rien de cloisonné", async () => {
    const utilisateurId = UTILISATEUR_PAR_ROLE[Role.adv];
    const sessionId = await ouvrirSession(utilisateurId);

    const session = await clientApp().session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.societe_id_active).toBeNull();

    const contexte = {
      utilisateurId,
      societeId: session.societe_id_active,
      role: session.role_actif,
      secondFacteurValide: false,
      adresseIp: null,
    };
    // L'application refuse d'ouvrir la transaction…
    expect(motifRefusContexte(contexte)).toContain("Aucune société active");
    // …et la base, à qui l'on force la main, ne rend rien.
    const agences = await avecSocieteEtRole(null, null, (tx) =>
      tx.agence.findMany({ select: { id: true } }),
    );
    expect(agences).toEqual([]);
  });
});
