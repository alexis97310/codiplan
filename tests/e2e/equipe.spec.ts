import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * L'ÉQUIPE — créer, modifier et désactiver un technicien (ÉQUIPE-1).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/unit/techniciens/` prouve la FORME des trois écritures (une seule
 * transaction, l'ordre, le rattachement plutôt que le doublon) contre un
 * client Prisma factice — `pnpm test` ne provisionne aucune base. Il ne peut
 * pas prouver que **l'écran** ouvre réellement une identité en base sous la
 * branche administrative de `utilisateur_ouverture`, ni qu'un refus arrive à
 * l'écran avec son motif. C'est ce que ce fichier éprouve, à travers un
 * navigateur, contre une base migrée et semée.
 *
 * ## Le second facteur, parce que `admin_societe` est un rôle sensible
 *
 * `ouvrirLaSessionSensible` (`tests/e2e/setup/session.ts`), plutôt qu'une
 * copie locale (Lot E2E-1) : la copie recopiée de
 * `tests/e2e/montants-par-role.spec.ts` gardait sa clé d'activation dans une
 * variable PROPRE à ce fichier, alors que les deux fichiers ouvrent la MÊME
 * identité `admin_societe` contre la MÊME base, recréée une seule fois pour
 * toute l'exécution — le second fichier à s'y connecter retrouvait un compte
 * déjà activé par l'autre, sans jamais avoir vu sa clé. Voir l'en-tête de la
 * fonction partagée pour la mesure complète.
 */
test.describe.configure({ mode: "serial" });

/**
 * Les fixtures de l'épreuve, LUES DU DICTIONNAIRE (L0-11) : le gardien des
 * chaînes visibles fait passer par `lib/i18n/fr.ts` jusqu'au texte qu'un test
 * de rendu attend, et une constante locale assignée à un littéral y serait
 * prise comme n'importe quel libellé d'écran.
 *
 * Un courriel FIXE convient : `tests/e2e/setup/global.ts` recrée la base à
 * chaque exécution, cette adresse ne peut donc jamais être déjà prise.
 */
const NOM_NOUVEAU = fr["equipe.e2e.nom"];
const COURRIEL_NOUVEAU = fr["equipe.e2e.courriel"];
const NOM_DOUBLON = fr["equipe.e2e.nom_doublon"];

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("LA PORTE DE PARAMÉTRAGE MÈNE À L'ÉQUIPE", async ({ page }) => {
  // L'écran a un appelant : la porte ajoutée à `portes-parametrage.ts`.
  await page.goto("/parametres");
  const porte = page.getByRole("link", { name: fr["equipe.titre"] });
  await expect(porte).toBeVisible();
  await porte.click();
  await expect(page).toHaveURL("/parametres/equipe");
});

test("CRÉER un technicien, puis le VOIR dans la liste (liste + création)", async ({
  page,
}) => {
  await page.goto("/parametres/equipe");

  const formulaireCreation = page.locator(
    'form[action="/api/techniciens/creer"]',
  );
  await formulaireCreation.getByLabel(fr["equipe.nom"]).fill(NOM_NOUVEAU);
  await formulaireCreation
    .getByLabel(fr["equipe.email"])
    .fill(COURRIEL_NOUVEAU);
  // La PREMIÈRE agence proposée — l'écran ne prescrit pas laquelle, seulement
  // qu'il en existe.
  const options = formulaireCreation.locator('select[name="agence_id"] option');
  await expect(options.nth(1)).toBeAttached();
  const valeurAgence = await options.nth(1).getAttribute("value");
  await formulaireCreation
    .locator('select[name="agence_id"]')
    .selectOption(valeurAgence ?? "");
  await formulaireCreation
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/parametres\/equipe/);
  // Aucun motif de refus — la création a abouti.
  await expect(page.locator("[role='status']")).toHaveCount(0);

  await expect(page.getByRole("cell", { name: NOM_NOUVEAU })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: COURRIEL_NOUVEAU }),
  ).toBeVisible();
});

test("MODIFIER un technicien — bascule inactif, et il sort de la liste par défaut (modification)", async ({
  page,
}) => {
  await page.goto("/parametres/equipe");

  // La section de modification est titrée par le nom, et c'est ce qui la
  // distingue des autres — une par technicien.
  const section = page
    .locator("section")
    .filter({ hasText: NOM_NOUVEAU })
    .filter({ has: page.locator("form") });
  await expect(section).toBeVisible();

  await section.getByLabel(fr["equipe.actif"]).uncheck();
  await section.getByRole("button", { name: fr["equipe.enregistrer"] }).click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/parametres\/equipe/);
  await expect(page.locator("[role='status']")).toHaveCount(0);

  // Par défaut, les inactifs sont masqués — « il cesse d'être proposé ».
  await expect(page.getByText(NOM_NOUVEAU)).toHaveCount(0);

  // Et le filtre les révèle — « il ne cesse pas d'avoir existé ».
  await page
    .getByRole("link", { name: fr["equipe.filtre.montrer_inactifs"] })
    .click();
  await expect(page).toHaveURL(/etat=tous/);
  await expect(page.getByRole("cell", { name: NOM_NOUVEAU })).toBeVisible();
  await expect(page.getByText(fr["equipe.inactif"]).first()).toBeVisible();
});

test("UN COURRIEL DÉJÀ MEMBRE DE LA SOCIÉTÉ EST REFUSÉ, PAS DUPLIQUÉ", async ({
  page,
}) => {
  // `COMPTE_TECHNICIEN_EPREUVE` est déjà habilité sur cette société — la scène
  // l'ouvre avant tout scénario (`tests/e2e/setup/global.ts`).
  await page.goto("/parametres/equipe");

  const formulaireCreation = page.locator(
    'form[action="/api/techniciens/creer"]',
  );
  await formulaireCreation.getByLabel(fr["equipe.nom"]).fill(NOM_DOUBLON);
  await formulaireCreation
    .getByLabel(fr["equipe.email"])
    .fill(COMPTE_TECHNICIEN_EPREUVE);
  const options = formulaireCreation.locator('select[name="agence_id"] option');
  const valeurAgence = await options.nth(1).getAttribute("value");
  await formulaireCreation
    .locator('select[name="agence_id"]')
    .selectOption(valeurAgence ?? "");
  await formulaireCreation
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(fr["equipe.refus.deja_membre"])).toBeVisible();
  await expect(page.getByText(NOM_DOUBLON)).toHaveCount(0);
});
