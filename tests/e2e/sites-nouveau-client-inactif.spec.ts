import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9G1-CORRECTIFS-AUDIT-URGENTS, point 8 — « NOUVEAU LIEU » REFUSE D'EMBLÉE
 * SUR UN CLIENT INACTIF.
 *
 * ## Le constat
 *
 * `/sites/nouveau?client=<id>` ouvrait le formulaire entier, même quand le
 * client résolu est inactif — `lib/sites/depot.ts` refuse la création avec
 * le motif `client_inactif`, mais seulement après l'ENVOI : l'auteur
 * remplissait tout avant de l'apprendre.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9G1INACTIF-`
 *
 * Un seul client, inactif — créé et supprimé par ce fichier seul.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9G1 = uuidv7();

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
    await client.client.create({
      data: {
        id: CLIENT_9G1,
        societe_id: societe.id,
        raison_sociale: fr["9g1inactif.e2e.client"],
        actif: false,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.client.deleteMany({ where: { id: CLIENT_9G1 } });
  } finally {
    await client.$disconnect();
  }
});

test("ouvrir « Nouveau lieu » depuis un client inactif refuse d'emblée, sans rendre le formulaire", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/sites/nouveau?client=${CLIENT_9G1}`);

  await expect(page.getByText(fr["site.refus.client_inactif"])).toBeVisible();
  // LE FORMULAIRE NE SE REND PLUS — il écrirait pour rien.
  await expect(page.locator('input[name="libelle"]')).toHaveCount(0);
});
