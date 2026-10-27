import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9H4-FINITIONS-AVANT-AUDIT, POINT 8 — « BON D'INTERVENTION », L'ACTION
 * PRIMAIRE D'UNE FICHE CLÔTURÉE, COLLÉE AU BAS DE L'ÉCRAN SOUS 901 PX.
 *
 * `<LienPrimaire>` était posé NU (`app/(back-office)/interventions/[id]/
 * page.tsx`), à sa place dans le flux des gestes d'avancement — jamais
 * enrobé de `BarreActionCollee`, contrairement à TOUTES les autres fiches
 * du back-office (clients, sites, parc, demandes). Même recette que
 * `9g3-point3-action-collee.spec.ts` : pleine largeur sous 375 px, largeur
 * de contenu à 1280 px.
 *
 * SA PROPRE FIXTURE, JAMAIS UN SCENE.x PARTAGÉ (AFFICHAGE-MATERIEL-1,
 * 23/09/2026) — le statut `cloturee` est permanent, et la fixture n'est
 * jamais mutée ailleurs : une ligne minimale, à un identifiant fixe,
 * détruite puis recréée par `beforeAll` (STABILITE-2).
 */
test.describe.configure({ mode: "serial" });

const FICHE_CLOTUREE = "01a0f300-0000-7000-8000-000000000001";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: ducos.id },
      select: { id: true, client_id: true },
    });
    await client.intervention.deleteMany({ where: { id: FICHE_CLOTUREE } });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id",
         "site_id", "technicien_id", "type", "priorite", "statut",
         "date_planifiee", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'cloturee'::"StatutIntervention", now()::date,
               now())`,
      FICHE_CLOTUREE,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: FICHE_CLOTUREE } });
  } finally {
    await client.$disconnect();
  }
});

function lienBon(page: Page) {
  return page
    .locator("#contenu")
    .getByRole("link", { name: fr["intervention.bon.titre"] });
}

test("à 375 px, « Bon d'intervention » occupe toute la largeur de la barre collée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${FICHE_CLOTUREE}`);

  const lien = lienBon(page);
  await expect(lien).toBeVisible();
  const boite = await lien.boundingBox();
  expect(boite).not.toBeNull();
  // Pleine largeur, moins le `p-3` (12 px) de chaque côté de la barre
  // collée (`BarreActionCollee`).
  expect(boite!.width).toBeGreaterThan(375 - 24 - 1);
});

test("à 1280 px, « Bon d'intervention » garde sa largeur de contenu — le bureau ne change pas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${FICHE_CLOTUREE}`);

  const lien = lienBon(page);
  await expect(lien).toBeVisible();
  const boite = await lien.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.width).toBeLessThan(200);
});
