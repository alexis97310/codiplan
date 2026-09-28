import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-C1a-EN-RETARD-PLANNING (28/09/2026) — même recette que
 * `captures-pg-a8-annulees-masquees.spec.ts`.
 *
 * Une intervention PLANIFIÉE, datée d'HIER (calculé au moment de l'épreuve —
 * « en retard » dépend d'aujourd'hui, à la différence des captures déjà
 * écrites qui datent sur un jour fixe), préfixe `PGC1ACAP-`, jamais une
 * fixture `SCENE.*` partagée. AVANT/APRÈS se prend en rejouant ce même
 * fichier deux fois — une fois sur le code d'avant le lot, une fois sur le
 * code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_C1A ?? "";

const CLIENT_PGC1ACAP = uuidv7();
const SITE_PGC1ACAP = uuidv7();
const INTERVENTION_EN_RETARD = uuidv7();

const HIER = new Date(Date.now() - 24 * 60 * 60 * 1000);
const HIER_ISO = HIER.toISOString().slice(0, 10);

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_PGC1ACAP,
        societe_id: reperes.societeId,
        raison_sociale: "PGC1ACAP — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGC1ACAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGC1ACAP,
        agence_id: agence.id,
        libelle: "PGC1ACAP — Lieu de l'épreuve",
      },
    });

    // PLANIFIÉE, datée d'hier, AUCUN segment de travail — en retard.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id",
          "technicien_id", "type", "priorite", "statut", "date_planifiee",
          "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p2', 'planifiee'::"StatutIntervention", $7::date,
               60, now())`,
      INTERVENTION_EN_RETARD,
      reperes.societeId,
      CLIENT_PGC1ACAP,
      SITE_PGC1ACAP,
      agence.id,
      reperes.technicienDucos,
      HIER_ISO,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGC1ACAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGC1ACAP } });
    await client.client.deleteMany({ where: { id: CLIENT_PGC1ACAP } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — carte en retard`, async ({ page }) => {
      await page.goto(`/planning?vue=jour&jour=${HIER_ISO}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "carte-en-retard", largeur);
    });
  });
}
