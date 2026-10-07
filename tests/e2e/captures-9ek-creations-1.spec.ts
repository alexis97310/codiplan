import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EK-TP-UX5-2-CREATIONS-1 — même recette que
 * `captures-9br-tpa4b-messages.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EK ?? "";
const PHASE = process.env.CAPTURES_9EK_PHASE ?? "apres";

const PREFIXE = "9EKCAP-";
const CLIENT_HOMONYME = uuidv7();
const RAISON_HOMONYME = `${PREFIXE}Garage Dupont (scène)`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_HOMONYME,
        societe_id: societe.id,
        raison_sociale: RAISON_HOMONYME,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.client.deleteMany({
      where: { raison_sociale: { startsWith: PREFIXE } },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — /clients/nouveau, vide, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await capturer(page, "clients-nouveau-vide", largeur);
  });

  test(`capture — /clients/nouveau, alerte de doublon, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await page
      .locator('input[name="raison_sociale"]')
      .fill(RAISON_HOMONYME.toLowerCase());
    await page.locator('input[name="code_externe"]').focus();
    await page.waitForTimeout(500);
    await capturer(page, "clients-nouveau-doublon", largeur);
  });

  test(`capture — /sites/nouveau, vide, depuis « Créer et ajouter un site », à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(
      `/sites/nouveau?client=${CLIENT_HOMONYME}&motif=clients.cree`,
    );
    await capturer(page, "sites-nouveau-depuis-client", largeur);
  });

  test(`capture — /sites/nouveau, après un refus (saisie gardée), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/sites/nouveau");
    await choisirResultatParTexte(
      page,
      "client_id",
      RAISON_HOMONYME,
      RAISON_HOMONYME,
    );
    await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
    await page.locator('input[name="adresse"]').fill("12 rue des Palmiers");
    await page
      .locator('textarea[name="consignes_acces"]')
      .fill("Badge requis à l'entrée");
    await page
      .locator('form[action="/api/sites/creer"]')
      .evaluate((formulaire) => {
        formulaire
          .querySelector('[name="libelle"]')
          ?.removeAttribute("required");
      });
    await page
      .locator('form[action="/api/sites/creer"] button[type="submit"]')
      .click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "sites-nouveau-refus-saisie-gardee", largeur);
  });
}
