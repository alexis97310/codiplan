import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LE RÉGLAGE DE LA MAJORATION HORS OUVERTURE N'ÉCHAPPE PAS À I1
 * (9L33-MAJORATION-REGLAGE-SOCIETE, complète D269) — même patron que
 * `tests/isolation/regle-arrondi-societe.test.ts`, lui-même repris de
 * `afficher-montants-societe.test.ts`.
 *
 * `enregistrerMajorationHorsOuverturePct`/`lireMajorationHorsOuverturePct`
 * ouvrent leur PROPRE transaction (`avecContexteApplicatif`, le client
 * applicatif de production) : `DATABASE_URL` est redirigée vers
 * `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, AVANT tout import.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/majoration-hors-ouverture-societe.test.ts.",
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
  enregistrerMajorationHorsOuverturePct,
  lireMajorationHorsOuverturePct,
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

/** Les deux sociétés démarrent à 50 (`tests/isolation/setup/global.ts`). */
const DEFAUT = "50";

afterEach(async () => {
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { majoration_hors_ouverture_pct: DEFAUT },
  });
});

describe("le réglage de la majoration hors ouverture suit la société active, et rien d'autre (I1)", () => {
  it("un enregistrement réussi se relit", async () => {
    const resultat = await enregistrerMajorationHorsOuverturePct(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "25.00",
    );
    expect(resultat).toEqual({ ok: true });

    expect(
      await lireMajorationHorsOuverturePct(
        contexteSur(SOCIETE_A, Role.admin_societe),
      ),
      // `Decimal.toString()` (decimal.js) normalise les zéros de fin : « 25 »,
      // jamais « 25.00 » — même lecture que les captures 9L12.
    ).toBe("25");
  });

  it("depuis le contexte de A, une écriture qui FORCE l'identifiant de B est refusée — le réglage de B intact (I1)", async () => {
    await enregistrerMajorationHorsOuverturePct(
      contexteSur(SOCIETE_B, Role.admin_societe),
      "75.00",
    );

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.societe.update({
          where: { id: SOCIETE_B },
          data: { majoration_hors_ouverture_pct: "10.00" },
        }),
      ),
    ).rejects.toThrow(/No record was found for an update/);

    const deB = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_B },
      select: { majoration_hors_ouverture_pct: true },
    });
    expect(deB.majoration_hors_ouverture_pct.toString()).toBe("75");
  });

  it("un rôle sans parametrer_societe est refusé — le réglage existant intact", async () => {
    await enregistrerMajorationHorsOuverturePct(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "25.00",
    );

    const refus = await enregistrerMajorationHorsOuverturePct(
      contexteSur(SOCIETE_A, Role.adv),
      "90.00",
    );
    expect(refus).toEqual({
      ok: false,
      motif: "majoration_hors_ouverture.refus.droit",
    });

    expect(
      await lireMajorationHorsOuverturePct(
        contexteSur(SOCIETE_A, Role.admin_societe),
      ),
    ).toBe("25");
  });

  it("le journal d'audit trace l'écriture, avant et après", async () => {
    await enregistrerMajorationHorsOuverturePct(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "33.33",
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_avant: true, valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const avant = ligne?.valeurs_avant as Record<string, unknown> | null;
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(avant?.majoration_hors_ouverture_pct).toBe(50);
    expect(apres?.majoration_hors_ouverture_pct).toBe(33.33);
  });

  it("une valeur hors bornes (0..200) est refusée EN BASE (societe_majoration_hors_ouverture_bornee)", async () => {
    await expect(
      clientOwner().societe.update({
        where: { id: SOCIETE_A },
        data: { majoration_hors_ouverture_pct: "200.01" },
      }),
    ).rejects.toThrow(/societe_majoration_hors_ouverture_bornee/);

    const deA = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_A },
      select: { majoration_hors_ouverture_pct: true },
    });
    expect(deA.majoration_hors_ouverture_pct.toString()).toBe(DEFAUT);
  });

  it("une valeur négative est refusée EN BASE (societe_majoration_hors_ouverture_bornee)", async () => {
    await expect(
      clientOwner().societe.update({
        where: { id: SOCIETE_A },
        data: { majoration_hors_ouverture_pct: "-1.00" },
      }),
    ).rejects.toThrow(/societe_majoration_hors_ouverture_bornee/);
  });

  it("JUMEAU — la contrainte retirée, 200.01 PASSE", async () => {
    try {
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "societe" DROP CONSTRAINT "societe_majoration_hors_ouverture_bornee"`,
      );
      await clientOwner().societe.update({
        where: { id: SOCIETE_A },
        data: { majoration_hors_ouverture_pct: "200.01" },
      });
      const deA = await clientOwner().societe.findUniqueOrThrow({
        where: { id: SOCIETE_A },
        select: { majoration_hors_ouverture_pct: true },
      });
      expect(deA.majoration_hors_ouverture_pct.toString()).toBe("200.01");
    } finally {
      await clientOwner().societe.updateMany({
        where: { id: SOCIETE_A },
        data: { majoration_hors_ouverture_pct: DEFAUT },
      });
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "societe"
          ADD CONSTRAINT "societe_majoration_hors_ouverture_bornee" CHECK (
            "majoration_hors_ouverture_pct" BETWEEN 0 AND 200
          )`,
      );
    }
  });
});
