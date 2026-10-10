import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EF-TP-UX4-2-FICHES-2 — en-tête de la fiche machine (QE-9,
 * D192) et fiches contact des fiches client et site.
 *
 * **APRÈS SEULEMENT** — aucune image AVANT n'a été prise sur `main` avant ce
 * lot (même déviation que 9EF-TP-UX4-2-FICHES-1, documentée dans sa
 * passation) : écrire au premier plan `CAPTURES_9EF2=<dossier>` n'enregistre
 * donc que l'état APRÈS.
 *
 * Les machines EN SERVICE et EN PANNE viennent de la scène de DÉMONSTRATION
 * (`pnpm db:seed`), en LECTURE SEULE, sur le modèle de
 * `tests/e2e/fiche-machine.spec.ts` — aucune ligne n'y est écrite. Les
 * interlocuteurs ont besoin d'une scène propre (un donneur d'ordre actif
 * avec téléphone et courriel, un second interlocuteur) : `CLIENT_9EF2`/
 * `SITE_9EF2`, créés en `beforeAll`, supprimés en `afterAll`, préfixés pour
 * ne jamais se confondre avec une scène jouée en parallèle. Aucun des deux
 * n'est SANS courriel — mesuré IRRÉALISABLE : `contact_courriel_si_canal_
 * email` exige un courriel dès que `canaux` porte « email », et c'est le
 * seul canal connu (`CANAUX_CONNUS`) — voir la passation.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9EF2 = uuidv7();
const SITE_9EF2 = uuidv7();

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EF-TP-UX4-2-FICHES-2/captures",
);
const CAPTURES_ACTIVES = process.env.CAPTURES_9EF2 !== undefined;

async function capturer(page: Page, nom: string): Promise<void> {
  if (!CAPTURES_ACTIVES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

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
    await client.client.create({
      data: {
        id: CLIENT_9EF2,
        societe_id: reperes.societeId,
        raison_sociale: "9EF2-Client (capture)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EF2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EF2,
        agence_id: agence.id,
        libelle: "9EF2-Site (capture)",
      },
    });
    await client.contact.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        client_id: CLIENT_9EF2,
        site_id: null,
        nom: fr["captures.9ef2.nom_donneuse"],
        fonction: "Responsable site",
        telephone: "687000001",
        email: "donneuse@9ef2.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        actif: true,
      },
    });
    await client.contact.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        client_id: CLIENT_9EF2,
        site_id: null,
        nom: "9EF2-Second interlocuteur",
        fonction: "Magasinier",
        telephone: null,
        email: "second@9ef2.test",
        roles: ["contact_technique"],
        canaux: ["email"],
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.contact.deleteMany({ where: { client_id: CLIENT_9EF2 } });
    await client.site.deleteMany({ where: { id: SITE_9EF2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EF2 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("captures — fiche machine en service et en panne", async ({ page }) => {
  await page.goto("/parc?statut=en_service");
  const ficheEnService = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheEnService).toBeVisible();
  await ficheEnService.click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  await capturer(page, "fiche-machine-en-service");

  await page.goto("/parc?statut=en_panne");
  const ficheEnPanne = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheEnPanne).toBeVisible();
  await ficheEnPanne.click();
  await expect(page.locator('[data-bloc="alert-strip"]')).toBeVisible();
  await capturer(page, "fiche-machine-en-panne");
});

test("captures — bloc Interlocuteurs de la fiche client, fermé puis formulaire ouvert", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_9EF2}?onglet=interlocuteurs`);
  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(bloc).toBeVisible();
  await expect(bloc.getByText(fr["captures.9ef2.nom_donneuse"])).toBeVisible();
  await capturer(page, "fiche-client-interlocuteurs-ferme");

  await bloc
    .locator("summary")
    .filter({ hasText: fr["contacts.action.creer"] })
    .click();
  await capturer(page, "fiche-client-interlocuteurs-ouvert");
});

test("captures — bloc Interlocuteurs de la fiche site, fermé puis formulaire ouvert", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_9EF2}`);
  const bloc = page.locator('[data-bloc="contacts-site"]');
  await expect(bloc).toBeVisible();
  await capturer(page, "fiche-site-interlocuteurs-ferme");

  await bloc
    .locator("summary")
    .filter({ hasText: fr["contacts.action.creer"] })
    .click();
  await capturer(page, "fiche-site-interlocuteurs-ouvert");
});
