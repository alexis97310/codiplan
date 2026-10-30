import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LA RÈGLE D'ARRONDI DU TEMPS FACTURÉ N'ÉCHAPPE PAS À I1 (9I8A1-REPRISE-
 * 9I8A, décision d'Alexis du 29/10/2026) — même patron que
 * `tests/isolation/afficher-montants-societe.test.ts`, lui-même repris de
 * `mentions-legales-societe.test.ts`.
 *
 * `enregistrerRegleArrondi`/`lireRegleArrondi` ouvrent leur PROPRE
 * transaction (`avecContexteApplicatif`, le client applicatif de
 * production) : `DATABASE_URL` est redirigée vers `TEST_DATABASE_URL`, sous
 * le rôle `codiplan_app`, AVANT tout import.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/regle-arrondi-societe.test.ts.",
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
  enregistrerRegleArrondi,
  lireRegleArrondi,
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

const NOUVELLE = {
  plancherMinutes: 60,
  palierMinutes: 30,
  seuilPalierMinutes: 5,
};
const HISTORIQUE = {
  plancherMinutes: 60,
  palierMinutes: 15,
  seuilPalierMinutes: 1,
};

afterEach(async () => {
  // Les deux sociétés ressortent au défaut de la migration — même discipline
  // que `afficher-montants-societe.test.ts`.
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: {
      facturation_plancher_min: 60,
      facturation_palier_min: 30,
      facturation_seuil_palier_min: 5,
    },
  });
});

describe("la règle d'arrondi suit la société active, et rien d'autre (I1)", () => {
  it("un enregistrement réussi se relit", async () => {
    const resultat = await enregistrerRegleArrondi(
      contexteSur(SOCIETE_A, Role.admin_societe),
      HISTORIQUE,
    );
    expect(resultat).toEqual({ ok: true });

    expect(
      await lireRegleArrondi(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toEqual(HISTORIQUE);
  });

  it("depuis le contexte de A, une écriture qui FORCE l'identifiant de B est refusée — le réglage de B intact (I1)", async () => {
    await enregistrerRegleArrondi(
      contexteSur(SOCIETE_B, Role.admin_societe),
      HISTORIQUE,
    );

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.societe.update({
          where: { id: SOCIETE_B },
          data: { facturation_palier_min: 30 },
        }),
      ),
    ).rejects.toThrow(/No record was found for an update/);

    const deB = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_B },
      select: { facturation_palier_min: true },
    });
    expect(deB.facturation_palier_min).toBe(15);
  });

  it("un rôle sans parametrer_societe est refusé — le réglage existant intact", async () => {
    await enregistrerRegleArrondi(
      contexteSur(SOCIETE_A, Role.admin_societe),
      HISTORIQUE,
    );

    const refus = await enregistrerRegleArrondi(
      contexteSur(SOCIETE_A, Role.adv),
      NOUVELLE,
    );
    expect(refus).toEqual({ ok: false, motif: "regle_arrondi.refus.droit" });

    expect(
      await lireRegleArrondi(contexteSur(SOCIETE_A, Role.admin_societe)),
    ).toEqual(HISTORIQUE);
  });

  it("le journal d'audit trace l'écriture", async () => {
    await enregistrerRegleArrondi(
      contexteSur(SOCIETE_A, Role.admin_societe),
      HISTORIQUE,
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(apres?.facturation_palier_min).toBe(15);
    expect(apres?.facturation_seuil_palier_min).toBe(1);
  });
});
