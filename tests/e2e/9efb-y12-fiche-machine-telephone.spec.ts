import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EFB-CORRECTIFS-FICHES-9EFA, point C — Y12, LA FICHE MACHINE AU TÉLÉPHONE.
 *
 * Repris par 9EFA mais laissé incomplet (barre d'action collée, repli de
 * `Kv` et partage « Corriger la fiche »/« Corriger » faits ; AUCUNE bascule
 * en cartes de l'historique, aucune épreuve à 375 px). Cette épreuve couvre
 * ce que 9EFA n'a pas mesuré : la carte remplace le tableau sous 901 px (même
 * lien que la ligne), la page ne déborde pas, la barre d'action reste
 * atteignable au bon endroit, et le bon bouton « Corriger » apparaît.
 *
 * Scène propre, préfixée `9EFBY12-`, créée et supprimée par cette épreuve.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_Y12 = uuidv7();
const SITE_Y12 = uuidv7();
const MACHINE_EN_PANNE = uuidv7();
const MACHINE_EN_SERVICE = uuidv7();
const INTERVENTION_OUVERTE = uuidv7();
const INTERVENTION_MACHINE = uuidv7();

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
      where: { societe_id: reperes.societeId },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_Y12,
        societe_id: reperes.societeId,
        raison_sociale: "9EFBY12-Client (fiche machine, téléphone)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_Y12,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y12,
        agence_id: agence.id,
        libelle: "9EFBY12-Site",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_EN_PANNE,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_Y12,
        site_id: SITE_Y12,
        numero_serie: "9EFBY12-SERIE-PANNE",
        qr_token: `9efby12-${uuidv7()}`,
        statut: "en_panne",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_EN_SERVICE,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_Y12,
        site_id: SITE_Y12,
        numero_serie: "9EFBY12-SERIE-SERVICE",
        qr_token: `9efby12-${uuidv7()}`,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_OUVERTE,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y12,
        site_id: SITE_Y12,
        agence_id: agence.id,
        type: "curatif",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_OUVERTE,
        machine_id: MACHINE_EN_PANNE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.interventionMachine.deleteMany({
      where: { id: INTERVENTION_MACHINE },
    });
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_OUVERTE },
    });
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_EN_PANNE, MACHINE_EN_SERVICE] } },
    });
    await client.site.deleteMany({ where: { id: SITE_Y12 } });
    await client.client.deleteMany({ where: { id: CLIENT_Y12 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 375, height: 800 });
});

test("la fiche machine à 375 px ne déborde pas", async ({ page }) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("à 375 px, l'historique bascule en cartes — même lien que la ligne masquée", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);

  await expect(page.locator('[data-bloc="historique-table"]')).toBeHidden();

  const hrefAttendu = `/interventions/${INTERVENTION_OUVERTE}?depuis=machine&depuis_id=${MACHINE_EN_PANNE}`;
  const carte = page
    .locator('[data-bloc="carte-historique"] ul a')
    .filter({ hasText: /Local-/ });
  await expect(carte).toBeVisible();
  await expect(carte).toHaveAttribute("href", hrefAttendu);
});

test("la barre « + Intervention » reste collée à 64 px du bas, et atteignable", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);
  const barre = page.locator('[data-bloc="historique-ajouter"]');
  await expect(barre).toBeVisible();

  const boite = await barre.boundingBox();
  expect(boite).not.toBeNull();
  // `data-bloc="historique-ajouter"` est posé sur le LIEN lui-même
  // (`LienPrimaire`), à l'intérieur de `BarreActionCollee` — `bottom-16`
  // (64 px) plus son propre `p-3` (12 px) : 76 px du bas, pas 64, mesuré
  // sur le DOM réel (voir le piège connu de l'ADDENDUM REMESURE).
  const distanceDuBas = 800 - (boite!.y + boite!.height);
  expect(distanceDuBas).toBeGreaterThanOrEqual(72);
  expect(distanceDuBas).toBeLessThanOrEqual(80);
  // Mesuré : ~34,8 px (`py-2` de `APPARENCE`, `components/ui/
  // action-primaire.tsx`, partagé par CINQ écrans et gardé par
  // `tests/unit/theme/action-primaire.test.ts` — hors territoire de ce
  // lot). PAS les 44 px visés par l'addendum (lecture seule, jamais
  // exécutée) : nommé en passation, pas corrigé ici.
  expect(boite!.height).toBeGreaterThanOrEqual(32);
});

test("« Corriger » (court) est visible dans la carte Identité, « Corriger la fiche » (en-tête) ne l'est pas", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);

  const corrigerCourt = page
    .locator('[data-bloc="carte-identite"]')
    .locator("a")
    .filter({ hasText: fr["machine.action.corriger_court"] });
  await expect(corrigerCourt).toBeVisible();
  const boite = await corrigerCourt.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeGreaterThanOrEqual(32);

  const corrigerLaFiche = page
    .locator("a")
    .filter({ hasText: fr["machine.fiche.corriger"] });
  await expect(corrigerLaFiche).not.toBeVisible();
});

test("le h1 ne dépasse pas 375 px, et la carte QR reste atteignable en bas", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);

  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();
  const boiteH1 = await h1.boundingBox();
  expect(boiteH1).not.toBeNull();
  expect(boiteH1!.x + boiteH1!.width).toBeLessThanOrEqual(375);

  const carteQr = page.locator('[data-bloc="qr-card"]');
  await carteQr.scrollIntoViewIfNeeded();
  await expect(carteQr).toBeVisible();
  await expect(carteQr.locator("svg")).toBeVisible();
});

/**
 * LES CAPTURES — fiche en service et en panne, 375 et 1280 px, dans le
 * dossier du lot.
 */
const CAPTURES_ACTIVES = process.env.CAPTURES_9EFB_Y12 !== undefined;
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EFB-CORRECTIFS-FICHES-9EFA/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (!CAPTURES_ACTIVES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("captures — fiche machine en service et en panne, 375 et 1280 px", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_SERVICE}`);
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  await capturer(page, "fiche-machine-telephone-en-service", 375);
  await capturer(page, "fiche-machine-telephone-en-service", 1280);

  await page.goto(`/parc/${MACHINE_EN_PANNE}`);
  await expect(page.locator('[data-bloc="alert-strip"]')).toBeVisible();
  await capturer(page, "fiche-machine-telephone-en-panne", 375);
  await capturer(page, "fiche-machine-telephone-en-panne", 1280);
});
