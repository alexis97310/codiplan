import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { choisirMachine, choisirPriorite } from "./setup/formulaire-creation";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9I8F-STATUT-MACHINE-MODIFIABLE — même recette que
 * `captures-9i7e-creer-machine-listes-deroulantes.spec.ts` : rien n'est écrit
 * sans `CAPTURES_9I8F`, pour que `pnpm test:e2e` ordinaire n'écrive jamais de
 * fichier. Fixture À SOI, distincte de `9i8f-statut-machine-modifiable.spec
 * .ts` (préfixe `-cap` sur les identifiants) pour ne jamais se recouper avec
 * elle si les deux tournent en parallèle.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I8F ?? "";
const LARGEURS = [
  { largeur: 375, hauteur: 900, suffixe: "375" },
  { largeur: 1280, hauteur: 900, suffixe: "1280" },
] as const;

const CLIENT_ID = "918face0-ca5e-7000-8000-000000000001";
const SITE_ID = "918face0-ca5e-7000-8000-000000000002";
const MACHINE_ID = "918face0-ca5e-7000-8000-000000000003";
const NUMERO_SERIE = "9I8F-SN-CAPTURE";
const RAISON_SOCIALE = "Client 9I8F — captures";
const LIBELLE_SITE = "Lieu 9I8F — captures";

async function capturer(
  page: Page,
  nom: string,
  suffixe: string,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}--${suffixe}.png`),
    fullPage: true,
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { site_id: SITE_ID } });
  await client.demande.deleteMany({ where: { site_id: SITE_ID } });
  await client.machine.deleteMany({ where: { id: MACHINE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: NUMERO_SERIE,
        qr_token: engendrerJetonQr(),
        statut: "en_panne",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

for (const { largeur, hauteur, suffixe } of LARGEURS) {
  test(`nouvelle demande — le champ « État de la machine » (${suffixe} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);
    await page.goto("/demandes?nouvelle=1");
    const volet = page.getByRole("dialog");
    await volet
      .locator('label:has(input[name="source"][value="appel"])')
      .click();
    await choisirResultatParTexte(
      volet,
      "client_id",
      RAISON_SOCIALE,
      RAISON_SOCIALE,
    );
    await choisirResultatParTexte(volet, "site_id", LIBELLE_SITE, LIBELLE_SITE);
    await volet.locator('select[name="machine_id"]').selectOption(MACHINE_ID);
    await capturer(page, "nouvelle-demande-etat-machine", suffixe);
  });

  test(`création d'intervention — le champ « État de la machine », puis la tuile Machine de la fiche (${suffixe} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);
    await page.goto("/interventions/nouvelle");
    await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
    await choisirMachine(page, MACHINE_ID);
    await page.locator('select[name="type"]').selectOption("curatif");
    await choisirPriorite(page, "p2");
    await capturer(page, "creation-intervention-etat-machine", suffixe);

    await page
      .locator('textarea[name="description"]')
      .fill(`9I8F — capture ${suffixe}`);
    await page
      .locator("#contenu")
      .getByRole("button", { name: fr["intervention.action.creer"] })
      .click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "fiche-intervention-tuile-machine", suffixe);
  });

  test(`fiche machine — le bouton « Changer l'état » (${suffixe} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);
    await page.goto(`/parc/${MACHINE_ID}`);
    await capturer(page, "fiche-machine-changer-etat", suffixe);
  });
}
