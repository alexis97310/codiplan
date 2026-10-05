import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9DL-PG-G16-STATUT-RESSOURCE (QG-9, 27/09/2026 ; précisions du pilote du
 * 03/10/2026 ; D163) — la colonne et le badge de l'écran Équipe, et le badge
 * « Patente » du planning, À CÔTÉ du nom.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien créé PAR LE FORMULAIRE de l'écran (pour éprouver la saisie
 * réelle, pas une écriture directe) — nom et courriel distincts de ceux de
 * `equipe.spec.ts` (`equipe.e2e.nom_pg_g16`), pour ne jamais collisionner
 * sous `fullyParallel`. Retiré en `afterAll`, par son courriel : l'identifiant
 * naît côté serveur et n'est jamais connu à l'avance.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_G16 ?? "";

const NOM = fr["equipe.e2e.nom_pg_g16"];
const COURRIEL = fr["equipe.e2e.courriel_pg_g16"];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(): Promise<void> {
  const client = admin();
  try {
    const identite = await client.utilisateur.findUnique({
      where: { email: COURRIEL },
      select: { id: true },
    });
    if (identite === null) return;
    await client.technicien.deleteMany({
      where: { utilisateur_id: identite.id },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: identite.id },
    });
    await client.utilisateur.deleteMany({ where: { id: identite.id } });
  } finally {
    await client.$disconnect();
  }
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(nettoyer);
test.afterAll(nettoyer);

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("créer un technicien PATENTÉ, et le voir avec son badge dans la liste et sur le planning", async ({
  page,
}) => {
  await page.goto("/parametres/equipe");
  await capturer(page, "avant-equipe-liste", 1280);

  const formulaireCreation = page.locator(
    'form[action="/api/techniciens/creer"]',
  );
  await formulaireCreation.getByLabel(fr["equipe.nom"]).fill(NOM);
  await formulaireCreation.getByLabel(fr["equipe.email"]).fill(COURRIEL);
  const options = formulaireCreation.locator('select[name="agence_id"] option');
  await expect(options.nth(1)).toBeAttached();
  const valeurAgence = await options.nth(1).getAttribute("value");
  await formulaireCreation
    .locator('select[name="agence_id"]')
    .selectOption(valeurAgence ?? "");
  // AUCUNE VALEUR CHOISIE D'AVANCE (QG-9, D163) : le placeholder est
  // désactivé, le choix explicite de « Patente » est ce que ce test mesure.
  await formulaireCreation
    .locator('select[name="statut_ressource"]')
    .selectOption("patente");
  await formulaireCreation
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[role='status']")).toHaveCount(0);

  // ── LA COLONNE « STATUT », ET SON BADGE « PATENTE » ─────────────────────
  const ligne = page.getByRole("row").filter({ hasText: NOM });
  await expect(ligne).toBeVisible();
  await expect(
    ligne.getByText(fr["equipe.statut.patente"], { exact: true }),
  ).toBeVisible();
  await capturer(page, "apres-equipe-liste", 1280);

  // ── LA FICHE DE MODIFICATION : « NON RENSEIGNÉ » N'EST PLUS UNE OPTION ──
  const section = page
    .locator("details")
    .filter({ hasText: NOM })
    .filter({ has: page.locator("form") });
  await section.locator("summary").click();
  const selectStatut = section.locator('select[name="statut_ressource"]');
  await expect(selectStatut).toHaveValue("patente");
  await expect(selectStatut.locator('option[value="non_renseigne"]')).toHaveCount(
    0,
  );
  await capturer(page, "apres-equipe-fiche", 1280);

  // ── LE PLANNING : LE BADGE « PATENTE », À CÔTÉ DU NOM ────────────────────
  await page.goto("/planning?vue=semaine");
  const nomDansLePlanning = page.getByText(NOM, { exact: true }).first();
  await expect(nomDansLePlanning).toBeVisible();
  await expect(
    page.getByText(fr["planning.technicien.patente"], { exact: true }).first(),
  ).toBeVisible();
  await capturer(page, "apres-planning-semaine", 1280);

  await page.goto("/planning?vue=jour");
  await expect(page.getByText(NOM, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(fr["planning.technicien.patente"], { exact: true }).first(),
  ).toBeVisible();
  await capturer(page, "apres-planning-jour", 1280);
});

test("à 375px — la colonne « Statut » reste lisible dans la fiche de modification", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/parametres/equipe");
  await capturer(page, "avant-equipe-fiche", 375);

  const section = page
    .locator("details")
    .filter({ hasText: NOM })
    .filter({ has: page.locator("form") });
  await expect(section).toBeVisible();
  await section.locator("summary").click();
  await expect(
    section.locator('select[name="statut_ressource"]'),
  ).toBeVisible();
  await capturer(page, "apres-equipe-fiche", 375);
});
