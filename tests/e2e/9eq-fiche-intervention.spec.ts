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

// BASCULE (9ES-TP-UX4-3-FICHE-GESTES-2, D195) — le point 34 visait le LIEN
// d'ancre `#action-<principale>` (« Planifier »/« Transmettre »), qui
// occupait toute la largeur de l'en-tête sous 901 px. Ce lien a disparu —
// les boutons de l'en-tête (Button) suivent désormais le même régime que
// « Suspendre »/« Clôturer » (9ES-…-1) : une taille FIXE, jamais `w-full`.
// RÉTABLI (solde 166, 9EU-SOLDE-FICHE-PLANNING) à une preuve au moins aussi
// forte que l'originale — supprimée sans remplacement équivalent par 9ES-2,
// qui ne mesurait plus que l'absence de défilement de la PAGE entière,
// jamais les proportions du bouton lui-même : à 375 px, il tient ENTIER
// dans le viewport (jamais hors champ, comme l'ancien lien d'ancre) ; à
// 1280 px, il garde sa largeur NATURELLE (moins de la moitié de l'en-tête),
// jamais la largeur pleine qu'il n'a jamais portée sous ce régime.
test("sous 901 px, le bouton primaire de l'en-tête reste entièrement visible, sans défilement horizontal ; à partir de 901 px, sa largeur naturelle", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_9EQ}`);

  const boutonTransmettre = page.getByRole("button", {
    name: fr["intervention.action.transmettre"],
  });
  const enTete = boutonTransmettre.locator("xpath=ancestor::header[1]");

  await page.setViewportSize({ width: 375, height: 900 });
  await expect(boutonTransmettre).toBeVisible();
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(375);
  const boiteBouton375 = await boutonTransmettre.boundingBox();
  expect(boiteBouton375).not.toBeNull();
  expect(boiteBouton375!.x).toBeGreaterThanOrEqual(0);
  expect(boiteBouton375!.x + boiteBouton375!.width).toBeLessThanOrEqual(375);

  await page.setViewportSize({ width: 1280, height: 900 });
  const largeurEnTete1280 = (await enTete.boundingBox())?.width ?? 0;
  const largeurBouton1280 = (await boutonTransmettre.boundingBox())?.width ?? 0;
  expect(largeurBouton1280).toBeLessThan(largeurEnTete1280 / 2);
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

test("point 54 — « Sur place » n'apparaît que sur l'onglet Résumé, y compris pour une valeur d'onglet inconnue", async ({
  page,
}) => {
  for (const onglet of ["temps", "rapport", "valorisation", "historique"]) {
    await page.goto(`/interventions/${INTERVENTION_9EQ}?onglet=${onglet}`);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: fr["intervention.sur_place.titre"],
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText(fr["intervention.note_interne.titre"]),
    ).toHaveCount(0);
  }

  for (const url of [
    `/interventions/${INTERVENTION_9EQ}`,
    `/interventions/${INTERVENTION_9EQ}?onglet=inconnu`,
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: fr["intervention.sur_place.titre"],
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByText(fr["intervention.note_interne.titre"]),
    ).toHaveCount(1);
  }
});
