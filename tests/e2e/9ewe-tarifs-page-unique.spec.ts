import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * UNE SEULE PAGE « TARIFS » (9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE, décisions
 * n° 97 et n° 98 d'Alexis, 13/10/2026).
 *
 * `taux-horaire-succession.spec.ts`, `droits-rm-rs.spec.ts` et
 * `tous-les-ecrans-rendent.spec.ts` (migrés) couvrent déjà la porte unique,
 * l'historique des taux et la lecture RM/RS. Ce fichier ajoute ce qu'ils ne
 * couvraient pas : créer un forfait DEPUIS cette page et le voir apparaître
 * dans « Autres forfaits », et le filtre `?vue=sans-forfait`.
 *
 * **Aucune zone de la scène partagée n'est « sans forfait »** —
 * `FORFAITS_SCENE` et `FORFAITS_DEMONSTRATION` sont tous de nature
 * `deplacement` et SANS condition de zone (`zone_geo` NULL), donc applicables
 * à chacune des six : le filtre ne peut donc s'éprouver ici qu'à ZÉRO zone
 * affichée, pas en passant d'un état à l'autre — une scène jetable serait
 * nécessaire pour le second, et ce n'est pas ce que ce fichier construit.
 *
 * Le forfait posé est nettoyé par `afterAll`, sous le rôle PROPRIÉTAIRE —
 * jamais le chemin applicatif, qui est justement ce qu'on éprouve.
 */

const CODE_FORFAIT = "EPR-9EWE-MES";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE/captures",
);

async function capturer(page: Page, nom: string, largeur: number) {
  if (process.env.CAPTURES_9EWE === undefined) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "forfait" WHERE code = $1`,
      CODE_FORFAIT,
    );
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("un forfait créé depuis /parametres/tarifs apparaît dans « Autres forfaits », aux deux largeurs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres/tarifs");
  await capturer(page, "tarifs-avant-creation", 1280);

  const formulaire = page.locator(
    'form[action="/api/parametres/forfaits/creer"]',
  );
  await formulaire.locator('input[name="code"]').fill(CODE_FORFAIT);
  await formulaire
    .locator('input[name="libelle"]')
    .fill("Épreuve 9EWE — mise en service");
  await formulaire
    .locator('select[name="type"]')
    .selectOption("mise_en_service");
  await formulaire.locator('input[name="rang"]').fill("950");
  await formulaire.locator('input[name="montant_mineur"]').fill("1200");
  await formulaire.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/parametres\/tarifs$/);
  const blocAutres = page.locator('[data-bloc="bloc-autres-forfaits"]');
  await expect(blocAutres).toBeVisible();
  await expect(blocAutres).toContainText("Épreuve 9EWE — mise en service");
  await capturer(page, "tarifs-apres-creation", 1280);

  // MÊME LIGNE, À 375 PX — aucune seconde création : le code serait refusé
  // comme déjà pris (le catalogue est cloisonné par société, pas par vue).
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/parametres/tarifs");
  await expect(blocAutres).toContainText("Épreuve 9EWE — mise en service");
  await capturer(page, "tarifs-apres-creation", 375);
});

test("le filtre ?vue=sans-forfait montre zéro zone quand toutes sont couvertes", async ({
  page,
}) => {
  await page.goto("/parametres/tarifs?vue=sans-forfait");
  await expect(
    page.locator('[data-bloc="bloc-forfaits-deplacement"] tbody tr'),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("(0)");
});
