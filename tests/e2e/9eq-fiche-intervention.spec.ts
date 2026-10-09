import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EQ-CORRECTIFS-SOLDE-FICHE — trois correctifs de la fiche intervention
 * mesurés sur le solde 9EP/9EQ (points 34, 52, 54).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EQ-`
 *
 * Un client, un site (agence Ducos), un contact donneur d'ordre ACTIF mais
 * SANS courriel (un téléphone, pour vérifier qu'aucun lien `tel:` ni aucun
 * nom n'apparaît quand même), une intervention `planifiee` avec technicien
 * et créneau — `principale` vaut alors « transmettre », rendue sans
 * condition de capacité (`app/(back-office)/interventions/[id]/page.tsx`).
 * Créés en `beforeAll`, supprimés en `afterAll`, aucune ligne du semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9EQ = uuidv7();
const SITE_9EQ = uuidv7();
const CONTACT_9EQ = uuidv7();
const INTERVENTION_9EQ = uuidv7();

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
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9EQ,
        societe_id: reperes.societeId,
        raison_sociale: fr["9eq.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EQ,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EQ,
        agence_id: agence.id,
        libelle: fr["9eq.e2e.lieu"],
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9EQ,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EQ,
        site_id: SITE_9EQ,
        nom: fr["9eq.e2e.contact_nom"],
        telephone: "687000009",
        email: null,
        roles: ["donneur_ordre"],
        // Le seul canal implémenté — « email » — exige un courriel
        // (`contact_courriel_si_canal_email`) ; ce contact n'en a pas.
        canaux: ["telephone"],
        actif: true,
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', '2026-11-24T00:00:00Z', 60, $6::uuid, now())`,
      INTERVENTION_9EQ,
      reperes.societeId,
      CLIENT_9EQ,
      SITE_9EQ,
      agence.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9EQ,
    );
    await client.contact.deleteMany({ where: { id: CONTACT_9EQ } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9EQ } });
    await client.client.deleteMany({ where: { id: CLIENT_9EQ } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("point 34 — sous 901 px, l'action principale prend toute la largeur de l'en-tête ; à partir de 901 px, sa largeur naturelle", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_9EQ}`);

  const lienEnTete = page.locator('header a[href^="#action-"]');
  await expect(lienEnTete).toBeVisible();
  const header = lienEnTete.locator("xpath=ancestor::header[1]");

  await page.setViewportSize({ width: 375, height: 900 });
  const largeurHeader = (await header.boundingBox())?.width ?? 0;
  const largeurLien375 = (await lienEnTete.boundingBox())?.width ?? 0;
  expect(largeurLien375).toBeGreaterThanOrEqual(largeurHeader - 1);

  await page.setViewportSize({ width: 1280, height: 900 });
  const largeurHeader1280 = (await header.boundingBox())?.width ?? 0;
  const largeurLien1280 = (await lienEnTete.boundingBox())?.width ?? 0;
  expect(largeurLien1280).toBeLessThan(largeurHeader1280 / 2);
});

test("point 52 — donneur d'ordre sans courriel : un tiret, jamais son nom ni un lien tel:", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_9EQ}`);

  const ligneDonneurOrdre = page
    .locator("dt", { hasText: fr["intervention.sur_place.donneur_ordre"] })
    .locator("xpath=following-sibling::dd[1]");
  // `TIRET` (`app/(back-office)/interventions/[id]/page.tsx`) n'est pas une
  // chaîne du dictionnaire (L0-11 ne la concerne pas, elle n'est lue par
  // aucun humain comme un MOT) — même idiome que `tests/e2e/
  // liens-fiches.spec.ts` (`.filter({ hasNotText: "—" })`), jamais une
  // requête d'écran directe sur ce signe.
  await expect(ligneDonneurOrdre.filter({ hasText: "—" })).toHaveCount(1);
  await expect(ligneDonneurOrdre).not.toContainText(fr["9eq.e2e.contact_nom"]);
  await expect(ligneDonneurOrdre.locator('a[href^="tel:"]')).toHaveCount(0);
});
