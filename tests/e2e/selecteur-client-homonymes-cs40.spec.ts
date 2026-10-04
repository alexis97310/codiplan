import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * CS40 (audit TP-CLI du 28/09/2026) — DEUX CLIENTS HOMONYMES, DISTINGUÉS PAR
 * LE SÉLECTEUR.
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * L'option du sélecteur de client (`/api/recherche/clients`) ne portait que
 * la raison sociale (`app/api/recherche/clients/route.ts:46`) : deux clients
 * du même nom rendaient deux options IDENTIQUES, sans moyen de savoir
 * laquelle choisir avant de valider le formulaire.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `CS40-`
 *
 * Deux clients homonymes, chacun avec un code externe et un site à sa
 * commune — créés en `beforeAll`, supprimés en `afterAll`. Aucune ligne
 * ajoutée au semis, aucune fixture `SCENE.*` touchée.
 */
test.describe.configure({ mode: "serial" });

const RAISON_SOCIALE_HOMONYME = "CS40-Homonyme";
const CLIENT_UN = uuidv7();
const CLIENT_DEUX = uuidv7();
const SITE_UN = uuidv7();
const SITE_DEUX = uuidv7();
const CODE_UN = "CS40-A";
const CODE_DEUX = "CS40-B";
const COMMUNE_UN = "Koné";
const COMMUNE_DEUX = "Pouébo";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_UN,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_HOMONYME,
        code_externe: CODE_UN,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_DEUX,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_HOMONYME,
        code_externe: CODE_DEUX,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_UN,
        societe_id: societe.id,
        client_id: CLIENT_UN,
        agence_id: agence.id,
        libelle: "CS40-Site-A",
        commune: COMMUNE_UN,
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEUX,
        societe_id: societe.id,
        client_id: CLIENT_DEUX,
        agence_id: agence.id,
        libelle: "CS40-Site-B",
        commune: COMMUNE_DEUX,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.site.deleteMany({
      where: { id: { in: [SITE_UN, SITE_DEUX] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_UN, CLIENT_DEUX] } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("deux clients homonymes se distinguent par leur code et leur commune dans le sélecteur", async ({
  page,
}) => {
  await page.goto("/sites/nouveau");
  const bloc = page.locator('[data-selecteur="client_id"]');
  const saisie = bloc.locator('input[type="text"]');
  await saisie.click();
  const motif = `q=${encodeURIComponent(RAISON_SOCIALE_HOMONYME)}`;
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    saisie.fill(RAISON_SOCIALE_HOMONYME),
  ]);

  const options = bloc.locator('ul[role="listbox"] li[role="option"]');
  const optionUn = options.filter({ hasText: CODE_UN });
  const optionDeux = options.filter({ hasText: CODE_DEUX });
  await expect(optionUn).toBeVisible();
  await expect(optionDeux).toBeVisible();

  // CHAQUE option porte aussi la commune de SON site, pas celle de l'autre —
  // `.filter({ hasText })`, jamais `toContainText`, pour la même raison que
  // `CODE_UN`/`CODE_DEUX` ci-dessus (gardien L0-11, `sans-chaine-visible-en-dur`).
  await expect(optionUn.filter({ hasText: COMMUNE_UN })).toBeVisible();
  await expect(optionDeux.filter({ hasText: COMMUNE_DEUX })).toBeVisible();

  const texteUn = (await optionUn.textContent()) ?? "";
  const texteDeux = (await optionDeux.textContent()) ?? "";
  expect(texteUn).not.toBe(texteDeux);
});
