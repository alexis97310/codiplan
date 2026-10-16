import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LE LOGO DE LA SOCIÉTÉ N'ÉCHAPPE PAS À I1 (9EZ-LOGO-SOCIETE-1, D87) — même
 * discipline que `tests/isolation/theme-societe.test.ts` et `identite-
 * societe.test.ts`.
 *
 * **`lib/societes/logo.ts` ouvre SA PROPRE transaction** (`avecContexteApplicatif`,
 * le client applicatif de production), à la différence de `lireThemeCloisonne`
 * qui reçoit un `tx` déjà posé par l'appelant. Le patron ici est donc celui de
 * `tests/isolation/photo-format-et-taille.test.ts` : `DATABASE_URL` est
 * redirigée vers `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, AVANT tout
 * import — `vi.hoisted` s'exécute avant les imports qui suivent, et le
 * singleton `prisma` de `lib/db/client.ts` lit `DATABASE_URL` à sa
 * construction.
 */

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/logo-societe.test.ts.",
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
  empreinteDuLogo,
  enregistrerLogo,
  lireLogo,
  lireLogoEtRaisonSociale,
  retirerLogo,
} from "@/lib/societes/logo";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

afterAll(fermerClients);

const PNG_MINIMAL = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

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
  // Les deux sociétés ressortent SANS logo, quoi que le scénario qui vient de
  // s'exécuter ait écrit — la fixture est partagée par tout le projet
  // d'isolation (`fileParallelism: false` le permet, un fichier à la fois).
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { logo_octets: null, logo_type: null, logo_empreinte: null },
  });
});

describe("le logo suit la société active, et rien d'autre (I1)", () => {
  it("un dépôt réussi se relit, avec son type et son empreinte", async () => {
    const resultat = await enregistrerLogo(
      contexteSur(SOCIETE_A, Role.admin_societe),
      PNG_MINIMAL,
    );
    expect(resultat).toEqual({ ok: true });

    const logo = await lireLogo(contexteSur(SOCIETE_A, Role.admin_societe));
    expect(logo).not.toBeNull();
    expect(logo?.type).toBe("image/png");
    expect(logo?.octets.equals(PNG_MINIMAL)).toBe(true);
    expect(logo?.empreinte).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sans dépôt, aucun logo n'est lisible", async () => {
    const logo = await lireLogo(contexteSur(SOCIETE_B, Role.admin_societe));
    expect(logo).toBeNull();
  });

  it("une session active sur A n'obtient PAS le logo de B", async () => {
    await enregistrerLogo(
      contexteSur(SOCIETE_B, Role.admin_societe),
      PNG_MINIMAL,
    );

    // Lu sous le contexte de A, en demandant explicitement la ligne de B par
    // un appel direct — la politique RLS `id = app.societe_id` ne laisse voir
    // que la société du contexte, quelle que soit la société visée.
    const vol = await sousSociete(SOCIETE_A, (tx) =>
      empreinteDuLogo(tx, SOCIETE_B),
    );

    expect(vol).toBeNull();
  });

  it("retirerLogo efface les trois colonnes à la fois", async () => {
    await enregistrerLogo(
      contexteSur(SOCIETE_A, Role.admin_societe),
      PNG_MINIMAL,
    );
    const avant = await lireLogo(contexteSur(SOCIETE_A, Role.admin_societe));
    expect(avant).not.toBeNull();

    const resultat = await retirerLogo(
      contexteSur(SOCIETE_A, Role.admin_societe),
    );
    expect(resultat).toEqual({ ok: true });

    const apres = await lireLogo(contexteSur(SOCIETE_A, Role.admin_societe));
    expect(apres).toBeNull();
  });

  it("un rôle sans parametrer_societe est refusé, en écriture comme en retrait", async () => {
    const depot = await enregistrerLogo(
      contexteSur(SOCIETE_A, Role.adv),
      PNG_MINIMAL,
    );
    expect(depot).toEqual({ ok: false, motif: "logo.refus.droit" });

    const retrait = await retirerLogo(contexteSur(SOCIETE_A, Role.adv));
    expect(retrait).toEqual({ ok: false, motif: "logo.refus.droit" });

    const logo = await lireLogo(contexteSur(SOCIETE_A, Role.admin_societe));
    expect(logo).toBeNull();
  });

  it("lireLogoEtRaisonSociale (D207) rend le logo ET la raison sociale de A, jamais ceux de B", async () => {
    await enregistrerLogo(
      contexteSur(SOCIETE_A, Role.admin_societe),
      PNG_MINIMAL,
    );
    const autrePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9,
    ]);
    await enregistrerLogo(contexteSur(SOCIETE_B, Role.admin_societe), autrePng);

    const [nomA, nomB] = await Promise.all([
      clientOwner().societe.findUniqueOrThrow({
        where: { id: SOCIETE_A },
        select: { raison_sociale: true },
      }),
      clientOwner().societe.findUniqueOrThrow({
        where: { id: SOCIETE_B },
        select: { raison_sociale: true },
      }),
    ]);

    const vuDepuisA = await sousSociete(SOCIETE_A, (tx) =>
      lireLogoEtRaisonSociale(tx, SOCIETE_A),
    );
    expect(vuDepuisA?.raisonSociale).toBe(nomA.raison_sociale);
    expect(vuDepuisA?.logo?.octets.equals(PNG_MINIMAL)).toBe(true);

    // DEMANDER EXPLICITEMENT LA LIGNE DE B, SOUS LE CONTEXTE DE A (D207, même
    // discipline que `empreinteDuLogo` plus haut) — la politique RLS ne laisse
    // voir que la société du contexte, quelle que soit la société VISÉE par
    // l'appel : ni le logo ni le nom de B ne doivent jamais partir dans un
    // courriel composé sous le contexte de A.
    const volDepuisA = await sousSociete(SOCIETE_A, (tx) =>
      lireLogoEtRaisonSociale(tx, SOCIETE_B),
    );
    expect(volDepuisA).toBeNull();

    const vuDepuisB = await sousSociete(SOCIETE_B, (tx) =>
      lireLogoEtRaisonSociale(tx, SOCIETE_B),
    );
    expect(vuDepuisB?.raisonSociale).toBe(nomB.raison_sociale);
    expect(vuDepuisB?.logo?.octets.equals(autrePng)).toBe(true);
  });

  it("le journal d'audit ne recopie pas les octets du logo", async () => {
    await enregistrerLogo(
      contexteSur(SOCIETE_A, Role.admin_societe),
      PNG_MINIMAL,
    );

    const ligne = await clientOwner().journalAudit.findFirst({
      where: { entite: "societe", entite_id: SOCIETE_A },
      orderBy: { horodatage: "desc" },
      select: { valeurs_apres: true },
    });

    expect(ligne).not.toBeNull();
    const apres = ligne?.valeurs_apres as Record<string, unknown> | null;
    expect(apres).not.toBeNull();
    expect(apres).not.toHaveProperty("logo_octets");
    expect(apres?.logo_octets_taille).toBe(PNG_MINIMAL.length);
    expect(typeof apres?.logo_octets_sha256).toBe("string");
  });
});
