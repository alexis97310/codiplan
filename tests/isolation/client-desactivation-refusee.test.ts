import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  interventionsEmpechantDesactivationDuClient,
  type LigneBloquantDesactivation,
} from "@/lib/interventions/depot";
import { modifierClient } from "@/lib/clients/depot";
import { schemaModificationClient } from "@/lib/clients/saisie";
import { creerSite } from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";
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
 * QT-16 (D165, audit du 28/09/2026 ; précisions du pilote du 03/10/2026, à
 * valider par Alexis) — désactiver un client avec des interventions ouvertes
 * est REFUSÉ, en listant ces interventions.
 *
 * **« Ouvert », ici, n'est PAS `STATUTS_INTERVENTION_FERMES`** : une
 * `terminee` NON clôturée bloque la désactivation, parce qu'elle reste à
 * clôturer — c'est le point mesuré par le deuxième test ci-dessous, celui
 * qu'un gardien calé sur le compteur d'affichage de FICHE-360-1 laisserait
 * passer à tort.
 *
 * **Scène dédiée, jamais les fixtures partagées** (`CLIENT_A1`…) : ce fichier
 * désactive des clients, et le reste du harnais mesure `CLIENT_A1` ACTIF.
 */

afterAll(fermerClients);

const PREFIXE = "QT16-";

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const clientsEngendres: string[] = [];

afterEach(async () => {
  if (clientsEngendres.length === 0) return;
  const ids = clientsEngendres.splice(0, clientsEngendres.length);
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "client_id" = ANY($1::uuid[])`,
    ids,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "client_id" = ANY($1::uuid[])`,
    ids,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = ANY($1::uuid[])`,
    ids,
  );
});

async function creerClientEtSite(
  societeId: string,
  agenceId: string,
  actif = true,
): Promise<{ readonly clientId: string; readonly siteId: string }> {
  const clientId = uuidv7();
  const siteId = uuidv7();
  clientsEngendres.push(clientId);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
    clientId,
    societeId,
    `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    `${PREFIXE}Client d'épreuve`,
    actif,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)`,
    siteId,
    societeId,
    clientId,
    agenceId,
    `${PREFIXE}Site d'épreuve`,
  );
  return { clientId, siteId };
}

async function poserIntervention(
  societeId: string,
  agenceId: string,
  clientId: string,
  siteId: string,
  statut: string,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', $6::"StatutIntervention", NULL, now())`,
    id,
    societeId,
    clientId,
    siteId,
    agenceId,
    statut,
  );
  return id;
}

function desactivation() {
  return schemaModificationClient.parse({ actif: false });
}

describe("modifierClient — le passage à inactif est refusé tant qu'une intervention reste ouverte (QT-16)", () => {
  it("TÉMOIN — un client sans aucune intervention se désactive sans refus", async () => {
    const { clientId } = await creerClientEtSite(SOCIETE_A, AGENCE_A);

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("refuse la désactivation d'un client avec une intervention OUVERTE (file d'attente), et liste cette intervention", async () => {
    const { clientId, siteId } = await creerClientEtSite(SOCIETE_A, AGENCE_A);
    const interventionId = await poserIntervention(
      SOCIETE_A,
      AGENCE_A,
      clientId,
      siteId,
      "a_planifier",
    );

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "interventions_ouvertes",
    });

    const bloquantes: readonly LigneBloquantDesactivation[] =
      await interventionsEmpechantDesactivationDuClient(
        ADMIN_A,
        clientId,
        clientApp(),
      );
    expect(bloquantes.map((ligne) => ligne.id)).toEqual([interventionId]);
  });

  it("une TERMINÉE non clôturée bloque AUSSI — choix du pilote du 03/10/2026 : elle reste à clôturer", async () => {
    const { clientId, siteId } = await creerClientEtSite(SOCIETE_A, AGENCE_A);
    await poserIntervention(SOCIETE_A, AGENCE_A, clientId, siteId, "terminee");

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "interventions_ouvertes",
    });
  });

  it("n'est PAS bloquée par des interventions seulement CLÔTURÉES ou ANNULÉES", async () => {
    const { clientId, siteId } = await creerClientEtSite(SOCIETE_A, AGENCE_A);
    await poserIntervention(SOCIETE_A, AGENCE_A, clientId, siteId, "cloturee");
    await poserIntervention(SOCIETE_A, AGENCE_A, clientId, siteId, "annulee");

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("le MAINTIEN d'un client DÉJÀ inactif reste accepté, même avec une intervention ouverte (même précédent que D134 pour l'agence)", async () => {
    const { clientId, siteId } = await creerClientEtSite(
      SOCIETE_A,
      AGENCE_A,
      false,
    );
    await poserIntervention(
      SOCIETE_A,
      AGENCE_A,
      clientId,
      siteId,
      "a_planifier",
    );

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("un client d'une AUTRE société est introuvable — jamais « interventions_ouvertes », qui en apprendrait l'existence", async () => {
    const { clientId, siteId } = await creerClientEtSite(SOCIETE_B, AGENCE_B);
    await poserIntervention(
      SOCIETE_B,
      AGENCE_B,
      clientId,
      siteId,
      "a_planifier",
    );

    const resultat = await modifierClient(
      ADMIN_A,
      clientId,
      desactivation(),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "client_introuvable",
    });
  });
});

describe("creerSite — refuse un client inactif (QT-16)", () => {
  function saisieSite(clientId: string, agenceId: string) {
    const analyse = schemaCreationSite.safeParse({
      client_id: clientId,
      agence_id: agenceId,
      libelle: `${PREFIXE}Nouveau site`,
    });
    if (!analyse.success) {
      throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
    }
    return analyse.data;
  }

  it("TÉMOIN — un client ACTIF accepte la création d'un nouveau site", async () => {
    const { clientId } = await creerClientEtSite(SOCIETE_A, AGENCE_A);

    const resultat = await creerSite(
      ADMIN_A,
      saisieSite(clientId, AGENCE_A),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("refuse la création d'un site sur un client INACTIF", async () => {
    const { clientId } = await creerClientEtSite(SOCIETE_A, AGENCE_A, false);

    const resultat = await creerSite(
      ADMIN_A,
      saisieSite(clientId, AGENCE_A),
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "client_inactif" });
  });
});
