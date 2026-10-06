import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9DU-TP-NAV3-RECHERCHE-RAIL (D171) — RECHERCHE GLOBALE, « CRÉER », RAIL ET
 * DÉCOMPTES DU MENU.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DU-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/9dr-fil-d-ariane.spec.ts`. Un seul
 * client, un seul site, nommés `9DU-…` pour ne jamais se confondre avec la
 * scène d'un autre fichier joué en parallèle (`fullyParallel`) — aucune
 * assertion ici ne compte une liste PARTAGÉE, chacune cherche SON nom.
 *
 * Le décompte du menu (QE-5) est éprouvé séparément, sans la base, par
 * `tests/unit/navigation/decomptes.test.ts` — voir son en-tête pour le piège
 * que compter une liste partagée en bout en bout aurait posé ici.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9DU = uuidv7();
const SITE_9DU = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9DU,
        societe_id: societeId,
        raison_sociale: fr["9du.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DU,
        societe_id: societeId,
        client_id: CLIENT_9DU,
        agence_id: agence.id,
        libelle: fr["9du.e2e.site"],
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.site.deleteMany({ where: { client_id: CLIENT_9DU } });
    await client.client.deleteMany({ where: { id: CLIENT_9DU } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("Ctrl K ouvre la recherche globale, un résultat mène à sa fiche (QE-3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  await page.keyboard.press("Control+k");
  const dialogue = page.getByRole("dialog", { name: fr["nav.rechercher"] });
  await expect(dialogue).toBeVisible();

  await dialogue.getByRole("searchbox").fill("9DU-Client");
  // `exact: true` — le même nom de client est aussi le DÉBUT du libellé du
  // site qu'il porte (« <client> · <site> »), et une correspondance par
  // sous-chaîne trouverait les deux.
  const resultat = dialogue.getByRole("link", {
    name: fr["9du.e2e.client"],
    exact: true,
  });
  await expect(resultat).toBeVisible();
  await expect(resultat).toHaveAttribute("href", `/clients/${CLIENT_9DU}`);

  await resultat.click();
  await expect(page).toHaveURL(`/clients/${CLIENT_9DU}`);
});

test("le menu « Créer » ne propose que des créations permises, et mène à la bonne page (QE-3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  const bouton = page.getByRole("button", { name: fr["nav.creer"] });
  await bouton.click();
  const menu = page.getByRole("menu", { name: fr["nav.creer"] });
  await expect(menu).toBeVisible();

  // L'ATTRIBUT `href`, jamais le libellé : « Machine » porte dans son AIDE
  // (« Dans le parc d'un client ») le mot « client », et une correspondance
  // par nom confondrait les deux options.
  const creerClient = menu.locator(
    '[role="menuitem"][href="/clients/nouveau"]',
  );
  await expect(creerClient).toBeVisible();
  await creerClient.click();
  await expect(page).toHaveURL("/clients/nouveau");
});

test("le menu passe en rail à 1000 px, et la préférence survit au rechargement (QE-4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/planning");

  const colonne = page.locator("#colonne-navigation");
  await expect
    .poll(async () =>
      colonne.evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    )
    .toBe(76);

  const basculer = page.getByRole("button", {
    name: fr["nav.deplier_le_menu"],
  });
  await basculer.click();
  await expect
    .poll(async () =>
      colonne.evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    )
    .toBe(272);

  await page.reload();
  await expect
    .poll(async () =>
      colonne.evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    )
    .toBe(272);
});

test("à 1280 px, sans préférence posée, le menu reste déployé (QE-4, cohérent avec COQUE-375)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  const colonne = page.locator("#colonne-navigation");
  await expect
    .poll(async () =>
      colonne.evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    )
    .toBe(272);
});
