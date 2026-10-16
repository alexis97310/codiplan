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
import { avertirApresAnnulation } from "@/lib/avertissements/annulation";
import {
  avertirApresPlanification,
  avertirApresTransmissionGroupee,
} from "@/lib/avertissements/planification";
import { alerterResponsablesSAV } from "@/lib/avertissements/signature-terrain";
import { uuidv7 } from "@/lib/db/uuid";
import type { EtatAvantPlanification } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE LOGO NE BLOQUE NI LE GESTE NI L'ENVOI (point 1,
 * 9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE) — pour les QUATRE déclencheurs de
 * `lib/avertissements/`, une lecture du logo qui lève une erreur ne doit
 * jamais empêcher le courriel de partir : il part SANS image, et l'échec est
 * tracé (`console.error`), jamais avalé en silence.
 *
 * `lireLogoEtRaisonSocialePourCourriel` (`lib/societes/logo.ts`) est, sur ce
 * chemin, la SEULE appelante de `societe.findFirst` : la simuler en échec ici
 * simule PRÉCISÉMENT la lecture du logo, rien d'autre — aucune des requêtes
 * qui composent le reste du courriel (intervention, contact, utilisateur)
 * n'interroge le modèle `societe` directement.
 *
 * Avant ce ticket, cette même panne aurait fait échouer TOUTE la composition
 * — ces quatre tests auraient vu `avertirApres*`/`alerterResponsablesSAV`
 * REJETER, et aucun courriel ne serait parti, pas même sans logo.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-logo-echec",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

type CorpsResend = {
  to: readonly string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: readonly unknown[];
};

function coupleFetchDeTest(): { envois: CorpsResend[] } {
  const envois: CorpsResend[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body ?? "{}")) as CorpsResend;
      envois.push(corps);
      return new Response(
        JSON.stringify({ id: `test-logo-echec-${envois.length}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { envois };
}

/**
 * Simule un échec de lecture du logo.
 *
 * `lireLogoEtRaisonSocialePourCourriel` ouvre sa PROPRE transaction (point 1),
 * SÉPARÉE de celle qui compose le reste du courriel — c'est précisément ce
 * que ce test vérifie. Espionner `societe.findFirst` directement ne mord pas :
 * une transaction interactive Prisma (`$transaction(async (tx) => …)`) rend un
 * `tx` dont les délégués de modèle sont DISTINCTS de ceux du client — la
 * panne doit donc se poser plus haut, sur `$transaction` lui-même, et viser
 * SPÉCIFIQUEMENT le DEUXIÈME appel : dans chacune des quatre fonctions
 * éprouvées ici, le premier `$transaction` compose le reste du courriel (il
 * doit réussir), le second lit le logo (lui seul doit échouer).
 */
function simulerEchecDeLectureDuLogo(): void {
  const client = clientApp();
  const original = client.$transaction.bind(client) as (
    ...args: Parameters<typeof client.$transaction>
  ) => ReturnType<typeof client.$transaction>;
  let appel = 0;
  vi.spyOn(client, "$transaction").mockImplementation(((
    ...args: Parameters<typeof client.$transaction>
  ) => {
    appel += 1;
    if (appel === 2) {
      return Promise.reject(new Error("panne de test — lecture du logo"));
    }
    return original(...args);
  }) as typeof client.$transaction);
}

async function email(utilisateurId: string): Promise<string> {
  const utilisateur = await clientOwner().utilisateur.findFirstOrThrow({
    where: { id: utilisateurId },
    select: { email: true },
  });
  return utilisateur.email;
}

afterAll(fermerClients);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

const CONTEXTE = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

async function creerLigne(
  id: string,
  statut: "affectee" | "annulee",
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", $7::uuid, '2026-11-02'::date,
             '2026-11-02T08:00:00.000Z'::timestamptz, 60, now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    statut,
    TECHNICIEN,
  );
}

async function supprimerLigne(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    id,
  );
}

describe("une lecture du logo en échec ne bloque ni le geste ni l'envoi", () => {
  describe("avertirApresAnnulation", () => {
    let interventionId = "";

    beforeEach(async () => {
      interventionId = uuidv7();
      await creerLigne(interventionId, "annulee");
    });

    afterEach(() => supprimerLigne(interventionId));

    it("le technicien reçoit quand même son courriel, sans image, et la trace existe", async () => {
      const { envois } = coupleFetchDeTest();
      const traces = vi.spyOn(console, "error").mockImplementation(() => {});
      simulerEchecDeLectureDuLogo();

      const avant: EtatAvantPlanification = {
        statut: "affectee",
        technicienId: TECHNICIEN,
        datePlanifiee: new Date("2026-11-02T00:00:00.000Z"),
        creneauDebut: null,
      };

      const compteRendu = await avertirApresAnnulation(
        CONTEXTE,
        interventionId,
        avant,
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      expect(compteRendu?.technicien).toEqual({ type: "parti" });
      const emailTechnicien = await email(TECHNICIEN);
      const envoi = envois.find((e) => e.to.includes(emailTechnicien));
      expect(envoi).toBeDefined();
      expect(envoi?.attachments).toBeUndefined();
      expect(traces).toHaveBeenCalled();
    });
  });

  describe("avertirApresPlanification", () => {
    let interventionId = "";

    beforeEach(async () => {
      interventionId = uuidv7();
      await creerLigne(interventionId, "affectee");
    });

    afterEach(() => supprimerLigne(interventionId));

    it("TRANSMETTRE : le technicien reçoit quand même son courriel, sans image, et la trace existe", async () => {
      const { envois } = coupleFetchDeTest();
      const traces = vi.spyOn(console, "error").mockImplementation(() => {});
      simulerEchecDeLectureDuLogo();

      const avant: EtatAvantPlanification = {
        statut: "planifiee",
        technicienId: TECHNICIEN,
        datePlanifiee: new Date("2026-11-02T00:00:00.000Z"),
        creneauDebut: null,
      };

      const compteRendu = await avertirApresPlanification(
        CONTEXTE,
        interventionId,
        avant,
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      expect(compteRendu?.technicien).toEqual({ type: "parti" });
      const emailTechnicien = await email(TECHNICIEN);
      const envoi = envois.find((e) => e.to.includes(emailTechnicien));
      expect(envoi).toBeDefined();
      expect(envoi?.attachments).toBeUndefined();
      expect(traces).toHaveBeenCalled();
    });
  });

  describe("avertirApresTransmissionGroupee", () => {
    let interventionId = "";

    beforeEach(async () => {
      interventionId = uuidv7();
      await creerLigne(interventionId, "affectee");
    });

    afterEach(() => supprimerLigne(interventionId));

    it("le récapitulatif part quand même, sans image, et la trace existe", async () => {
      const { envois } = coupleFetchDeTest();
      const traces = vi.spyOn(console, "error").mockImplementation(() => {});
      simulerEchecDeLectureDuLogo();

      const comptesRendus = await avertirApresTransmissionGroupee(
        CONTEXTE,
        [interventionId],
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      expect(comptesRendus).toHaveLength(1);
      expect(comptesRendus[0]?.envoi).toEqual({ type: "parti" });
      const emailTechnicien = await email(TECHNICIEN);
      const envoi = envois.find((e) => e.to.includes(emailTechnicien));
      expect(envoi).toBeDefined();
      expect(envoi?.attachments).toBeUndefined();
      expect(traces).toHaveBeenCalled();
    });
  });

  describe("alerterResponsablesSAV", () => {
    let interventionId = "";

    beforeEach(async () => {
      interventionId = uuidv7();
      await creerLigne(interventionId, "affectee");
    });

    afterEach(() => supprimerLigne(interventionId));

    it("l'alerte part quand même au responsable SAV, sans image, et la trace existe", async () => {
      const { envois } = coupleFetchDeTest();
      const traces = vi.spyOn(console, "error").mockImplementation(() => {});
      simulerEchecDeLectureDuLogo();

      const etat = await alerterResponsablesSAV(
        CONTEXTE,
        interventionId,
        "client_absent",
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      // PAS `nombre: 1` — `alerterResponsablesSAV` écrit à CHAQUE
      // `responsable_sav` de la société, une population PARTAGÉE par tout le
      // run d'isolation (`fileParallelism: false` n'empêche pas un autre
      // fichier d'en laisser un de plus sur SOCIETE_A) : ce que ce test
      // prouve est que LE responsable_sav connu reçoit bien son courriel,
      // pas le décompte total d'une population qu'il ne contrôle pas.
      expect(etat.type).toBe("envoyee");
      const emailResponsable = await email(
        UTILISATEUR_PAR_ROLE[Role.responsable_sav],
      );
      const envoi = envois.find((e) => e.to.includes(emailResponsable));
      expect(envoi).toBeDefined();
      expect(envoi?.attachments).toBeUndefined();
      expect(traces).toHaveBeenCalled();
    });
  });
});
