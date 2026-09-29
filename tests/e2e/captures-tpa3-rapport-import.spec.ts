import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  fabriquerLeClasseurTpa3LigneValide,
  fabriquerLeClasseurTpa3RejetsGroupes,
} from "./setup/classeur-tpa3";
import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE TP-A3-RAPPORT-IMPORT (audit du 28/09/2026, VERIF-PA-MO) —
 * même recette que `captures-pg-b6-duree-a-la-creation.spec.ts` : AVANT sur
 * le code d'avant ce lot (`git stash`, le commit `2cdee2b`,
 * 9BM-PG-G7-ANNULER-DUREE-CREATION, le dernier avant ce ticket), APRÈS sur
 * le code livré.
 *
 * `[data-groupe-motif]` et le dialogue d'annulation sont des sélecteurs qui
 * n'existent PAS sur le code d'AVANT — ce fichier ne les affirme jamais,
 * seulement les libellés et écrans déjà présents avant ce lot, pour rester
 * rejouable des deux côtés du `git stash` (même discipline que
 * `captures-gr15-motif-rejet.spec.ts`).
 *
 * Aucune fixture `SCENE.*` : chaque classeur est fabriqué (I9), les codes
 * externes sont préfixés `TPA3-capture-`, et les lots / fiches créés par ce
 * fichier sont nettoyés en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA3_RAPPORT_IMPORT ?? "";
const PREFIXE = "TPA3-capture-applique-";

const idsDesLots: string[] = [];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  const client = admin();
  try {
    if (idsDesLots.length > 0) {
      await client.importLot.deleteMany({ where: { id: { in: idsDesLots } } });
    }
    await client.client.deleteMany({
      where: { raison_sociale: { startsWith: `Garage ${PREFIXE}` } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(page: Page, nom: string, largeur: number) {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function deposer(page: Page, nom: string, classeur: Buffer) {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: nom,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: classeur,
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — /imports, à ${largeur}px`, async ({ page }) => {
      await page.goto("/imports");
      await capturer(page, "imports-liste", largeur);
    });

    test(`capture — rapport avec des rejets, replié puis ouvert, à ${largeur}px`, async ({
      page,
    }) => {
      await deposer(
        page,
        `tpa3-capture-rejets-${largeur}.xlsx`,
        await fabriquerLeClasseurTpa3RejetsGroupes(),
      );
      idsDesLots.push(/\/imports\/([0-9a-f-]{36})$/.exec(page.url())![1]);
      await capturer(page, "rapport-rejets-replie", largeur);

      const groupe = page.locator("details").first();
      if ((await groupe.count()) > 0) {
        await groupe.locator("summary").click();
      }
      await capturer(page, "rapport-rejets-ouvert", largeur);
    });

    test(`capture — rapport appliqué, à ${largeur}px`, async ({ page }) => {
      const code = `${PREFIXE}${largeur}`;
      await deposer(
        page,
        `tpa3-capture-applique-${largeur}.xlsx`,
        await fabriquerLeClasseurTpa3LigneValide(code),
      );
      const id = /\/imports\/([0-9a-f-]{36})$/.exec(page.url())![1];
      idsDesLots.push(id);

      await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
      await expect(page.getByText(fr["imports.applique"])).toBeVisible();

      // La durée remise à NULL par le client d'administration — comme
      // `tests/isolation/ecran-import.test.ts` pose un type à la main — pour
      // capturer l'anomalie « non mesurée » d'un lot pourtant appliqué.
      const client = admin();
      try {
        await client.$executeRawUnsafe(
          `UPDATE "import_lot" SET "duree_application_ms" = NULL WHERE "id" = $1::uuid`,
          id,
        );
      } finally {
        await client.$disconnect();
      }
      await page.reload();
      await capturer(page, "rapport-applique", largeur);

      // Le dialogue d'annulation, ouvert.
      await page.getByRole("button", { name: fr["imports.annuler"] }).click();
      await capturer(page, "dialogue-annulation", largeur);
    });

    test(`capture — lot introuvable, à ${largeur}px`, async ({ page }) => {
      await page.goto("/imports/00000000-0000-0000-0000-000000000000");
      await capturer(page, "lot-introuvable", largeur);
    });
  });
}
