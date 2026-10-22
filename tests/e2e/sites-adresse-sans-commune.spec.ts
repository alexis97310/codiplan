import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { formatAdresseSite } from "@/lib/interventions/bon";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9G1-CORRECTIFS-AUDIT-URGENTS, point 7 — LA CARTE D'UN SITE SANS COMMUNE,
 * MAIS AVEC UNE ADRESSE CONNUE.
 *
 * ## Le constat
 *
 * `CarteSite` (`app/(back-office)/sites/page.tsx`) composait sa première
 * ligne par `site.commune === null && site.adresse === null ? null :
 * site.commune` — SANS COMMUNE mais AVEC adresse, la condition retombait sur
 * `site.commune`, c'est-à-dire `null` : la ligne ne rendait rien, l'adresse
 * connue disparaissait de la carte.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9G1-SITES-`
 *
 * Un client et un site SANS commune (`commune: null`) mais avec une adresse
 * (`adresse: { rue: ... }`) — créés et supprimés par ce fichier seul, aucune
 * ligne ajoutée au semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9G1 = uuidv7();
const SITE_9G1 = uuidv7();

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
        id: CLIENT_9G1,
        societe_id: societe.id,
        raison_sociale: fr["9g1lieu.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9G1,
        societe_id: societe.id,
        client_id: CLIENT_9G1,
        agence_id: agence.id,
        libelle: fr["9g1lieu.e2e.lieu"],
        adresse: { rue: fr["9g1lieu.e2e.rue"] },
        commune: null,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.site.deleteMany({ where: { id: SITE_9G1 } });
    await client.client.deleteMany({ where: { id: CLIENT_9G1 } });
  } finally {
    await client.$disconnect();
  }
});

test("la carte d'un site sans commune mais avec une adresse connue affiche cette adresse, jamais une ligne vide", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  // SANS MACHINE, LE SITE EST MASQUÉ PAR DÉFAUT (`sans_equipement`) — ce
  // n'est pas ce que cette épreuve mesure (point 7, l'adresse de la carte),
  // et la fixture n'a pas besoin d'une machine pour le montrer.
  await page.goto(
    `/sites?q=${encodeURIComponent(fr["9g1lieu.e2e.lieu"])}&sans_equipement=1`,
  );

  const carte = page
    .locator("article")
    .filter({ hasText: fr["9g1lieu.e2e.lieu"] });
  await expect(carte).toBeVisible();

  const adresseAttendue = formatAdresseSite(
    { rue: fr["9g1lieu.e2e.rue"] },
    null,
  );
  expect(adresseAttendue).not.toBeNull();
  if (adresseAttendue !== null) {
    await expect(carte).toContainText(adresseAttendue);
  }
});
