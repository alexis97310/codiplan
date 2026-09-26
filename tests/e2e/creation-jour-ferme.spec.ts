import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { SAMEDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE REFUS À LA PLANIFICATION D'UNE INTERVENTION UN JOUR D'AGENCE FERMÉE
 * (chantier CRÉA-1, 20/09/2026 ; déplacé de la CRÉATION à la PLANIFICATION
 * par PARCOURS-1, 23/09/2026, arbitrage Alexis).
 *
 * ## Le défaut que ce fichier mesurait, et pourquoi il a changé de forme
 *
 * `deplacerIntervention` refuse un jour d'agence fermée
 * (`verdictALaPose` → `verdictOuverture`) ; ce contrôle vivait aussi dans
 * `creerIntervention`, parce que la création pouvait alors porter une date.
 * **Depuis PARCOURS-1, la création ne porte plus jamais de date** — *« lors de
 * la création d'intervention, on ne peut pas décider ni de la date, ni du
 * technicien »* — et c'est le geste PLANIFIER, sur la fiche, qui pose la date
 * pour de bon. Le contrôle d'ouverture n'a donc plus rien à juger à la
 * création ; il reste entier là où la date arrive réellement.
 *
 * Ce fichier mesure désormais la MÊME règle, au POINT où elle s'applique
 * réellement : une intervention créée sans date, puis PLANIFIÉE sur un samedi
 * fermé, est refusée — avec la même clé qu'avant.
 *
 * ## Pourquoi Koné, pourquoi le samedi
 *
 * **Koné ferme le samedi, Ducos l'ouvre** (`tests/e2e/setup/scene.ts`) : c'est
 * le jour fermé le plus simple à cibler sans dépendre d'un jour férié
 * calculé.
 */

async function siteDeKone(): Promise<{
  readonly siteId: string;
  readonly clientId: string;
  readonly siteLibelle: string;
  readonly societeId: string;
}> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societe.id, agence_id: agence.id },
      select: { id: true, client_id: true, libelle: true },
      orderBy: { libelle: "asc" },
    });
    return {
      siteId: site.id,
      clientId: site.client_id,
      siteLibelle: site.libelle,
      societeId: societe.id,
    };
  } finally {
    await client.$disconnect();
  }
}

async function compterInterventionsPlanifieesLe(
  societeId: string,
  siteId: string,
  jour: Date,
): Promise<number> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    return await client.intervention.count({
      where: { societe_id: societeId, site_id: siteId, date_planifiee: jour },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("créer une intervention à KONÉ ne demande plus de date — le formulaire n'en porte aucune", async ({
  page,
}) => {
  const { siteLibelle } = await siteDeKone();
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", siteLibelle, siteLibelle);
  // NI DATE, NI TECHNICIEN (PARCOURS-1) — les deux champs n'existent plus.
  await expect(page.locator('input[name="date_planifiee"]')).toHaveCount(0);
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);
});

test("planifier une intervention un SAMEDI à KONÉ (fermé) est refusé, et la fiche le dit", async ({
  page,
}) => {
  const { siteId, siteLibelle, societeId } = await siteDeKone();
  const reperes = await reperesDeLaScene();
  const samedi = jourDeLaScene(reperes, SAMEDI);
  const samediUtc = new Date(
    Date.UTC(samedi.annee, samedi.mois - 1, samedi.jour),
  );

  const avant = await compterInterventionsPlanifieesLe(
    societeId,
    siteId,
    samediUtc,
  );

  // ── 1. CRÉER — sans date, sans technicien (PARCOURS-1) ──────────────────
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", siteLibelle, siteLibelle);
  await page.locator('select[name="type"]').selectOption("curatif");
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve — jour fermé");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  // ── 2. PLANIFIER — sur le samedi fermé, avec les quatre valeurs ─────────
  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(samedi));
  await formulaire.locator('input[name="heure_debut"]').fill("09:00");
  await formulaire.locator('input[name="duree_min"]').fill("60");
  const options = formulaire.locator(
    'select[name="technicien_id"] option:not([value=""])',
  );
  const technicien = await options.first().getAttribute("value");
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(technicien ?? "");
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");

  // LE REFUS ARRIVE SUR LA FICHE, AVEC SA CLÉ — jamais un succès déguisé en
  // silence.
  await expect(page).toHaveURL(
    /\/interventions\/[0-9a-f-]+\?motif=intervention\.refus\.jour_ferme/,
  );
  const bandeau = page.getByRole("status");
  await expect(bandeau).toContainText(fr["intervention.refus.jour_ferme"]);

  // AUCUNE INTERVENTION N'A ÉTÉ PLANIFIÉE CE JOUR-LÀ — le refus est réel, pas
  // seulement affiché.
  const apres = await compterInterventionsPlanifieesLe(
    societeId,
    siteId,
    samediUtc,
  );
  expect(apres).toBe(avant);
});
