import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerAgence, modifierAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { deposerDemande } from "@/lib/demandes/depot";
import type { Depot } from "@/lib/demandes/saisie";
import { creerInterventionsRepriseEnLot } from "@/lib/interventions/depot-reprise";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";
import {
  STATUT_FACTURATION_REPRISE,
  STATUT_REPRISE,
  TYPE_INTERVENTION_REPRISE,
} from "@/lib/imports/reprise";
import { creerMachine } from "@/lib/machines/depot";
import { schemaMachine } from "@/lib/machines/saisie";
import { creerSite } from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";
import { planifierLObservation } from "@/lib/vgp/observations";
import {
  enregistrerVerification,
  schemaVerificationVgp,
} from "@/lib/vgp/verification";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MODELE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * AGENCE-ACTIVE (9AZ-AA-6, décision d'Alexis du 26/09/2026) — la création
 * d'une intervention ou d'une demande sur un site rattaché à une agence
 * inactive est REFUSÉE.
 *
 * ## Le constat que ce fichier ferme
 *
 * `creerIntervention` (`lib/interventions/depot.ts`) et `deposerDemande`
 * (`lib/demandes/depot.ts`) contrôlaient déjà le client inactif et le
 * rattachement absent, jamais l'AGENCE inactive : un `site_id` posté sur un
 * lieu dont l'établissement a été désactivé après coup naissait quand même.
 * `planifierLObservation` (`lib/vgp/observations.ts`) hérite du même refus,
 * puisqu'elle appelle `creerIntervention` sans rien contrôler elle-même.
 *
 * ## Ce que ce fichier NE touche PAS, et pourquoi
 *
 * `creerInterventionsRepriseEnLot` (`lib/interventions/depot-reprise.ts`) est
 * la porte de l'ARCHIVE (D127) : une intervention reprise est un FAIT PASSÉ,
 * et un établissement aujourd'hui inactif ne rend pas fausse une visite qui a
 * eu lieu quand il l'était encore. Le témoin ci-dessous le montre inchangé.
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

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Un préfixe qui n'appartient qu'à ce fichier — le ménage s'y accroche. */
const PREFIXE = "AA6-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve AA-6",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function site(agenceId: string, surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationSite.safeParse({
    client_id: CLIENT_A1,
    agence_id: agenceId,
    libelle: `${PREFIXE}Site d'épreuve`,
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

/**
 * Un site AA6- rattaché à une agence ACTIVE **au moment du rattachement**,
 * agence désactivée ENSUITE — exactement le cas d'un rattachement déjà posé
 * qu'AA-2 (9AZ) laisse volontairement intact. `creerSite` refuserait la
 * création directe sur une agence déjà inactive (AA-2) : l'ordre ici n'est
 * donc pas un détail, c'est la seule façon de fabriquer ce cas.
 */
async function siteAvecAgenceDevenueInactive(): Promise<{
  readonly siteId: string;
  readonly agenceId: string;
}> {
  const agenceCreee = await creerAgence(
    ADMIN_A,
    agence({ actif: true }),
    clientApp(),
  );
  if (!agenceCreee.accepte) {
    throw new Error("création d'agence d'épreuve refusée");
  }
  const siteCree = await creerSite(
    ADMIN_A,
    site(agenceCreee.fiche.id),
    clientApp(),
  );
  if (!siteCree.accepte) {
    throw new Error("création de site d'épreuve refusée");
  }
  const desactivee = await modifierAgence(
    ADMIN_A,
    agenceCreee.fiche.id,
    { actif: false },
    clientApp(),
  );
  if (!desactivee.accepte) {
    throw new Error("désactivation d'agence d'épreuve refusée");
  }
  return { siteId: siteCree.fiche.id, agenceId: agenceCreee.fiche.id };
}

/** Les interventions et demandes engendrées par ce fichier — reprises au ménage. */
const interventionsEngendrees: string[] = [];
const demandesEngendrees: string[] = [];

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "vgp_observation"`);
  await clientOwner().$executeRawUnsafe(`DELETE FROM "vgp_verification"`);
  if (interventionsEngendrees.length > 0) {
    const ids = interventionsEngendrees.splice(
      0,
      interventionsEngendrees.length,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_machine" WHERE "intervention_id" = ANY($1::uuid[])`,
      ids,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      ids,
    );
  }
  if (demandesEngendrees.length > 0) {
    const ids = demandesEngendrees.splice(0, demandesEngendrees.length);
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = ANY($1::uuid[])`,
      ids,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "site_id" IN (SELECT "id" FROM "site" WHERE "libelle" LIKE '${PREFIXE}%')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "libelle" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

function saisieIntervention(siteId: string) {
  const id = uuidv7();
  interventionsEngendrees.push(id);
  return schemaCreation.parse({
    id,
    client_id: CLIENT_A1,
    site_id: siteId,
    type: "curatif",
    description: "Panne épreuve AA-6",
  });
}

function saisieDemande(siteId: string): Depot {
  const id = uuidv7();
  demandesEngendrees.push(id);
  return {
    id,
    source: "appel",
    client_id: CLIENT_A1,
    site_id: siteId,
    machine_id: null,
    contact_id: null,
    description: "Demande d'épreuve AA-6",
    urgence: "p3",
    machine_arretee: false,
    date_souhaitee: null,
  };
}

describe("creerIntervention — refus d'un site rattaché à une agence inactive", () => {
  it("TÉMOIN — la même saisie sur un site d'une agence ACTIVE est acceptée", async () => {
    const resultat = await creerIntervention(
      SESSION,
      saisieIntervention(SITE_A1_S1),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("est refusée, avec un motif qui nomme l'agence inactive", async () => {
    const { siteId } = await siteAvecAgenceDevenueInactive();

    const resultat = await creerIntervention(
      SESSION,
      saisieIntervention(siteId),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.agence_inactive",
    });
  });
});

describe("deposerDemande — refus d'un site rattaché à une agence inactive", () => {
  it("TÉMOIN — la même saisie sur un site d'une agence ACTIVE est acceptée", async () => {
    const resultat = await deposerDemande(
      SESSION,
      saisieDemande(SITE_A1_S1),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("est refusée, avec un motif qui nomme l'agence inactive", async () => {
    const { siteId } = await siteAvecAgenceDevenueInactive();

    const resultat = await deposerDemande(
      SESSION,
      saisieDemande(siteId),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "demande.refus.agence_inactive",
    });
  });
});

describe("planifierLObservation — hérite du refus de creerIntervention", () => {
  it("est refusée quand le site de l'observation dépend d'une agence inactive", async () => {
    const { siteId } = await siteAvecAgenceDevenueInactive();

    const machine = await creerMachine(
      ADMIN_A,
      schemaMachine.parse({
        modele_id: MODELE_A,
        client_id: CLIENT_A1,
        site_id: siteId,
        numero_serie: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
      }),
      clientApp(),
    );
    expect(machine.accepte).toBe(true);
    if (!machine.accepte) return;
    const machineId = machine.id;

    const fiche = await enregistrerVerification(
      SESSION,
      schemaVerificationVgp.parse({
        machine_id: machineId,
        date_verification: new Date("2026-03-14T00:00:00.000Z"),
        organisme: "APAVE",
        reference_rapport: "RAP-AA6-0001",
        origine: "rapport_organisme",
        observations: ["Jeu au vérin — épreuve AA-6"],
      }),
      clientApp(),
    );
    const observationId = fiche.observations[0]?.id ?? "";

    const porte = await planifierLObservation(
      SESSION,
      {
        observationId,
        clientId: CLIENT_A1,
        siteId,
        machineId,
      },
      clientApp(),
    );
    expect(porte).toEqual({ refus: "intervention.refus.agence_inactive" });
  });
});

describe("la reprise d'archive reste un chemin séparé, non touché par ce refus", () => {
  it("creerInterventionsRepriseEnLot accepte un site d'une agence inactive", async () => {
    const { siteId, agenceId } = await siteAvecAgenceDevenueInactive();

    const id = uuidv7();
    interventionsEngendrees.push(id);
    await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        creerInterventionsRepriseEnLot(tx, SOCIETE_A, [
          {
            id,
            saisie: {
              date: new Date("2019-05-14T00:00:00.000Z"),
              type_document: "BI",
              numero_document: "BI-AA6-0001",
              client_id: CLIENT_A1,
              site_id: siteId,
              agence_id: agenceId,
              machine_id: null,
              reference_or: null,
              technicien: null,
              objet: "Reprise d'archive — épreuve AA-6",
              montant_ht: null,
              devise_code: null,
            },
          },
        ]),
      clientApp(),
    );

    const lignes = await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        tx.intervention.findMany({
          where: { id },
          select: {
            id: true,
            statut: true,
            statut_facturation: true,
            type: true,
          },
        }),
      clientApp(),
    );
    expect(lignes).toEqual([
      {
        id,
        statut: STATUT_REPRISE,
        statut_facturation: STATUT_FACTURATION_REPRISE,
        type: TYPE_INTERVENTION_REPRISE,
      },
    ]);
  });
});
