import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-A8-ANNULEES-MASQUEES (28/09/2026) — même recette que
 * `captures-pg-a5-fiche-creneau.spec.ts` : rien n'est écrit sans une
 * variable d'environnement qui nomme le dossier.
 *
 * Deux interventions ANNULÉES (préfixe `PGA8CAP-`), à leur propre ligne
 * fixe, jamais une fixture `SCENE.*` partagée : l'une sans date (file
 * d'attente), l'autre datée dans la semaine affichée (grille).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A8 ?? "";

const CLIENT_PGA8CAP = uuidv7();
const SITE_PGA8CAP = uuidv7();
const INTERVENTION_SANS_DATE = uuidv7();
const INTERVENTION_DATEE = uuidv7();

// Un lundi fixe, et un jeudi de la même semaine — Ducos ouvre les deux jours.
const SEMAINE = "2026-09-21";
const JOUR_DATE = "2026-09-24T00:00:00Z";

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
        id: CLIENT_PGA8CAP,
        societe_id: reperes.societeId,
        raison_sociale: "PGA8CAP — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA8CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA8CAP,
        agence_id: agence.id,
        libelle: "PGA8CAP — Lieu de l'épreuve",
      },
    });

    // SANS DATE — la file d'attente, quand le filtre les remontre.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'annulee'::"StatutIntervention", now())`,
      INTERVENTION_SANS_DATE,
      reperes.societeId,
      CLIENT_PGA8CAP,
      SITE_PGA8CAP,
      agence.id,
    );

    // DATÉE — la grille, quand le filtre les remontre.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id",
          "technicien_id", "type", "priorite", "statut", "date_planifiee",
          "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'annulee'::"StatutIntervention", $7::date, 60,
               now())`,
      INTERVENTION_DATEE,
      reperes.societeId,
      CLIENT_PGA8CAP,
      SITE_PGA8CAP,
      agence.id,
      reperes.technicienDucos,
      JOUR_DATE,
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
      CLIENT_PGA8CAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA8CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA8CAP } });
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

    test(`capture — filtre décoché`, async ({ page }) => {
      await page.goto(`/planning?vue=semaine&semaine=${SEMAINE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "decoche", largeur);
    });

    test(`capture — filtre coché`, async ({ page }) => {
      await page.goto(`/planning?vue=semaine&semaine=${SEMAINE}&annulees=1`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "coche", largeur);
    });
  });
}
