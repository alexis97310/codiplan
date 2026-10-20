import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { choisirPriorite } from "./setup/formulaire-creation";
import { reperesDeLaScene } from "./setup/reperes";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirLaSessionSensible } from "./setup/session";
import { PrismaClient } from "@prisma/client";
import { urlAdministration } from "./setup/base";

/**
 * CAPTURE DU POINT 1 (constat 1 de l'audit fonctionnel 9F5) — le refus
 * nomme désormais la vraie cause d'une description trop longue, jamais
 * « obligatoire ». Aucune donnée créée : la saisie refuse AVANT d'écrire.
 */

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F5B-CORRECTIFS-AUDIT-FONCTIONNEL/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: 375 | 1280,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function libelleSiteDucos(): Promise<string> {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { libelle: true },
      orderBy: { libelle: "asc" },
    });
    return site.libelle;
  } finally {
    await client.$disconnect();
  }
}

test("une description trop longue affiche le bon message (capture)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto("/interventions/nouvelle");
  const libelle = await libelleSiteDucos();
  await choisirResultatParTexte(page, "site", libelle, libelle);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill("zz9F5B — ".concat("x".repeat(4100)));
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(
    /\/interventions\/nouvelle\?motif=intervention\.refus\.panne_trop_longue/,
  );
  const bandeau = page
    .getByRole("status")
    .filter({ hasText: fr["intervention.refus.panne_trop_longue"] });
  await expect(bandeau).toBeVisible();
  await bandeau.scrollIntoViewIfNeeded();
  await capturer(page, "9f5b-description-trop-longue-refus", 1280);
  await capturer(page, "9f5b-description-trop-longue-refus", 375);
});
