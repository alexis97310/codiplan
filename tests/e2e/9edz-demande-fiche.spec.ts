import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 4 (D188) — /demandes/:id AU
 * GABARIT DE LA MAQUETTE DU 28/09 : « Suite donnée », « Créer
 * l'intervention », placeholder de nature.
 *
 * Fixture À SOI (préfixe `9EDZ3-`), jamais le jeu partagé.
 */
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_9EDZ3 = "9edace00-0000-7000-8000-00000000d300";
const SITE_9EDZ3 = "9edace00-0000-7000-8000-00000000d301";
const DEMANDE_TRANSFORMEE = "9edace00-0000-7000-8000-00000000d302";
const INTERVENTION_ISSUE = "9edace00-0000-7000-8000-00000000d303";
const DEMANDE_CLOSE = "9edace00-0000-7000-8000-00000000d304";
const DEMANDE_QUALIFIEE = "9edace00-0000-7000-8000-00000000d305";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ISSUE } });
  await client.demande.deleteMany({
    where: {
      id: { in: [DEMANDE_TRANSFORMEE, DEMANDE_CLOSE, DEMANDE_QUALIFIEE] },
    },
  });
  await client.site.deleteMany({ where: { id: SITE_9EDZ3 } });
  await client.client.deleteMany({ where: { id: CLIENT_9EDZ3 } });
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
      orderBy: { code: "asc" },
    });
    await client.client.create({
      data: {
        id: CLIENT_9EDZ3,
        societe_id: societe.id,
        raison_sociale: "Client de la fiche au gabarit (épreuve 9EDZ3)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EDZ3,
        societe_id: societe.id,
        client_id: CLIENT_9EDZ3,
        agence_id: agence.id,
        libelle: "Lieu de la fiche au gabarit (épreuve 9EDZ3)",
      },
    });
    const commun = {
      societe_id: societe.id,
      source: "appel" as const,
      client_id: CLIENT_9EDZ3,
      site_id: SITE_9EDZ3,
      agence_id: agence.id,
      urgence: "p3" as const,
      depose_le: new Date(),
      compteur_accuse_le: new Date(),
    };
    await client.demande.create({
      data: {
        id: DEMANDE_TRANSFORMEE,
        ...commun,
        description: "Demande transformée (épreuve 9EDZ3)",
        statut: "transformee",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ISSUE,
        societe_id: societe.id,
        client_id: CLIENT_9EDZ3,
        site_id: SITE_9EDZ3,
        agence_id: agence.id,
        type: "curatif",
        statut: "a_planifier",
        demande_id: DEMANDE_TRANSFORMEE,
      },
    });
    await client.demande.create({
      data: {
        id: DEMANDE_CLOSE,
        ...commun,
        description: "Demande close sans suite (épreuve 9EDZ3)",
        statut: "close_sans_suite",
        motif_cloture: "doublon",
        close_le: new Date(),
      },
    });
    await client.demande.create({
      data: {
        id: DEMANDE_QUALIFIEE,
        ...commun,
        description: "Demande qualifiée (épreuve 9EDZ3)",
        statut: "qualifiee",
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
});

test("une demande transformée affiche « Suite donnée » avec le lien vers son intervention", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_TRANSFORMEE}`);
  await expect(
    page.getByRole("heading", {
      name: dictionnaire["demandes.fiche.suite_donnee"],
    }),
  ).toBeVisible();
  const carte = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: dictionnaire["demandes.fiche.suite_donnee"],
    }),
  });
  await expect(carte).toContainText(
    dictionnaire["demande.refus.deja_transformee"],
  );
  await expect(
    carte.locator(`[data-intervention-issue="${INTERVENTION_ISSUE}"]`),
  ).toBeVisible();
});

test("une demande close affiche son motif dans « Suite donnée »", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_CLOSE}`);
  const carte = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: dictionnaire["demandes.fiche.suite_donnee"],
    }),
  });
  await expect(carte).toContainText(dictionnaire["demande.motif.doublon"]);
});

test("« Créer l'intervention » est le bouton DANS le formulaire de création, avec le placeholder neuf", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_QUALIFIEE}`);
  const forme = page.locator('form[action="/api/interventions/creer"]');
  await expect(forme).toBeVisible();
  await expect(
    forme.getByRole("button", {
      name: dictionnaire["demandes.fiche.creer_intervention"],
    }),
  ).toBeVisible();
  await expect(
    forme.locator(`select[name="type"] option[value=""]`),
  ).toHaveText(dictionnaire["intervention.creation.choisir_nature_demande"]);
});
