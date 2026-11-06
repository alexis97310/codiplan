import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LE DÉLAI DE RELANCE DES SUITES À DONNER N'ÉCHAPPE PAS À I1 (FLX-2/FLX-3,
 * 9J19-SUITE-A-DONNER-NOTIFICATIONS) — même patron que
 * `tests/isolation/regle-arrondi-societe.test.ts`, lui-même repris de
 * `mentions-legales-societe.test.ts`.
 *
 * `enregistrerDelaiRelanceSuite`/`lireDelaiRelanceSuite` ouvrent leur PROPRE
 * transaction (`avecContexteApplicatif`, le client applicatif de
 * production) : `DATABASE_URL` est redirigée vers `TEST_DATABASE_URL`, sous
 * le rôle `codiplan_app`, AVANT tout import.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/delai-relance-suite-societe.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import type { ContexteActif } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  enregistrerDelaiRelanceSuite,
  lireDelaiRelanceSuite,
} from "@/lib/societes/identite";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

afterAll(fermerClients);

function contexteSur(societeId: string, role: Role): ContexteActif {
  return {
    utilisateurId: "aaaaaaaa-0000-7000-8000-000000000099",
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

afterEach(async () => {
  // Les deux sociétés ressortent NULLES — valeur de colonne par défaut
  // depuis la migration (CLAUDE.md §8, aucun délai n'est inventé), quoi que
  // le scénario qui vient de s'exécuter ait écrit.
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { delai_relance_suite_jours: null },
  });
});

describe("le délai de relance suit la société active, et rien d'autre (I1)", () => {
  it("aucune société active : lireDelaiRelanceSuite rend NUL, jamais inventé", async () => {
    expect(
      await lireDelaiRelanceSuite({
        utilisateurId: "aaaaaaaa-0000-7000-8000-000000000099",
        societeId: null,
        role: null,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: null,
      }),
    ).toBeNull();
  });

  it("un enregistrement réussi se relit", async () => {
    const resultat = await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.admin_societe),
      5,
    );
    expect(resultat).toEqual({ ok: true });

    expect(
      await lireDelaiRelanceSuite(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toBe(5);
  });

  it("enregistrer NUL désactive le réglage — et se relit NUL", async () => {
    await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.admin_societe),
      5,
    );
    await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.admin_societe),
      null,
    );

    expect(
      await lireDelaiRelanceSuite(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toBeNull();
  });

  it("depuis le contexte de A, une écriture qui FORCE l'identifiant de B est refusée — le réglage de B intact (I1)", async () => {
    await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_B, Role.admin_societe),
      7,
    );

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.societe.update({
          where: { id: SOCIETE_B },
          data: { delai_relance_suite_jours: 3 },
        }),
      ),
    ).rejects.toThrow(/No record was found for an update/);

    const deB = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_B },
      select: { delai_relance_suite_jours: true },
    });
    expect(deB.delai_relance_suite_jours).toBe(7);
  });

  it("un rôle sans parametrer_societe est refusé — le réglage existant intact", async () => {
    await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.admin_societe),
      5,
    );

    const refus = await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.adv),
      10,
    );
    expect(refus).toEqual({
      ok: false,
      motif: "delai_relance_suite.refus.droit",
    });

    expect(
      await lireDelaiRelanceSuite(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toBe(5);
  });

  it("le journal d'audit trace l'écriture", async () => {
    await enregistrerDelaiRelanceSuite(
      contexteSur(SOCIETE_A, Role.admin_societe),
      5,
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(apres?.delai_relance_suite_jours).toBe(5);
  });
});
