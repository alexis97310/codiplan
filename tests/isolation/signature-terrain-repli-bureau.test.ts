import {
  afterAll,
  afterEach,
  beforeAll,
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
import { SOCIETE_B, UTILISATEUR_INTERNE_B } from "./setup/fixtures";

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
 * **Société, agence, client, site et comptes sont POSÉS PAR CE FICHIER SEUL**
 * (9K26A) — ni `SOCIETE_A` ni `UTILISATEUR_PAR_ROLE`. La première version
 * (dés)activait les comptes fixtures PARTAGÉS par toute la suite d'isolation,
 * et comptait un nombre fixe de destinataires actifs dans `SOCIETE_A` : juste
 * seule, fausse dans la suite complète, dès qu'un autre fichier y laissait un
 * `responsable_sav` actif que celui-ci n'avait pas créé (reprise 9K26A,
 * trace `traces/9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES-verify-1.txt`). Les deux
 * fonctions éprouvées (`alerterResponsablesSAV`, `aucunResponsableSavActif`)
 * ne lisent que la société de leur contexte : une société neuve, que ce
 * fichier possède entièrement et nettoie en `afterAll`, rend l'épreuve
 * indépendante de tout ce que les autres fichiers posent ou laissent.
 */

const COURRIEL_ENVIRONNEMENT = {
  COURRIEL_API_CLE: "cle-de-test-repli-bureau",
  COURRIEL_EXPEDITEUR: "codiplan@example.test",
};

const SOCIETE_PROPRE = uuidv7();
const CALENDRIER_PROPRE = uuidv7();
const AGENCE_PROPRE = uuidv7();
const CLIENT_PROPRE = uuidv7();
const SITE_PROPRE = uuidv7();

const UTILISATEUR_PROPRE = {
  [Role.admin_societe]: uuidv7(),
  [Role.direction]: uuidv7(),
  [Role.responsable_materiel]: uuidv7(),
  [Role.responsable_sav]: uuidv7(),
  [Role.adv]: uuidv7(),
  [Role.technicien]: uuidv7(),
} as const;

// Les cinq rôles qui reçoivent le repli (`ROLES_BUREAU` — `lib/auth/roles.ts`),
// nommés ici pour que la boucle de désactivation et le nombre attendu restent
// un seul et même calcul, jamais deux écritures d'un même critère (§9, 01/09).
const ROLES_BUREAU_PROPRES = [
  Role.admin_societe,
  Role.direction,
  Role.responsable_materiel,
  Role.responsable_sav,
  Role.adv,
] as const;

const CONTEXTE_ADV = {
  utilisateurId: UTILISATEUR_PROPRE[Role.adv],
  societeId: SOCIETE_PROPRE,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_DIRECTION = {
  ...CONTEXTE_ADV,
  utilisateurId: UTILISATEUR_PROPRE[Role.direction],
  role: Role.direction,
};

const CONTEXTE_TECHNICIEN = {
  ...CONTEXTE_ADV,
  utilisateurId: UTILISATEUR_PROPRE[Role.technicien],
  role: Role.technicien,
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
// `mfa_actif` tant qu'aucune société n'est active — `app.societe_id` doit
// être posé dans LA MÊME transaction que l'écriture.
async function fixerActif(id: string, actif: boolean): Promise<void> {
  await clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.societe_id', $1, true)",
      SOCIETE_PROPRE,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "utilisateur" SET "actif" = $2 WHERE "id" = $1::uuid`,
      id,
      actif,
    );
  });
}

async function desactiverBureauPropre(): Promise<void> {
  for (const role of ROLES_BUREAU_PROPRES) {
    await fixerActif(UTILISATEUR_PROPRE[role], false);
  }
}

async function reactiverBureauPropre(): Promise<void> {
  for (const role of ROLES_BUREAU_PROPRES) {
    await fixerActif(UTILISATEUR_PROPRE[role], true);
  }
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
    SOCIETE_PROPRE,
    CLIENT_PROPRE,
    SITE_PROPRE,
    AGENCE_PROPRE,
    UTILISATEUR_PROPRE[Role.technicien],
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

beforeAll(async () => {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `INSERT INTO "societe" ("id", "code", "raison_sociale", "pays", "territoire",
                            "fuseau_horaire", "devise_code",
                            "majoration_hors_ouverture_pct", "langue")
     VALUES ($1::uuid, '9K26A-REPLI', 'Société neuve — épreuve 9K26A', 'NC', 'NC',
             'Pacific/Noumea', 'XPF', 50, 'fr')`,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, '9K26A-CAL', 'Calendrier — épreuve 9K26A')`,
    CALENDRIER_PROPRE,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire", "calendrier_id")
     VALUES ($1::uuid, $2::uuid, '9K26A-AG', 'Agence — épreuve 9K26A', 'NC', $3::uuid)`,
    AGENCE_PROPRE,
    SOCIETE_PROPRE,
    CALENDRIER_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale")
     VALUES ($1::uuid, $2::uuid, 'Client — épreuve 9K26A')`,
    CLIENT_PROPRE,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site — épreuve 9K26A')`,
    SITE_PROPRE,
    SOCIETE_PROPRE,
    CLIENT_PROPRE,
    AGENCE_PROPRE,
  );
  for (const [role, utilisateurId] of Object.entries(UTILISATEUR_PROPRE)) {
    await owner.$executeRawUnsafe(
      `INSERT INTO "utilisateur" ("id", "nom", "email", "mfa_actif", "modifie_le")
       VALUES ($1::uuid, $2, $3, true, now())`,
      utilisateurId,
      `Compte ${role} — épreuve 9K26A`,
      `9k26a-${role}@iso.test`,
    );
    await owner.$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      utilisateurId,
      SOCIETE_PROPRE,
      role,
    );
  }
});

afterAll(async () => {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "intervention_id" IN
       (SELECT "id" FROM "intervention" WHERE "societe_id" = $1::uuid)`,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "societe_id" = $1::uuid`,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "societe_id" = $1::uuid`,
    SOCIETE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "id" = ANY($1::uuid[])`,
    Object.values(UTILISATEUR_PROPRE),
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "id" = $1::uuid`,
    AGENCE_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "id" = $1::uuid`,
    CALENDRIER_PROPRE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "societe" WHERE "id" = $1::uuid`,
    SOCIETE_PROPRE,
  );
  await fermerClients();
});

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
    await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], false);
    try {
      const etat = await alerterResponsablesSAV(
        CONTEXTE_ADV,
        interventionId,
        "client_absent",
        "motif de test",
        clientApp(),
        COURRIEL_ENVIRONNEMENT,
      );

      // ADMS, DIR, RM, ADV — les quatre comptes `ROLES_BUREAU_PROPRES` qui
      // restent actifs une fois RS désactivé, et RIEN D'AUTRE : cette
      // société n'existe que pour ce fichier, aucun compte d'un autre
      // fichier ne peut s'y ajouter.
      expect(etat).toStrictEqual({ type: "envoyee", nombre: 4 });

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
      await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], true);
    }
  });

  it("ni le SAV ni le bureau actifs : sans destinataire, rien n'est posé", async () => {
    coupleFetchDeTest();
    await desactiverBureauPropre();
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
      await reactiverBureauPropre();
    }
  });

  it("le repli bureau reste cloisonné : la société B ne voit rien de l'alerte de la société A", async () => {
    coupleFetchDeTest();
    await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], false);
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
      await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], true);
    }
  });
});

describe("aucunResponsableSavActif — gouverne le bandeau du tableau de bord (D241, point 3)", () => {
  it("rend faux quand le responsable_sav propre est actif (état par défaut)", async () => {
    expect(await aucunResponsableSavActif(CONTEXTE_ADV, clientApp())).toBe(
      false,
    );
  });

  it("rend vrai dès qu'aucun responsable_sav n'est actif", async () => {
    await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], false);
    try {
      expect(await aucunResponsableSavActif(CONTEXTE_ADV, clientApp())).toBe(
        true,
      );
    } finally {
      await fixerActif(UTILISATEUR_PROPRE[Role.responsable_sav], true);
    }
  });
});
