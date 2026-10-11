import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EFB-CORRECTIFS-FICHES-9EFA, point D — Y13, LES INTERLOCUTEURS AU
 * TÉLÉPHONE.
 *
 * `BlocContacts` (`app/(back-office)/contacts/presentation.tsx`) rendait les
 * liens `tel:`/`mailto:` sans hauteur minimale ni alignement — AUCUNE
 * épreuve ne mesurait le débordement à 375 px ni la zone cliquable du
 * crayon. Scène propre, préfixée `9EFBY13-`, créée et supprimée par cette
 * épreuve : un donneur d'ordre (téléphone + courriel LONG, destinataire des
 * courriels de planification) et un second interlocuteur technique.
 *
 * **Aucune fixture « sans courriel »** (Z18) — `contact_courriel_si_canal_
 * email` exige un courriel dès que `canaux` porte « email », le seul canal
 * connu : le texte « Ne recevra rien… » reste hors de portée d'une épreuve.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_Y13 = uuidv7();
const CONTACT_DONNEUR = uuidv7();
const CONTACT_TECHNIQUE = uuidv7();

const NOM_DONNEUR = "9EFBY13-Donneuse d'ordre";
const EMAIL_DONNEUR_LONG =
  "9efby13-une-adresse-tres-longue-pour-mesurer-le-debordement@correctifs-fiches.test";
const NOM_TECHNIQUE = "9EFBY13-Second interlocuteur";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.client.create({
      data: {
        id: CLIENT_Y13,
        societe_id: reperes.societeId,
        raison_sociale: "9EFBY13-Client (interlocuteurs, téléphone)",
        actif: true,
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_DONNEUR,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y13,
        site_id: null,
        nom: NOM_DONNEUR,
        telephone: "687000001",
        email: EMAIL_DONNEUR_LONG,
        roles: ["donneur_ordre"],
        canaux: ["email"],
        actif: true,
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_TECHNIQUE,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y13,
        site_id: null,
        nom: NOM_TECHNIQUE,
        telephone: "687000002",
        email: "9efby13-second@correctifs-fiches.test",
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
    await client.contact.deleteMany({
      where: { id: { in: [CONTACT_DONNEUR, CONTACT_TECHNIQUE] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_Y13 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 375, height: 900 });
});

test("le bloc des interlocuteurs ne déborde pas à 375 px", async ({ page }) => {
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(bloc).toBeVisible();

  const { scrollWidth, clientWidth } = await bloc.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("les liens tel:/mailto: et le crayon restent dans les 375 px, avec une hauteur d'au moins 32 px", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  const ligneDonneur = page
    .locator(
      '[data-bloc="contacts-client"] li, [data-bloc="contacts-client"] > div > div',
    )
    .filter({ hasText: NOM_DONNEUR });

  const lienTelephone = ligneDonneur
    .locator("a")
    .filter({ hasText: "687000001" });
  const lienCourriel = ligneDonneur
    .locator("a")
    .filter({ hasText: EMAIL_DONNEUR_LONG });

  for (const lien of [lienTelephone, lienCourriel]) {
    await expect(lien).toBeVisible();
    const boite = await lien.boundingBox();
    expect(boite).not.toBeNull();
    expect(boite!.x + boite!.width).toBeLessThanOrEqual(375);
    expect(boite!.height).toBeGreaterThanOrEqual(32);
  }

  const crayon = ligneDonneur.locator("summary").first();
  await expect(crayon).toBeVisible();
  const boiteCrayon = await crayon.boundingBox();
  expect(boiteCrayon).not.toBeNull();
  expect(boiteCrayon!.x + boiteCrayon!.width).toBeLessThanOrEqual(375);
  expect(boiteCrayon!.height).toBeGreaterThanOrEqual(32);
});

test("le donneur d'ordre destinataire porte « Reçoit les courriels de planification »", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(
    bloc
      .locator("p")
      .filter({ hasText: fr["contacts.destinataire_courriels"] }),
  ).toBeVisible();
});

test("un compte responsable matériel ne voit ni crayon ni « + Interlocuteur »", async ({
  page,
}) => {
  // Le bouton « Se déconnecter » vit dans la navigation de bureau — la même
  // session ne le montre pas sous 901 px (menu replié). On repasse large le
  // temps de changer d'identité, puis on revient à 375 px pour la mesure.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(bloc).toBeVisible();
  await expect(bloc.locator("summary")).toHaveCount(0);
});

/**
 * LES CAPTURES — bloc fermé puis formulaire ouvert, rôle adv et responsable
 * matériel, à 375 px.
 */
const CAPTURES_ACTIVES = process.env.CAPTURES_9EFB_Y13 !== undefined;
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EFB-CORRECTIFS-FICHES-9EFA/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  if (!CAPTURES_ACTIVES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

test("captures — interlocuteurs à 375 px, adv (fermé puis ouvert) et responsable matériel", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(bloc).toBeVisible();
  await capturer(page, "fiche-client-interlocuteurs-telephone-adv-ferme");

  await bloc
    .locator("summary")
    .filter({ hasText: fr["contacts.action.creer"] })
    .click();
  await capturer(page, "fiche-client-interlocuteurs-telephone-adv-ouvert");

  // Même repli que l'épreuve de rôle : « Se déconnecter » vit dans la
  // navigation de bureau.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/clients/${CLIENT_Y13}?onglet=interlocuteurs`);
  await expect(page.locator('[data-bloc="contacts-client"]')).toBeVisible();
  await capturer(page, "fiche-client-interlocuteurs-telephone-rm");
});
