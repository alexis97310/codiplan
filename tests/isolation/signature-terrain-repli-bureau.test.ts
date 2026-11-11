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
import { aucunResponsableSavActif } from "@/lib/tableau-de-bord/lectures";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D241 (amende D173, audit UX B1/M1 du 10/11/2026) — L'ALERTE DE FIN
 * D'INTERVENTION TROUVE TOUJOURS UN DESTINATAIRE QUAND LE BUREAU EXISTE
 * ENCORE.
 *
 * Avant D241, une société sans `responsable_sav` actif ne recevait RIEN
 * (`tests/isolation/signature-terrain-notification.test.ts` prouve le
 * chemin NON amendé, resté vert). Ce fichier prouve le REPLI : chaque compte
 * actif de `ROLES_BUREAU` quand aucun `responsable_sav` n'est actif, et
 * `sans_destinataire` SEULEMENT si le bureau entier est inactif.
 *
 * **Les comptes désactivés ici sont restaurés dans CHAQUE `finally`** — ce
 * sont les comptes fixtures partagés par toute la suite d'isolation
 * (`fileParallelism: false`, un seul fichier à la fois) : les laisser
 * inactifs ferait rougir des scénarios sans rapport avec ce ticket.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-repli-bureau",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

const CONTEXTE_ADV = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_DIRECTION = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.direction],
  societeId: SOCIETE_A,
  role: Role.direction,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_TECHNICIEN = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_SOCIETE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function coupleFetchDeTest(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "test-repli-bureau" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

// LA DÉSACTIVATION PASSE PAR LE CHEMIN ADMINISTRATIF (même garde mesurée dans
// `tests/isolation/refus-silencieux.test.ts`) : le déclencheur
// `utilisateur_enrolement_mfa_seul` refuse toute colonne autre que
// `mfa_actif` tant qu'aucune société n'est active, y compris au propriétaire
// — `app.societe_id` doit être posé dans LA MÊME transaction que l'écriture.
async function fixerActif(id: string, actif: boolean): Promise<void> {
  await clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.societe_id', $1, true)",
      SOCIETE_A,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "utilisateur" SET "actif" = $2 WHERE "id" = $1::uuid`,
      id,
      actif,
    );
  });
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

describe("alerterResponsablesSAV — repli sur le bureau (D241)", () => {
  let interventionId = "";

  beforeEach(async () => {
    interventionId = uuidv7();
    await creerLigne(interventionId);
  });

  afterEach(() => supprimerLigne(interventionId));

  it("aucun responsable_sav actif : l'alerte part à tout le bureau actif", async () => {
    coupleFetchDeTest();
    await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], false);
    try {
      const etat = await alerterResponsablesSAV(
        CONTEXTE_ADV,
        interventionId,
        "client_absent",
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      // ADMS, DIR, RM, ADV (deux comptes fixtures : `UTILISATEUR_PAR_ROLE`
      // et `UTILISATEUR_INTERNE_A`) actifs — RS exclu (inactif).
      expect(etat).toStrictEqual({ type: "envoyee", nombre: 5 });

      const vuesParDirection = await listerNotifications(
        CONTEXTE_DIRECTION,
        clientApp(),
      );
      expect(
        vuesParDirection.find((n) => n.interventionId === interventionId),
      ).toBeDefined();

      const vuesParTechnicien = await listerNotifications(
        CONTEXTE_TECHNICIEN,
        clientApp(),
      );
      expect(
        vuesParTechnicien.find((n) => n.interventionId === interventionId),
      ).toBeUndefined();
    } finally {
      await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], true);
    }
  });

  it("ni le SAV ni le bureau actifs : sans destinataire, rien n'est posé", async () => {
    coupleFetchDeTest();
    const roles = [
      Role.admin_societe,
      Role.direction,
      Role.responsable_materiel,
      Role.responsable_sav,
      Role.adv,
    ] as const;
    for (const role of roles) {
      await fixerActif(UTILISATEUR_PAR_ROLE[role], false);
    }
    // `UTILISATEUR_INTERNE_A` — un second compte `adv` fixture, hors de
    // `UTILISATEUR_PAR_ROLE` (voir `tests/isolation/setup/global.ts`).
    await fixerActif(UTILISATEUR_INTERNE_A, false);
    try {
      const etat = await alerterResponsablesSAV(
        CONTEXTE_ADV,
        interventionId,
        "refus_signature",
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );
      expect(etat).toStrictEqual({ type: "sans_destinataire" });

      const ligne = await clientOwner().notification.findFirst({
        where: { intervention_id: interventionId },
      });
      expect(ligne).toBeNull();
    } finally {
      for (const role of roles) {
        await fixerActif(UTILISATEUR_PAR_ROLE[role], true);
      }
      await fixerActif(UTILISATEUR_INTERNE_A, true);
    }
  });

  it("le repli bureau reste cloisonné : la société B ne voit rien de l'alerte de la société A", async () => {
    coupleFetchDeTest();
    await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], false);
    try {
      await alerterResponsablesSAV(
        CONTEXTE_ADV,
        interventionId,
        "client_absent",
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      const vuesSocieteB = await listerNotifications(
        CONTEXTE_SOCIETE_B,
        clientApp(),
      );
      expect(
        vuesSocieteB.find((n) => n.interventionId === interventionId),
      ).toBeUndefined();
    } finally {
      await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], true);
    }
  });
});

describe("aucunResponsableSavActif — gouverne le bandeau du tableau de bord (D241, point 3)", () => {
  it("rend faux quand le responsable_sav fixture est actif (état par défaut)", async () => {
    expect(await aucunResponsableSavActif(CONTEXTE_ADV, clientApp())).toBe(
      false,
    );
  });

  it("rend vrai dès qu'aucun responsable_sav n'est actif", async () => {
    await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], false);
    try {
      expect(await aucunResponsableSavActif(CONTEXTE_ADV, clientApp())).toBe(
        true,
      );
    } finally {
      await fixerActif(UTILISATEUR_PAR_ROLE[Role.responsable_sav], true);
    }
  });
});
