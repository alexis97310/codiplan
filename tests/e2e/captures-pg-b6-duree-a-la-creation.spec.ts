import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import type { ReperesDeScene } from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-B6-DUREE-A-LA-CREATION (29/09/2026, audit du 27/09
 * §4.3 ; décision QG-12 d'Alexis : des choix rapides, AUCUNE VALEUR PAR
 * DÉFAUT) — même recette que `captures-pg-a7-semaine-garde-heure.spec.ts` :
 * AVANT sur le code d'avant ce ticket (`git stash`, le dernier commit livré),
 * APRÈS sur le code livré.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB6-` — un client et un site créés en
 * `beforeAll`, supprimés en `afterAll`.
 *
 * AVANT ce ticket, le formulaire de création ne porte aucun champ de durée,
 * et « Créer » mène directement à la fiche, sans bandeau. APRÈS, le
 * formulaire porte les puces « Durée prévue », et la fiche affiche le
 * bandeau « Intervention créée » avec ses deux choix.
 *
 * `[data-banniere-creation]` est une CHAÎNE, jamais une clé typée du
 * dictionnaire — elle n'existe pas encore sur le code d'AVANT, et
 * `tsconfig.json` inclut `tests/` (le build type-vérifie ce fichier sur
 * l'ancien code aussi).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_B6 ?? "";

const CLIENT_PGB6 = uuidv7();
const SITE_PGB6 = uuidv7();
const LIBELLE_SITE = "PGB6-capture-site";

let reperes: ReperesDeScene;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGB6,
        societe_id: reperes.societeId,
        raison_sociale: "PGB6-capture-client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB6,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB6,
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
    await client.intervention.deleteMany({ where: { client_id: CLIENT_PGB6 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB6 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB6 } });
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

async function remplirLeFormulaire(page: Page, panne: string): Promise<void> {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('select[name="type"]').selectOption("curatif");
  await page.locator('textarea[name="description"]').fill(panne);
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1100 });
      await ouvrirUneSession(page);
    });

    test(`capture — le formulaire de création, à ${largeur}px`, async ({
      page,
    }) => {
      await remplirLeFormulaire(page, `PGB6-capture-formulaire-${largeur}`);
      await capturer(page, "formulaire-creation", largeur);
    });

    test(`capture — l'écran après « Créer », à ${largeur}px`, async ({
      page,
    }) => {
      await remplirLeFormulaire(page, `PGB6-capture-apres-${largeur}`);
      await page
        .getByRole("button", { name: fr["intervention.action.creer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+/);
      await capturer(page, "apres-creation", largeur);
    });
  });
}
