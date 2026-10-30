import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * « AFFICHER LES MONTANTS » N'ÉCHAPPE PAS À I1 (9I8-AFFICHAGE-DES-MONTANTS,
 * demande d'Alexis du 28/10/2026, option A) — même discipline que
 * `tests/isolation/mentions-legales-societe.test.ts`, dont ce fichier
 * reprend le patron à la lettre.
 *
 * `enregistrerAfficherMontants`/`lireAfficherMontants` ouvrent leur PROPRE
 * transaction (`avecContexteApplicatif`, le client applicatif de
 * production) : `DATABASE_URL` est redirigée vers `TEST_DATABASE_URL`, sous
 * le rôle `codiplan_app`, AVANT tout import.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/afficher-montants-societe.test.ts.",
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
  enregistrerAfficherMontants,
  lireAfficherMontants,
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
  // Les deux sociétés ressortent ACTIVÉES — valeur de colonne par défaut,
  // quoi que le scénario qui vient de s'exécuter ait écrit (même discipline
  // que `mentions-legales-societe.test.ts`).
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { afficher_montants: true },
  });
});

describe("« afficher les montants » suit la société active, et rien d'autre (I1)", () => {
  it("un enregistrement réussi se relit", async () => {
    const resultat = await enregistrerAfficherMontants(
      contexteSur(SOCIETE_A, Role.admin_societe),
      false,
    );
    expect(resultat).toEqual({ ok: true });

    expect(
      await lireAfficherMontants(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toBe(false);
  });

  it("depuis le contexte de A, une écriture qui FORCE l'identifiant de B est refusée — le réglage de B intact (I1)", async () => {
    await enregistrerAfficherMontants(
      contexteSur(SOCIETE_B, Role.admin_societe),
      false,
    );

    // Même faute que `mentions-legales-societe.test.ts` : un appel qui, par
    // erreur, écrirait sur l'identifiant VISÉ plutôt que sur
    // `contexte.societeId`.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.societe.update({
          where: { id: SOCIETE_B },
          data: { afficher_montants: true },
        }),
      ),
    ).rejects.toThrow(/No record was found for an update/);

    const deB = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_B },
      select: { afficher_montants: true },
    });
    expect(deB.afficher_montants).toBe(false);
  });

  it("un rôle sans parametrer_societe est refusé — le réglage existant intact", async () => {
    await enregistrerAfficherMontants(
      contexteSur(SOCIETE_A, Role.admin_societe),
      false,
    );

    const refus = await enregistrerAfficherMontants(
      contexteSur(SOCIETE_A, Role.adv),
      true,
    );
    expect(refus).toEqual({
      ok: false,
      motif: "afficher_montants.refus.droit",
    });

    expect(
      await lireAfficherMontants(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toBe(false);
  });

  it("le journal d'audit trace l'écriture", async () => {
    await enregistrerAfficherMontants(
      contexteSur(SOCIETE_A, Role.admin_societe),
      false,
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(apres?.afficher_montants).toBe(false);
  });
});
