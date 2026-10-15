import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, FORFAITS_SCENE } from "./setup/scene";
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
const LIBELLE_FORFAIT = "Épreuve 9EWE — mise en service";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE/captures",
);

/**
 * LE TEXTE D'UN LOCATOR, CAPTURÉ EN CHAÎNE — jamais `toContainText` sur un
 * `Locator` directement : le gardien L0-11 (`sans-chaine-visible-en-dur.
 * test.ts`) refuse une chaîne visible écrite en dur comme ARGUMENT d'une
 * requête d'écran, même tenue par une constante. `.toContain()` sur une
 * chaîne déjà lue n'est plus une requête d'écran — même idiome que
 * `texteDuBloc` (`taux-horaire-succession.spec.ts`).
 */
async function texteDuBloc(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

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
  await formulaire.locator('input[name="libelle"]').fill(LIBELLE_FORFAIT);
  await formulaire
    .locator('select[name="type"]')
    .selectOption("mise_en_service");
  await formulaire.locator('input[name="rang"]').fill("950");
  await formulaire.locator('input[name="montant_mineur"]').fill("1200");
  await formulaire.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/parametres\/tarifs$/);
  const blocAutres = page.locator('[data-bloc="bloc-autres-forfaits"]');
  await expect(blocAutres).toBeVisible();
  expect(await texteDuBloc(blocAutres)).toContain(LIBELLE_FORFAIT);
  await capturer(page, "tarifs-apres-creation", 1280);

  // MÊME LIGNE, À 375 PX — aucune seconde création : le code serait refusé
  // comme déjà pris (le catalogue est cloisonné par société, pas par vue).
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/parametres/tarifs");
  expect(await texteDuBloc(blocAutres)).toContain(LIBELLE_FORFAIT);
  await capturer(page, "tarifs-apres-creation", 375);
});

test("le filtre ?vue=sans-forfait montre zéro zone quand toutes sont couvertes", async ({
  page,
}) => {
  await page.goto("/parametres/tarifs?vue=sans-forfait");
  await expect(
    page.locator('[data-bloc="bloc-forfaits-deplacement"] tbody tr'),
  ).toHaveCount(0);
  const texte = await texteDuBloc(page.getByRole("status"));
  expect(texte).toContain(String(0));
});

test("un forfait de déplacement masqué par un rang plus petit reste atteignable depuis « Autres forfaits de déplacement », et sa fiche montre conditions et verdict (9EWE1-TARIFS-SOLDE, points 1 et 4)", async ({
  page,
}) => {
  // EPR-DEP-B (rang 902) n'est JAMAIS retenu : EPR-DEP-A (rang 901), sans
  // condition de zone lui non plus, le précède sur chacune des six zones
  // (`forfaitRetenu`) — un masquage permanent par la scène, pas un montage.
  const masque = FORFAITS_SCENE.find((forfait) => forfait.code === "EPR-DEP-B");
  if (masque === undefined) {
    throw new Error("EPR-DEP-B est absent de FORFAITS_SCENE");
  }

  await page.goto("/parametres/tarifs");
  const detailsAutres = page.locator(
    '[data-bloc="autres-forfaits-deplacement"]',
  );
  await detailsAutres.locator("summary").click();
  const ligneMasquee = detailsAutres.locator("tr", {
    hasText: masque.code,
  });
  await expect(ligneMasquee).toBeVisible();

  await ligneMasquee.getByRole("link").click();
  await expect(page).toHaveURL(
    new RegExp(`/parametres/forfaits/${masque.id}$`),
  );

  const identite = page.locator('[data-bloc="identite-forfait"]');
  const texteIdentite = await texteDuBloc(identite);
  expect(texteIdentite).toContain(t("forfaits.applicable_apres"));
  expect(texteIdentite).toContain(t("forfaits.sans_condition"));
});
