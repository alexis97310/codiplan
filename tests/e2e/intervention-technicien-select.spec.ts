import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE CHAMP TECHNICIEN, DE L'INPUT NU AU SÉLECTEUR DE NOMS (chantier TECH-1,
 * 20/09/2026).
 *
 * ## Le défaut que ce fichier mesure
 *
 * Trois occurrences d'un `<input type="text" name="technicien_id">` — la
 * création, et les DEUX formulaires de la fiche (« Affecter », « Déplacer »)
 * — demandaient de TAPER un UUID. Rien n'empêchait d'en inventer un, ni de
 * deviner celui d'un technicien qu'on n'a pas le droit de nommer (le
 * cloisonnement filtre ce que l'ANNUAIRE rend, pas ce qu'un formulaire
 * accepte de recevoir).
 *
 * Ce fichier éprouve les DEUX écrans touchés : la création, et le sélecteur
 * de la fiche (« Affecter »), qui a demandé une extension du composant
 * `Saisie` plutôt qu'un second champ.
 *
 * ## LE TROISIÈME SCÉNARIO — la LISTE n'est plus rendue à qui ne peut pas
 * affecter (revue Codex de la PR #267, 20/09/2026)
 *
 * *Mesuré : le champ — et la liste NOMINATIVE des techniciens qu'il
 * portait — était rendu à TOUTE session de société active, y compris un
 * technicien (accès restreint) qui y voyait ses collègues, et un compte
 * portail (`creer_demande` inclut le rôle client) qui pouvait la voir et
 * soumettre un `technicien_id`.* Le critère retenu est `qualifier_affecter`,
 * lu depuis la matrice (`lib/auth/habilitations.ts`), et un technicien ne
 * l'a pas.
 *
 * ## LE QUATRIÈME — la MÊME fuite existait sur la FICHE (extension de mon
 * initiative, 20/09/2026)
 *
 * Les DEUX sélecteurs de `/interventions/[id]` — « Affecter », « Déplacer » —
 * ont été introduits par ce même chantier, sur du code que cette revue
 * touchait déjà : ce n'était donc pas un défaut préexistant hors périmètre.
 * « Affecter » n'a qu'un champ, celui qui fuyait : un rôle sans
 * `qualifier_affecter` voit désormais l'action ENTIÈRE refusée, comme un
 * refus de statut. « Déplacer » garde trois champs utiles sans technicien
 * (date, heure, durée) : seul CE champ disparaît pour un rôle sans
 * `modifier_planning`.
 */

async function utilisateurIdDuTechnicienDeLEpreuve(): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });
    return utilisateur.id;
  } finally {
    await client.$disconnect();
  }
}

async function ouvrirLaSessionDuTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la CRÉATION affiche des NOMS de technicien, et affecter fonctionne", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");

  const selectTechnicien = page.locator('select[name="technicien_id"]');
  const options = selectTechnicien.locator("option");
  // La PREMIÈRE option est « Aucun technicien affecté » ; la SECONDE est le
  // premier technicien réel — il en existe au moins un dans le semis.
  await expect(options.nth(1)).toBeAttached();
  const nomTechnicien = ((await options.nth(1).textContent()) ?? "").trim();
  expect(nomTechnicien.length).toBeGreaterThan(0);
  // Ce n'est PAS un identifiant technique (UUID) — c'est très exactement le
  // défaut que ce chantier corrige.
  expect(nomTechnicien).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  const valeurTechnicien = await options.nth(1).getAttribute("value");
  expect(valeurTechnicien).toBeTruthy();

  const optionsSite = page.locator('select[name="site"] option');
  await expect(optionsSite.first()).toBeAttached();
  const valeurSite = await optionsSite.first().getAttribute("value");
  await page.locator('select[name="site"]').selectOption(valeurSite ?? "");
  await selectTechnicien.selectOption(valeurTechnicien ?? "");

  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  // La fiche affiche le MÊME nom — jamais l'identifiant.
  // Scopé au `<dd>` de la fiche — les `<select>` « Affecter » et
  // « Déplacer » portent tous deux une `<option selected>` avec le MÊME
  // nom une fois le technicien affecté, et `getByText` seul violerait le
  // mode strict (plusieurs éléments correspondent au texte).
  await expect(
    page.locator("dd").filter({ hasText: nomTechnicien }),
  ).toBeVisible();
});

test("le sélecteur « Affecter » de la FICHE liste des NOMS et affecte", async ({
  page,
}) => {
  // Une intervention SANS technicien, d'abord — la file d'attente ordinaire.
  await page.goto("/interventions/nouvelle");
  const optionsSite = page.locator('select[name="site"] option');
  await expect(optionsSite.first()).toBeAttached();
  const valeurSite = await optionsSite.first().getAttribute("value");
  await page.locator('select[name="site"]').selectOption(valeurSite ?? "");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  const formulaireAffecter = page.locator('form[action$="/affecter"]');
  await expect(formulaireAffecter).toBeVisible();
  const options = formulaireAffecter.locator(
    'select[name="technicien_id"] option',
  );
  await expect(options.nth(1)).toBeAttached();
  const nomTechnicien = ((await options.nth(1).textContent()) ?? "").trim();
  expect(nomTechnicien.length).toBeGreaterThan(0);
  expect(nomTechnicien).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  const valeurTechnicien = await options.nth(1).getAttribute("value");

  await formulaireAffecter
    .locator('select[name="technicien_id"]')
    .selectOption(valeurTechnicien ?? "");
  await formulaireAffecter
    .getByRole("button", { name: fr["intervention.action.affecter"] })
    .click();
  await page.waitForLoadState("networkidle");

  // Scopé au `<dd>` de la fiche — les `<select>` « Affecter » et
  // « Déplacer » portent tous deux une `<option selected>` avec le MÊME
  // nom une fois le technicien affecté, et `getByText` seul violerait le
  // mode strict (plusieurs éléments correspondent au texte).
  await expect(
    page.locator("dd").filter({ hasText: nomTechnicien }),
  ).toBeVisible();
});

test("un TECHNICIEN n'a ni le champ ni la liste nominative de ses collègues sur la création", async ({
  page,
}) => {
  // La session ADV du `beforeEach` est écartée : `/connexion` redirige tout
  // compte déjà authentifié vers `/arrivee` sans montrer le formulaire.
  await page.context().clearCookies();
  await ouvrirLaSessionDuTechnicien(page);

  await page.goto("/interventions/nouvelle");
  // `creer_demande` reste accessible à un technicien (matrice §5.2) : l'écran
  // se rend bel et bien, ce n'est PAS un refus de page.
  await expect(
    page.getByRole("button", { name: fr["intervention.action.creer"] }),
  ).toBeVisible();

  // AUCUN champ technicien — ni le `<select>`, ni le vieux `<input>` que ce
  // chantier remplace.
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);
});

test("sur la FICHE d'un technicien, « Affecter » est refusé en entier et « Déplacer » perd son champ technicien", async ({
  page,
}) => {
  const utilisateurIdTechnicien = await utilisateurIdDuTechnicienDeLEpreuve();

  // Créée par l'ADV du `beforeEach`, DIRECTEMENT affectée à ce technicien —
  // sinon sa fiche lui serait invisible (périmètre restreint, R5-01).
  await page.goto("/interventions/nouvelle");
  const optionsSite = page.locator('select[name="site"] option');
  await expect(optionsSite.first()).toBeAttached();
  const valeurSite = await optionsSite.first().getAttribute("value");
  await page.locator('select[name="site"]').selectOption(valeurSite ?? "");
  await page
    .locator('select[name="technicien_id"]')
    .selectOption(utilisateurIdTechnicien);
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/([0-9a-f-]+)$/);
  const idIntervention = new URL(page.url()).pathname.split("/").pop();

  await page.context().clearCookies();
  await ouvrirLaSessionDuTechnicien(page);
  await page.goto(`/interventions/${idIntervention}`);

  // « AFFECTER » : l'action ENTIÈRE est refusée — jamais un champ vide.
  const formulaireAffecter = page.locator('form[action$="/affecter"]');
  await expect(formulaireAffecter).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.refus.qualification_requise"]),
  ).toBeVisible();

  // « DÉPLACER » reste utilisable — date, heure, durée —, mais SANS le champ
  // technicien ni sa liste nominative.
  const formulaireDeplacer = page.locator('form[action$="/deplacer"]');
  await expect(formulaireDeplacer).toBeVisible();
  await expect(
    formulaireDeplacer.locator('[name="technicien_id"]'),
  ).toHaveCount(0);
  await expect(
    formulaireDeplacer.locator('[name="date_planifiee"]'),
  ).toBeVisible();
});
