import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LES MENTIONS LÉGALES N'ÉCHAPPENT PAS À I1 (9I7A-MENTIONS-LEGALES-
 * MODIFIABLES) — même discipline que `tests/isolation/logo-societe.test.ts`,
 * dont ce fichier reprend le patron à la lettre.
 *
 * **`enregistrerMentionsLegales` ouvre SA PROPRE transaction**
 * (`avecContexteApplicatif`, le client applicatif de production) : `DATABASE_URL`
 * est redirigée vers `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, AVANT
 * tout import — `vi.hoisted` s'exécute avant les imports qui suivent, et le
 * singleton `prisma` de `lib/db/client.ts` lit `DATABASE_URL` à sa construction.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/mentions-legales-societe.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import type { ContexteActif } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { enregistrerMentionsLegales } from "@/lib/societes/identite";

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
  // Les deux sociétés ressortent SANS mentions légales, quoi que le scénario
  // qui vient de s'exécuter ait écrit — fixture partagée par tout le projet
  // d'isolation (`fileParallelism: false` le permet, un fichier à la fois).
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { mentions_legales: null },
  });
});

describe("les mentions légales suivent la société active, et rien d'autre (I1)", () => {
  it("un enregistrement réussi se relit", async () => {
    const resultat = await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "CODIMA — RIDET 1234567",
    );
    expect(resultat).toEqual({ ok: true });

    const societe = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_A },
      select: { mentions_legales: true },
    });
    expect(societe.mentions_legales).toBe("CODIMA — RIDET 1234567");
  });

  it("les espaces de bord sont retirés, un texte devenu vide écrit null", async () => {
    const resultat = await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "   \n  ",
    );
    expect(resultat).toEqual({ ok: true });

    const societe = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_A },
      select: { mentions_legales: true },
    });
    expect(societe.mentions_legales).toBeNull();
  });

  it("depuis le contexte de A, une écriture qui FORCE l'identifiant de B est refusée — le texte de B intact (I1)", async () => {
    await enregistrerMentionsLegales(
      contexteSur(SOCIETE_B, Role.admin_societe),
      "Texte de B",
    );

    // Même faute que `logo-societe.test.ts` : un appel qui, par erreur,
    // écrirait sur l'identifiant VISÉ plutôt que sur `contexte.societeId`.
    // La politique RLS `id = app.societe_id` cache la ligne de B au SELECT
    // que Prisma compose avec l'UPDATE — sous le contexte de A, la ligne
    // n'existe tout simplement pas. Un refus PRÉCIS (CE message Prisma),
    // jamais un `rejects.toThrow()` générique qui masquerait une AUTRE
    // panne (point 3, 9I7D) — mesuré : ce n'est PAS le message Postgres brut
    // « row-level security », que seule une requête SQL directe produirait.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.societe.update({
          where: { id: SOCIETE_B },
          data: { mentions_legales: "Vol depuis A" },
        }),
      ),
    ).rejects.toThrow(/No record was found for an update/);

    const texteDeB = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_B },
      select: { mentions_legales: true },
    });
    expect(texteDeB.mentions_legales).toBe("Texte de B");
  });

  it("un rôle sans parametrer_societe est refusé — le texte existant intact", async () => {
    await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "Texte posé par un rôle habilité",
    );

    const refus = await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.adv),
      "Tentative sans droit",
    );
    expect(refus).toEqual({ ok: false, motif: "mentions_legales.refus.droit" });

    const societe = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_A },
      select: { mentions_legales: true },
    });
    expect(societe.mentions_legales).toBe("Texte posé par un rôle habilité");
  });

  it("un texte de plus de 1 000 caractères est refusé, rien n'est écrit", async () => {
    const trop = "a".repeat(1001);
    const refus = await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.admin_societe),
      trop,
    );
    expect(refus).toEqual({
      ok: false,
      motif: "mentions_legales.refus.taille",
    });

    const societe = await clientOwner().societe.findUniqueOrThrow({
      where: { id: SOCIETE_A },
      select: { mentions_legales: true },
    });
    expect(societe.mentions_legales).toBeNull();
  });

  it("le journal d'audit trace l'écriture, avec le texte", async () => {
    await enregistrerMentionsLegales(
      contexteSur(SOCIETE_A, Role.admin_societe),
      "Texte tracé",
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(apres?.mentions_legales).toBe("Texte tracé");
  });
});
