import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  CODE_FAMILLE_9EP,
  LIBELLE_FAMILLE_9EP,
  LIBELLE_SITE_9EP,
  MARQUE_MODELE_9EP,
  NUMERO_SERIE_9EP,
  RAISON_CLIENT_9EP,
  RAISON_HOMONYME_PAIRE_9EP,
  RAISON_HOMONYME_PAIRE_9EP_VARIANTE,
  RAISON_HOMONYME_SEUL_9EP,
  RAISON_SANS_HOMONYME_9EP,
  REFERENCE_MODELE_9EP,
  QR_TOKEN_9EP,
} from "./setup/scene-9ep";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EP-CORRECTIFS-SOLDE-CREATIONS — même recette que
 * `captures-9ek-creations-1.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, préfixée `9EP-` — jamais `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EP ?? "";
const PHASE = process.env.CAPTURES_9EP_PHASE ?? "apres";

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

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const FAMILLE_ID = uuidv7();
const MODELE_ID = uuidv7();
const MACHINE_ID = uuidv7();
const CLIENT_HOMONYME_SEUL_ID = uuidv7();
const CLIENT_HOMONYME_1_ID = uuidv7();
const CLIENT_HOMONYME_2_ID = uuidv7();

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_CLIENT_9EP,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_9EP,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ID,
        societe_id: societe.id,
        code: CODE_FAMILLE_9EP,
        libelle: LIBELLE_FAMILLE_9EP,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_ID,
        societe_id: societe.id,
        famille_id: FAMILLE_ID,
        marque: MARQUE_MODELE_9EP,
        reference: REFERENCE_MODELE_9EP,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: societe.id,
        modele_id: MODELE_ID,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: NUMERO_SERIE_9EP,
        qr_token: QR_TOKEN_9EP,
      },
    });
    // UN SEUL HOMONYME (raison sociale unique), PUIS DEUX (même forme
    // normalisée, casse et espaces différents) — deux scènes distinctes.
    await client.client.create({
      data: {
        id: CLIENT_HOMONYME_SEUL_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_HOMONYME_SEUL_9EP,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_HOMONYME_1_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_HOMONYME_PAIRE_9EP,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_HOMONYME_2_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_HOMONYME_PAIRE_9EP_VARIANTE,
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
    await client.machine.deleteMany({ where: { id: MACHINE_ID } });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE_ID } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({
      where: {
        id: {
          in: [
            CLIENT_ID,
            CLIENT_HOMONYME_SEUL_ID,
            CLIENT_HOMONYME_1_ID,
            CLIENT_HOMONYME_2_ID,
          ],
        },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — /parc/nouvelle, vide (points 48, 49), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/parc/nouvelle?client=${CLIENT_ID}&site=${SITE_ID}`);
    await capturer(page, "parc-nouvelle", largeur);
  });

  test(`capture — /parc/[id]/modifier (point 46), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/parc/${MACHINE_ID}/modifier`);
    await capturer(page, "parc-modifier", largeur);
  });

  test(`capture — /clients/nouveau, 0 homonyme (point 40), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await page
      .locator('input[name="raison_sociale"]')
      .fill(RAISON_SANS_HOMONYME_9EP);
    await page.locator('input[name="code_externe"]').focus();
    await page.waitForTimeout(500);
    await capturer(page, "clients-nouveau-homonymes-0", largeur);
  });

  test(`capture — /clients/nouveau, 1 homonyme (point 40), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await page
      .locator('input[name="raison_sociale"]')
      .fill(RAISON_HOMONYME_SEUL_9EP);
    await page.locator('input[name="code_externe"]').focus();
    await page.waitForTimeout(500);
    await capturer(page, "clients-nouveau-homonymes-1", largeur);
  });

  test(`capture — /clients/nouveau, 2 homonymes (point 40), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await page
      .locator('input[name="raison_sociale"]')
      .fill(RAISON_HOMONYME_PAIRE_9EP);
    await page.locator('input[name="code_externe"]').focus();
    await page.waitForTimeout(500);
    await capturer(page, "clients-nouveau-homonymes-2", largeur);
  });

  test(`capture — /sites/nouveau (point 38), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/sites/nouveau");
    await capturer(page, "sites-nouveau", largeur);
  });
}
