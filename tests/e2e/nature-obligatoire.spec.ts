import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99P-GR1-NATURE (26/09/2026) — LA NATURE NE SE PRÉREMPLIT PLUS.
 *
 * Audit d'ergonomie du 26/09/2026, constat B1 : sur `/interventions/nouvelle`,
 * « Nature (obligatoire) » arrivait toujours sur « Préventif sous contrat » —
 * la PREMIÈRE valeur de `TYPES_INTERVENTION` —, y compris depuis une demande
 * curative. Un `<select>` sans option vide retient TOUJOURS sa première
 * valeur : personne ne choisissait rien, et un appel curatif partait
 * silencieusement en préventif.
 *
 * Ce fichier prouve, par l'ÉCRAN, les trois faces du correctif :
 * 1. le formulaire ouvre sur une nature VIDE, jamais présélectionnée ;
 * 2. la soumettre vide est refusée par un motif DÉDIÉ, et rien n'est créé ;
 * 3. arrivée depuis une demande, la nature reste vide — une demande ne porte
 *    aucune nature d'intervention à transmettre.
 *
 * Sa propre scène, préfixée `ERGO1-`, créée et supprimée par l'épreuve —
 * jamais empruntée au semis partagé (mémoire du poste : « un spec qui compte
 * pose SON site »).
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "ERGO1-";
const RAISON_SOCIALE = `${PREFIXE}Client (épreuve nature obligatoire)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (épreuve nature obligatoire)`;
const PANNE = `${PREFIXE}Panne — épreuve nature obligatoire`;
const DESCRIPTION_DEMANDE = `${PREFIXE}Demande — épreuve nature obligatoire`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const DEMANDE_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { description: { startsWith: PREFIXE } },
  });
  await client.demande.deleteMany({ where: { id: DEMANDE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });

    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_ID,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        description: DESCRIPTION_DEMANDE,
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le formulaire de création ouvre sur une nature vide", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await expect(page.locator('select[name="type"]')).toHaveValue("");
});

test("soumettre sans nature est refusé par un motif dédié, et ne crée rien", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const avant = await client.intervention.count({
      where: { description: { startsWith: PREFIXE } },
    });

    await page.goto("/interventions/nouvelle");
    await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
    await page.locator('textarea[name="description"]').fill(PANNE);
    await page
      .getByRole("button", { name: fr["intervention.action.creer"] })
      .click();
    await page.waitForLoadState("networkidle");

    // ── LE REFUS REVIENT AU FORMULAIRE, AVEC UN MOTIF DÉDIÉ ─────────────────
    await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);
    await expect(page.getByRole("status")).toContainText(
      fr["intervention.refus.nature_manquante"],
    );
    await expect(page.locator('select[name="type"]')).toHaveValue("");

    // ── RIEN N'A ÉTÉ CRÉÉ ────────────────────────────────────────────────────
    const apres = await client.intervention.count({
      where: { description: { startsWith: PREFIXE } },
    });
    expect(apres).toBe(avant);
  } finally {
    await client.$disconnect();
  }
});

test("arrivée depuis une demande, la nature reste vide aussi", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?demande=${DEMANDE_ID}`);
  // LE LIEU EST PRÉREMPLI — la preuve que la demande a bien résolu.
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(`${RAISON_SOCIALE} — ${LIBELLE_SITE}`);
  // LA NATURE NE L'EST PAS — une demande ne porte aucune nature.
  await expect(page.locator('select[name="type"]')).toHaveValue("");
});
