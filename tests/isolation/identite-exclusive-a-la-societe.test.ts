import { afterAll, afterEach, describe, expect, it } from "vitest";

import { identiteExclusiveALaSociete } from "@/lib/auth/lien-d-acces";
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
 * `app_identite_exclusive_a_la_societe` (D226, 01/11/2026, 9I8D1-REPRISE-
 * 9I8D) — la SEULE fonction `SECURITY DEFINER` du dépôt, et son enveloppe
 * `identiteExclusiveALaSociete` (`lib/auth/lien-d-acces.ts`).
 *
 * Toutes ces épreuves passent par le WRAPPER de production, jamais par une
 * variable armée à la main (leçon du 08/09 — « une suite qui éprouve tous les
 * maillons n'éprouve pas la chaîne »), sauf les deux dernières qui éprouvent
 * précisément ce qui se passe QUAND ce wrapper n'est pas atteint.
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
  // `tests/isolation/acces-bureau.test.ts`) : jamais une fixture permanente.
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" = $1::uuid AND "societe_id" = $2::uuid`,
    UTILISATEUR_PAR_ROLE[Role.technicien],
    SOCIETE_B,
  );
});

afterAll(fermerClients);

describe("identiteExclusiveALaSociete — bureau et technicien (utilisateur_societe)", () => {
  it("rend vrai pour une identité qui n'a qu'une seule ligne (ADV, société A seule)", async () => {
    const exclusif = await identiteExclusiveALaSociete(
      ADMIN_A,
      UTILISATEUR_PAR_ROLE[Role.adv],
      clientApp(),
    );
    expect(exclusif).toBe(true);
  });

  it("rend faux dès qu'une AUTRE ligne utilisateur_societe existe, pour les DEUX sociétés", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      UTILISATEUR_PAR_ROLE[Role.technicien],
      SOCIETE_B,
      Role.technicien,
    );

    const chezA = await identiteExclusiveALaSociete(
      ADMIN_A,
      UTILISATEUR_PAR_ROLE[Role.technicien],
      clientApp(),
    );
    expect(chezA).toBe(false);

    const chezB = await identiteExclusiveALaSociete(
      ADMIN_B,
      UTILISATEUR_PAR_ROLE[Role.technicien],
      clientApp(),
    );
    expect(chezB).toBe(false);
  });
});

describe("identiteExclusiveALaSociete — portail (utilisateur_client)", () => {
  it("rend faux pour un compte portail rattaché à DEUX sociétés (PORTAIL_DEUX_SOCIETES, D92)", async () => {
    const chezA = await identiteExclusiveALaSociete(
      ADMIN_A,
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(chezA).toBe(false);

    const chezB = await identiteExclusiveALaSociete(
      ADMIN_B,
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(chezB).toBe(false);
  });
});

describe("app_identite_exclusive_a_la_societe — garanties posées par la migration", () => {
  it("ne rend qu'un booléen — aucun nom, aucun identifiant d'une autre société", async () => {
    const [ligne] = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.societe_id', $1, true)",
        SOCIETE_A,
      );
      return tx.$queryRawUnsafe<readonly Record<string, unknown>[]>(
        `SELECT "app_identite_exclusive_a_la_societe"($1::uuid) AS "exclusif"`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      );
    });
    expect(Object.keys(ligne ?? {})).toEqual(["exclusif"]);
    expect(typeof ligne?.exclusif).toBe("boolean");
  });

  it("contexte sans app.societe_id → lève, jamais vrai (fail-closed)", async () => {
    // Appel HORS de toute transaction posée par `avecSociete` : une
    // connexion fraîche de `clientApp()` ne porte aucune valeur pour
    // `app.societe_id` (témoin déjà établi ailleurs — une lecture non
    // posée rend zéro ligne sur les tables cloisonnées).
    await expect(
      clientApp().$queryRawUnsafe(
        `SELECT "app_identite_exclusive_a_la_societe"($1::uuid)`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      ),
    ).rejects.toThrow(/app_identite_exclusive_a_la_societe/);
  });

  it("PUBLIC ne peut pas l'exécuter — codiplan_reporting (BYPASSRLS, SELECT seul) le prouve", async () => {
    // `codiplan_reporting` n'est ni le propriétaire ni `codiplan_app` : aucun
    // GRANT EXECUTE ne lui a été accordé, et REVOKE ALL FROM PUBLIC lui
    // retire même le défaut. Le choisir ici, plutôt qu'un rôle fabriqué,
    // prouve que l'EXÉCUTION reste fermée même à un rôle qui contourne déjà
    // RLS par ailleurs (D21) — deux portes distinctes.
    await expect(
      clientReporting().$queryRawUnsafe(
        `SELECT "app_identite_exclusive_a_la_societe"($1::uuid)`,
        UTILISATEUR_PAR_ROLE[Role.adv],
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
