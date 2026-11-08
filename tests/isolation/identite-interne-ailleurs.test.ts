import { afterAll, afterEach, describe, expect, it } from "vitest";

import { identiteInterneAilleurs } from "@/lib/auth/lien-d-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  clientReporting,
  fermerClients,
} from "./setup/db";
import {
  PORTAIL_DEUX_SOCIETES,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `app_identite_interne_ailleurs` (D233, complément du 09/11/2026, 9K04-
 * PORTAIL-INVITATION-EMPLOYE) — la SECONDE fonction `SECURITY DEFINER` du
 * dépôt, et son enveloppe `identiteInterneAilleurs` (`lib/auth/lien-d-acces.ts`).
 *
 * Toutes ces épreuves passent par le WRAPPER de production, jamais par une
 * variable armée à la main (même discipline que
 * `tests/isolation/identite-exclusive-a-la-societe.test.ts`), sauf les
 * dernières qui éprouvent précisément ce qui se passe QUAND ce wrapper n'est
 * pas atteint.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};
const ADMIN_B = { ...ADMIN_A, societeId: SOCIETE_B };

afterEach(async () => {
  // LA FUITE SIMULÉE, retirée après chaque test (même discipline que
  // `identite-exclusive-a-la-societe.test.ts`) : jamais une fixture permanente.
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" = $1::uuid AND "societe_id" = $2::uuid`,
    UTILISATEUR_PAR_ROLE[Role.technicien],
    SOCIETE_B,
  );
});

afterAll(fermerClients);

describe("identiteInterneAilleurs — bureau et technicien (utilisateur_societe)", () => {
  it("rend faux pour une identité qui n'a qu'une seule ligne (ADV, société A seule)", async () => {
    const interneAilleurs = await identiteInterneAilleurs(
      ADMIN_A,
      UTILISATEUR_PAR_ROLE[Role.adv],
      clientApp(),
    );
    expect(interneAilleurs).toBe(false);
  });

  it("rend vrai dès qu'une AUTRE ligne utilisateur_societe existe, pour les DEUX sociétés", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      UTILISATEUR_PAR_ROLE[Role.technicien],
      SOCIETE_B,
      Role.technicien,
    );

    const chezA = await identiteInterneAilleurs(
      ADMIN_A,
      UTILISATEUR_PAR_ROLE[Role.technicien],
      clientApp(),
    );
    expect(chezA).toBe(true);

    const chezB = await identiteInterneAilleurs(
      ADMIN_B,
      UTILISATEUR_PAR_ROLE[Role.technicien],
      clientApp(),
    );
    expect(chezB).toBe(true);
  });
});

describe("identiteInterneAilleurs — portail (utilisateur_client) — JAMAIS regardée", () => {
  it("rend FAUX pour un compte portail rattaché à DEUX sociétés (PORTAIL_DEUX_SOCIETES, D92) : aucune ligne utilisateur_societe", async () => {
    const chezA = await identiteInterneAilleurs(
      ADMIN_A,
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(chezA).toBe(false);

    const chezB = await identiteInterneAilleurs(
      ADMIN_B,
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(chezB).toBe(false);
  });
});

describe("identiteInterneAilleurs — fail-closed quand la fonction lève, INVERSÉ (9K04)", () => {
  /**
   * Simule, SANS toucher la migration, le cas mesuré par 9I8D2 pour la
   * première fonction : sous le propriétaire hébergé (ni superutilisateur,
   * ni `BYPASSRLS`), la fonction lève au lieu de répondre. Révoquer `EXECUTE`
   * produit la MÊME famille d'échec — une exception SQL au moment de
   * l'appel — sans dépendre d'un second rôle ni rouvrir la migration.
   *
   * ICI, fail-closed répond `true` — « oui, interne ailleurs » — jamais
   * `false` : c'est `true` qui mène au refus dans `inviterClientAuPortail`.
   */
  async function revoquerExecution(): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `REVOKE EXECUTE ON FUNCTION "app_identite_interne_ailleurs"(uuid) FROM "codiplan_app"`,
    );
  }
  async function reaccorderExecution(): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `GRANT EXECUTE ON FUNCTION "app_identite_interne_ailleurs"(uuid) TO "codiplan_app"`,
    );
  }

  it("rend VRAI, jamais une exception, quand l'appel à la fonction échoue", async () => {
    await revoquerExecution();
    try {
      await expect(
        identiteInterneAilleurs(
          ADMIN_A,
          UTILISATEUR_PAR_ROLE[Role.adv],
          clientApp(),
        ),
      ).resolves.toBe(true);
    } finally {
      await reaccorderExecution();
    }
  });
});

describe("app_identite_interne_ailleurs — garanties posées par la migration", () => {
  it("ne rend qu'un booléen — aucun nom, aucun rôle, aucun identifiant d'une autre société", async () => {
    const [ligne] = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.societe_id', $1, true)",
        SOCIETE_A,
      );
      return tx.$queryRawUnsafe<readonly Record<string, unknown>[]>(
        `SELECT "app_identite_interne_ailleurs"($1::uuid) AS "interne_ailleurs"`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      );
    });
    expect(Object.keys(ligne ?? {})).toEqual(["interne_ailleurs"]);
    expect(typeof ligne?.interne_ailleurs).toBe("boolean");
  });

  it("contexte sans app.societe_id → lève, jamais vrai ni faux (fail-closed)", async () => {
    // Appel HORS de toute transaction posée par `avecSociete` : une
    // connexion fraîche de `clientApp()` ne porte aucune valeur pour
    // `app.societe_id`.
    await expect(
      clientApp().$queryRawUnsafe(
        `SELECT "app_identite_interne_ailleurs"($1::uuid)`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      ),
    ).rejects.toThrow(/app_identite_interne_ailleurs/);
  });

  it("PUBLIC ne peut pas l'exécuter — codiplan_reporting (BYPASSRLS, SELECT seul) le prouve", async () => {
    // `codiplan_reporting` n'est ni le propriétaire ni `codiplan_app` : aucun
    // GRANT EXECUTE ne lui a été accordé, et REVOKE ALL FROM PUBLIC lui
    // retire même le défaut — même garde que D226, appelée hors du rôle
    // applicatif.
    await expect(
      clientReporting().$queryRawUnsafe(
        `SELECT "app_identite_interne_ailleurs"($1::uuid)`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
