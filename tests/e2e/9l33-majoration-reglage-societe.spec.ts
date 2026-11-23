import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L33-MAJORATION-REGLAGE-SOCIETE — L'ÉCRAN DE RÉGLAGE ÉCRIT RÉELLEMENT LA
 * COLONNE, À 1280 ET À 375 PX.
 *
 * Mute `societe.majoration_hors_ouverture_pct`, partagée par toute la scène
 * (même colonne que lisent `tests/isolation/9j20-portail-tarifs.test.ts` et
 * `tests/isolation/valorisation-intervention.test.ts`, qui prouvent déjà que
 * le barème du portail et le calcul suivant lisent CETTE colonne — ce fichier
 * ne re-prouve donc que ce qu'il ajoute : qu'ON PEUT L'ÉCRIRE depuis l'écran).
 * Même discipline que `captures-9l12-majoration-pourcentage-societe.spec.ts` :
 * valeur AVANT relue en base, restituée dans un `afterAll`, mode SÉRIE pour
 * qu'aucun autre scénario de la scène partagée ne lise une valeur transitoire.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let societeId = "";
let avant = "50";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = admin();
  try {
    const societe = await client.societe.findUniqueOrThrow({
      where: { id: societeId },
      select: { majoration_hors_ouverture_pct: true },
    });
    avant = societe.majoration_hors_ouverture_pct.toString();
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.societe.update({
      where: { id: societeId },
      data: { majoration_hors_ouverture_pct: avant },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`${largeur}px — enregistrer le pourcentage se relit, et persiste en base`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto("/parametres/societe");
    await expect(
      page.getByRole("heading", { name: t("societe.majoration_titre") }),
    ).toBeVisible();

    const formulaire = page.locator(
      'form[action="/api/parametres/societe/majoration-hors-ouverture"]',
    );
    const champ = formulaire.locator(
      'input[name="majoration_hors_ouverture_pct"]',
    );
    await champ.fill(largeur === 1280 ? "37.5" : "42");
    await formulaire.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(champ).toHaveValue(largeur === 1280 ? "37.5" : "42");

    const client = admin();
    try {
      const societe = await client.societe.findUniqueOrThrow({
        where: { id: societeId },
        select: { majoration_hors_ouverture_pct: true },
      });
      expect(societe.majoration_hors_ouverture_pct.toString()).toBe(
        largeur === 1280 ? "37.5" : "42",
      );
    } finally {
      await client.$disconnect();
    }
  });
}

test("une saisie hors bornes (250) est refusée par la route, le réglage précédent intact", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/societe");

  const formulaire = page.locator(
    'form[action="/api/parametres/societe/majoration-hors-ouverture"]',
  );
  const champ = formulaire.locator(
    'input[name="majoration_hors_ouverture_pct"]',
  );
  const avantRefus = await champ.inputValue();
  await champ.fill("250");
  // Le navigateur porte `max={200}` et désactiverait la soumission ; on
  // l'éprouve malgré tout CÔTÉ SERVEUR, même patron que
  // `captures-9l27-plancher-jamais-zero.spec.ts`.
  await formulaire.evaluate((forme) => {
    forme
      .querySelector('[name="majoration_hors_ouverture_pct"]')
      ?.removeAttribute("max");
  });
  await formulaire.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText(t("societe.majoration_refus_saisie")),
  ).toBeVisible();
  await expect(champ).toHaveValue(avantRefus);
});
