import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 1 (D188) — /demandes AU GABARIT
 * DE LA MAQUETTE DU 28/09 : sous-titre unique, colonne « Source », cartes
 * sous 900 px, « Qualifier » mène à la fiche.
 *
 * Fixture À SOI (préfixe `9EDZ-`), jamais le jeu partagé (mémoire du poste :
 * « un spec qui compte pose SON site »). L'état vide, lui, ne se prouve pas
 * ici : le jeu partagé de CODIMA-NC ne garantit aucun compte sans demande
 * ouverte, et la décision « lequel des deux états vides » est déjà prouvée,
 * pure, par `tests/unit/demandes/9edz-onglet-vide.test.ts`.
 */
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_9EDZ = "9edace00-0000-7000-8000-00000000d100";
const SITE_9EDZ = "9edace00-0000-7000-8000-00000000d101";
const DEMANDE_9EDZ = "9edace00-0000-7000-8000-00000000d102";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.demande.deleteMany({ where: { id: DEMANDE_9EDZ } });
  await client.site.deleteMany({ where: { id: SITE_9EDZ } });
  await client.client.deleteMany({ where: { id: CLIENT_9EDZ } });
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
        id: CLIENT_9EDZ,
        societe_id: societe.id,
        raison_sociale: "Client de la liste au gabarit (épreuve 9EDZ)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EDZ,
        societe_id: societe.id,
        client_id: CLIENT_9EDZ,
        agence_id: agence.id,
        libelle: "Lieu de la liste au gabarit (épreuve 9EDZ)",
        temps_trajet_min: 10,
      },
    });
    await client.demande.create({
      data: {
        id: DEMANDE_9EDZ,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_9EDZ,
        site_id: SITE_9EDZ,
        agence_id: agence.id,
        description: "Description de la demande 9EDZ (épreuve de liste)",
        urgence: "p3",
        depose_le: new Date(),
        compteur_accuse_le: new Date(),
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

test("le sous-titre unique s'affiche aux deux onglets", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");
  await expect(
    page.getByText(dictionnaire["demandes.sous_titre_page"]),
  ).toBeVisible();

  await page.goto("/demandes?onglet=traitees");
  await expect(
    page.getByText(dictionnaire["demandes.sous_titre_page"]),
  ).toBeVisible();
});

test("la colonne « Source » porte son libellé neuf", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");
  await expect(
    page.getByRole("columnheader", {
      name: dictionnaire["demandes.colonne.source"],
      exact: true,
    }),
  ).toBeVisible();
});

test("à 1280 px, le tableau est visible et les cartes masquées", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");
  await expect(
    page.locator(`tr[data-demande="${DEMANDE_9EDZ}"]`),
  ).toBeVisible();
  await expect(
    page.locator(`[data-demande-carte="${DEMANDE_9EDZ}"]`),
  ).toBeHidden();
});

test("à 375 px, une carte par demande s'affiche et le tableau est masqué", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/demandes");
  await expect(
    page.locator(`[data-demande-carte="${DEMANDE_9EDZ}"]`),
  ).toBeVisible();
  await expect(page.locator(`tr[data-demande="${DEMANDE_9EDZ}"]`)).toBeHidden();
});

test("« Qualifier » mène à la fiche de la demande", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");
  await page
    .locator(`tr[data-demande="${DEMANDE_9EDZ}"]`)
    .getByRole("link", { name: dictionnaire["demande.action.qualifier"] })
    .click();
  await expect(page).toHaveURL(`/demandes/${DEMANDE_9EDZ}`);
});
