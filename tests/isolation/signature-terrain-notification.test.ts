import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Role } from "@/lib/auth/roles";
import { alerterResponsablesSAV } from "@/lib/avertissements/signature-terrain";
import { uuidv7 } from "@/lib/db/uuid";
import { listerNotifications } from "@/lib/notifications/depot";

import { clientApp, clientOwner, fermerClients, sousSociete } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9J11-NOTIFICATIONS-PRODUCTEUR-SIGNATURE — SIGNATURE ABSENTE OU REFUSÉE POSE
 * AUSSI UNE NOTIFICATION INTERNE, SANS TOUCHER AU COURRIEL EXISTANT (9DE-TP-CY1).
 *
 * Le courriel au `responsable_sav` existe depuis 9DE-TP-CY1 ; ce ticket
 * n'y change rien — `tests/isolation/avertissements-logo-en-echec.test.ts` le
 * prouve déjà, et reste vert (épreuve non régressée). Ce fichier prouve le
 * SEUL ajout : une ligne `Notification` lisible par un `responsable_sav`,
 * avec son journal d'envoi posé depuis le résultat RÉEL de `envoyerCourriel`.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-signature-notification",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

const CONTEXTE = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_RESPONSABLE_SAV = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.responsable_sav],
  societeId: SOCIETE_A,
  role: Role.responsable_sav,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function coupleFetchDeTest(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "test-signature-notification" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

async function creerLigne(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'affectee'::"StatutIntervention", $6::uuid, '2026-11-02'::date,
             '2026-11-02T08:00:00.000Z'::timestamptz, 60, now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    UTILISATEUR_PAR_ROLE[Role.technicien],
  );
}

async function supprimerLigne(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
    id,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    id,
  );
}

afterAll(fermerClients);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("alerterResponsablesSAV pose aussi une notification interne", () => {
  let interventionId = "";

  beforeEach(async () => {
    interventionId = uuidv7();
    await creerLigne(interventionId);
  });

  afterEach(() => supprimerLigne(interventionId));

  it("une signature refusée pose une ligne lisible par un responsable_sav, et le courriel part toujours", async () => {
    coupleFetchDeTest();

    const etat = await alerterResponsablesSAV(
      CONTEXTE,
      interventionId,
      "refus_signature",
      "motif de test",
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    // ÉPREUVE NON RÉGRESSÉE : le courriel part toujours, comme avant ce ticket.
    expect(etat.type).toBe("envoyee");

    const vues = await listerNotifications(
      CONTEXTE_RESPONSABLE_SAV,
      clientApp(),
    );
    const laNotre = vues.find((n) => n.interventionId === interventionId);
    expect(laNotre).toBeDefined();
    expect(laNotre?.evenement).toBe("signature_absente_ou_refusee");
    expect(laNotre?.lueLe).toBeNull();

    const ligne = await sousSociete(SOCIETE_A, (tx) =>
      tx.notification.findFirstOrThrow({
        where: { intervention_id: interventionId },
        select: { canal: true, tentee_le: true, partie: true },
      }),
    );
    expect(ligne.canal).toBe("courriel");
    expect(ligne.tentee_le).not.toBeNull();
    expect(ligne.partie).toBe(true);
  });

  it("un technicien, sans la capacité `valider_rapport`, ne voit pas la notification", async () => {
    coupleFetchDeTest();

    await alerterResponsablesSAV(
      CONTEXTE,
      interventionId,
      "client_absent",
      "motif de test",
      clientApp(),
      COURRIEL_ENVIRONNEMENT,
    );

    const vuesParTechnicien = await listerNotifications(
      {
        utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
        societeId: SOCIETE_A,
        role: Role.technicien,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: null,
      },
      clientApp(),
    );
    expect(
      vuesParTechnicien.find((n) => n.interventionId === interventionId),
    ).toBeUndefined();
  });
});
