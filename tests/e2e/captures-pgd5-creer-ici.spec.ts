import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-D5-CREER-ICI — même recette que
 * `captures-pgd4-telephone-onglets.spec.ts` : AVANT sur le code d'avant ce
 * ticket (git worktree), APRÈS sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGD5 ?? "";

const CLIENT_PGD5 = uuidv7();
const SITE_PGD5 = uuidv7();
const LIBELLE_SITE = "PGD5CAP-site";
const RANG_SEMAINES = 23;

let reperes: ReperesDeScene;
let jourCible: ReturnType<typeof jourDeLaScene>;
let lundiDeLaFenetre: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jourCible = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_SEMAINES * 7);
  lundiDeLaFenetre = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGD5,
        societe_id: reperes.societeId,
        raison_sociale: "PGD5CAP-client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGD5,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGD5,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
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
      `DELETE FROM "segment_travail" WHERE "intervention_id" IN (SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid)`,
      CLIENT_PGD5,
    );
    await client.intervention.deleteMany({ where: { client_id: CLIENT_PGD5 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_PGD5 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGD5 } });
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

for (const largeur of [1280, 375]) {
  test(`capture — vue Semaine après clic sur une case vide, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`,
    );
    const jourCle = cleDeJour(jourCible);
    const case_ = page.locator(
      `td[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    const visible = (await case_.count()) > 0 && (await case_.isVisible());
    if (visible) {
      await case_.click();
    }
    const lien = page.locator("a[data-creer-ici]");
    const aLeLien = (await lien.count()) > 0;
    await capturer(
      page,
      aLeLien ? "semaine-creer-ici-apres" : "semaine-creer-ici-avant",
      largeur,
    );
  });
}

test("capture — vue Jour après clic sur une case libre, à 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(jourCible)}`);
  const case_ = page
    .locator(
      `td[data-depot-technicien="${reperes.technicienDucos}"][data-etat="libre"]`,
    )
    .first();
  if ((await case_.count()) > 0) {
    await case_.click();
  }
  const lien = page.locator("a[data-creer-ici]");
  const aLeLien = (await lien.count()) > 0;
  await capturer(
    page,
    aLeLien ? "jour-creer-ici-apres" : "jour-creer-ici-avant",
    1280,
  );
});

for (const largeur of [1280, 375]) {
  test(`capture — le formulaire /interventions/nouvelle?poser_…, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/nouvelle?poser_technicien=${reperes.technicienDucos}&poser_date=${cleDeJour(jourCible)}`,
    );
    const champCache = page.locator(
      'input[type="hidden"][name="poser_technicien"]',
    );
    const aLeChamp = (await champCache.count()) > 0;
    await capturer(
      page,
      aLeChamp ? "formulaire-apres" : "formulaire-avant",
      largeur,
    );

    if (!aLeChamp) return;

    // LA FICHE APRÈS CRÉATION, FENÊTRE OUVERTE PRÉ-REMPLIE.
    await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
    await page.locator('select[name="type"]').selectOption("curatif");
    await page
      .locator('textarea[name="description"]')
      .fill("PGD5CAP-panne-capture");
    await page
      .locator("#contenu")
      .getByRole("button", { name: fr["intervention.action.creer"] })
      .click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "fiche-fenetre-apres", largeur);
  });
}
