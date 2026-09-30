import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-D4-TELEPHONE-ONGLETS (D146) — même recette que
 * `captures-pg-c2-file-onglets.spec.ts` : AVANT sur le code d'avant ce
 * ticket (git worktree), APRÈS sur le code livré. `data-onglets-telephone`
 * n'existe pas sur le code d'AVANT : c'est le témoin de la mesure.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGD4 ?? "";

const CLIENT_PGD4 = uuidv7();
const SITE_PGD4 = uuidv7();
const A_PLANIFIER = uuidv7();
const PLANIFIEE = uuidv7();
const RANG_SEMAINES = 21;
const HEURE_DEBUT_MINUTES = 9 * 60 + 15;
const DUREE_MIN = 60;

let reperes: ReperesDeScene;
let jour: ReturnType<typeof jourDeLaScene>;
let lundiDeLaFenetre: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jour = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_SEMAINES * 7);
  lundiDeLaFenetre = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGD4,
        societe_id: reperes.societeId,
        raison_sociale: "PGD4CAP",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGD4,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGD4,
        agence_id: agence.id,
        libelle: "PGD4CAP",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p1',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF',
               'PGD4CAP — à planifier', now())`,
      A_PLANIFIER,
      reperes.societeId,
      agence.id,
      CLIENT_PGD4,
      SITE_PGD4,
    );
    await client.intervention.create({
      data: {
        id: PLANIFIEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_PGD4,
        site_id: SITE_PGD4,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(
          jour,
          HEURE_DEBUT_MINUTES,
          reperes.fuseau,
        ),
        creneau_fin: instantAMinutes(
          jour,
          HEURE_DEBUT_MINUTES + DUREE_MIN,
          reperes.fuseau,
        ),
        duree_estimee_min: DUREE_MIN,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [A_PLANIFIER, PLANIFIEE],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGD4,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGD4 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGD4 } });
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

async function ecrireMesure(
  nom: string,
  mesure: Record<string, unknown>,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(join(DOSSIER, `${nom}.json`), JSON.stringify(mesure, null, 2));
}

test.describe("à 375 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ouvrirUneSession(page);
  });

  test("capture — vue Semaine, sans onglet actif", async ({ page }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`,
    );
    const onglets = page.locator("[data-onglets-telephone]");
    const aTelephoneOnglets = (await onglets.count()) > 0;
    const carte = page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`);
    const carteVisible = await carte.isVisible();
    const boite = carteVisible ? await carte.boundingBox() : null;
    const hauteurPage = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await ecrireMesure("mesure-semaine", {
      onglets_telephone_presents: aTelephoneOnglets,
      position_carte_file_y: boite?.y ?? null,
      hauteur_page: hauteurPage,
    });
    await capturer(
      page,
      aTelephoneOnglets ? "semaine-apres" : "semaine-avant",
      375,
    );
  });

  test("capture — onglet « À traiter »", async ({ page }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}&volet=a_traiter`,
    );
    const onglets = page.locator("[data-onglets-telephone]");
    const aTelephoneOnglets = (await onglets.count()) > 0;
    await capturer(
      page,
      aTelephoneOnglets ? "a-traiter-apres" : "a-traiter-avant",
      375,
    );
    if (!aTelephoneOnglets) return;

    const carte = page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`);
    await expect(carte).toBeVisible();
    const boiteCarte = await carte.boundingBox();
    const hauteurPage = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await ecrireMesure("mesure-a-traiter", {
      position_carte_file_y: boiteCarte?.y ?? null,
      hauteur_page: hauteurPage,
    });

    // « POSER… » — LA FENÊTRE PLEIN ÉCRAN.
    const bouton = page
      .locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`)
      .locator("xpath=following-sibling::div[1]//button");
    if ((await bouton.count()) > 0) {
      await bouton.first().click();
      const fenetre = page.locator(`[data-fenetre-pose="${A_PLANIFIER}"]`);
      await expect(fenetre).toBeVisible();
      const boiteFenetre = await fenetre.boundingBox();
      await ecrireMesure("mesure-fenetre-pose", {
        largeur: boiteFenetre?.width ?? null,
        hauteur: boiteFenetre?.height ?? null,
      });
      await capturer(page, "fenetre-pose-apres", 375);
    }
  });

  test("capture — vue Jour", async ({ page }) => {
    await page.goto(`/planning?vue=jour&jour=${cleDeJour(jour)}`);
    const onglets = page.locator("[data-onglets-telephone]");
    const aTelephoneOnglets = (await onglets.count()) > 0;
    await capturer(page, aTelephoneOnglets ? "jour-apres" : "jour-avant", 375);
  });
});

test.describe("témoins", () => {
  for (const largeur of [1024, 1280]) {
    test(`capture — témoin à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
      await page.goto(
        `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}&volet=a_traiter`,
      );
      await capturer(page, "temoin", largeur);
    });
  }
});
