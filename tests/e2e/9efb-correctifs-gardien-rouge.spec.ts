import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EFB-CORRECTIFS-FICHES-9EFA, point A — LE GARDIEN DU ROUGE (décision 54).
 *
 * `parc/[id]/page.tsx` colore le bandeau d'alerte en rouge
 * (`bg-app-rouge-fond text-app-rouge-encre`) pour une machine EN PANNE, et le
 * garde en orange pour tout autre statut hors service. Aucun gardien
 * unitaire ne rend cette page (JSX en ligne d'une page serveur, Z20) : seule
 * une fenêtre réelle peut constater la classe posée sur le DOM.
 *
 * Scène propre, préfixée `9EFB-`, créée et supprimée par cette épreuve.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_9EFB = uuidv7();
const SITE_9EFB = uuidv7();
const MACHINE_EN_PANNE = uuidv7();
const MACHINE_ARRETEE = uuidv7();

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
        id: CLIENT_9EFB,
        societe_id: reperes.societeId,
        raison_sociale: "9EFB-Client (gardien du rouge)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EFB,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EFB,
        agence_id: agence.id,
        libelle: "9EFB-Site (gardien du rouge)",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_EN_PANNE,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_9EFB,
        site_id: SITE_9EFB,
        numero_serie: "9EFB-SERIE-PANNE",
        qr_token: `9efb-${uuidv7()}`,
        statut: "en_panne",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ARRETEE,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_9EFB,
        site_id: SITE_9EFB,
        numero_serie: "9EFB-SERIE-ARRETEE",
        qr_token: `9efb-${uuidv7()}`,
        statut: "arretee",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_EN_PANNE, MACHINE_ARRETEE] } },
    });
    await client.site.deleteMany({ where: { id: SITE_9EFB } });
    await client.client.deleteMany({ where: { id: CLIENT_9EFB } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("une machine EN PANNE rend l'alerte dans le ROUGE (décision 54)", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_EN_PANNE}`);
  const alerte = page.locator('[data-bloc="alert-strip"]');
  await expect(alerte).toBeVisible();
  await expect(alerte).toHaveClass(/bg-app-rouge-fond/);
  await expect(alerte).toHaveClass(/text-app-rouge-encre/);
  await expect(alerte).not.toHaveClass(/bg-app-orange-fond/);
});

test("une machine ARRÊTÉE (un autre statut hors service) reste dans l'ORANGE", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_ARRETEE}`);
  const alerte = page.locator('[data-bloc="alert-strip"]');
  await expect(alerte).toBeVisible();
  await expect(alerte).toHaveClass(/bg-app-orange-fond/);
  await expect(alerte).toHaveClass(/text-app-orange-encre/);
  await expect(alerte).not.toHaveClass(/bg-app-rouge-fond/);
});
