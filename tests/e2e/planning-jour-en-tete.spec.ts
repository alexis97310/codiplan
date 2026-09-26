import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99G-PLANNING-JOUR (audit d'ergonomie du 25/09/2026, constat 14) — L'EN-TÊTE
 * DE LA VUE JOUR DIT D'ABORD QUI EST LÀ ET QUI EST BLOQUÉ, LA LÉGENDE EN TÊTE.
 *
 * ## Ce que les gardiens unitaires ne prouvent pas
 *
 * `tests/unit/planning/carte.test.ts` éprouve `resumeDesTechniciens` sur des
 * tableaux : le compte, l'accord, le nom tu quand l'annuaire le refuse. Il ne
 * prouve rien de l'ÉCRAN — que la légende soit remontée AU-DESSUS de la grille
 * et VISIBLE SANS DÉFILER à 1280 px, ni que l'en-tête réel compose bien les
 * deux résumés (qui, puis les trous) l'un à côté de l'autre. C'est la
 * frontière que ce fichier traverse.
 *
 * ## La scène : un blocage réel, sur guérin (Ducos), 16 semaines plus loin
 *
 * Aucun technicien ni aucune intervention n'est créé : la vue jour donne déjà
 * une colonne à CHAQUE technicien actif, qu'il ait une intervention ce jour-là
 * ou non (R2-14, 12/09/2026) — seule une absence suffit à faire apparaître le
 * blocage. Le jour choisi (`MARDI + 112`, un multiple de 7 de plus que le plus
 * grand déjà réservé — 21/35/49/63/91/92/98/105) ne recoupe aucune fixture
 * d'un autre fichier e2e.
 */

// SÉRIE : `beforeAll` écrit en base (l'absence de blocage), et sous
// `fullyParallel` deux ouvriers peuvent le rejouer en même temps.
test.describe.configure({ mode: "serial" });

const SEMAINES_DE_DECALAGE = 16;

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;
let jourVise: string;
const BLOCAGE_ID = randomUUID();

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const jour = jourSuivant(
    jourDeLaScene(reperes, MARDI),
    7 * SEMAINES_DE_DECALAGE,
  );
  jourVise = cleDeJour(jour);
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const dateDuJour = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    await client.$executeRawUnsafe(
      `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $4::date, now())
       ON CONFLICT DO NOTHING`,
      BLOCAGE_ID,
      reperes.societeId,
      reperes.technicienDucos,
      dateDuJour,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.absence.deleteMany({ where: { id: BLOCAGE_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99G-PLANNING-JOUR/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: false,
  });
}

test("l'en-tête dit qui est bloqué, et le compte de créneaux libres reste affiché", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  let nomGuerin: string;
  try {
    nomGuerin = (
      await client.utilisateur.findUniqueOrThrow({
        where: { id: reperes.technicienDucos },
        select: { nom: true },
      })
    ).nom;
  } finally {
    await client.$disconnect();
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/planning?vue=jour&jour=${jourVise}`);

  // L'EN-TÊTE — un seul <p>, enfant direct de la section de la vue jour.
  const enTete = page.locator('[data-maquette-bloc="vue-jour"] > p');
  await expect(enTete).toBeVisible();
  const texte = await enTete.textContent();
  expect(texte).not.toBeNull();

  // « N techniciens » (ou « 1 technicien ») EN TÊTE, avant le reste.
  expect(texte).toMatch(/^\d+ techniciens?/);
  // Le blocage nomme la personne, tirée de l'annuaire — jamais un nom en dur.
  expect(texte).toContain(`agenda bloqué (${nomGuerin})`);
  // Le compte de créneaux libres N'EST PAS remplacé (docs/backlog.md, R2-14).
  expect(texte).toMatch(/\d+ créneaux? libres?/);

  // LA LÉGENDE — remontée AU-DESSUS de la grille, visible sans défiler.
  const legende = page.locator('[data-maquette-bloc="vue-jour"] > ul').first();
  await expect(legende).toBeVisible();
  await expect(legende).toBeInViewport();

  // AUCUNE légende dupliquée sous la grille : un seul <ul> direct.
  await expect(
    page.locator('[data-maquette-bloc="vue-jour"] > ul'),
  ).toHaveCount(1);

  await capturer(page, "en-tete-et-legende-1280");
});

test("le TÉMOIN — sans blocage, aucune mention n'apparaît", async ({
  page,
}) => {
  const veille = jourSuivant(
    jourDeLaScene(reperes, MARDI),
    7 * SEMAINES_DE_DECALAGE - 1,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(veille)}`);

  const enTete = page.locator('[data-maquette-bloc="vue-jour"] > p');
  await expect(enTete).toBeVisible();
  const texte = await enTete.textContent();
  expect(texte).not.toBeNull();
  expect(texte).not.toContain("agenda bloqué");
});
