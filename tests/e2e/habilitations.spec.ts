import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LE RÉFÉRENTIEL DES HABILITATIONS, LEUR ATTRIBUTION ET LES EXIGENCES DE SITE
 * (ÉQUIPE-2).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/isolation/alimentation-habilitations.test.ts` et
 * `tests/isolation/habilitations-referentiel.test.ts` prouvent que
 * `lib/habilitations/depot.ts` alimente réellement RG-PLA-04, sous le rôle
 * applicatif et contre une base jetable. Ils ne peuvent pas prouver que
 * **l'écran** existe, qu'il a un APPELANT depuis `/parametres`, et qu'un
 * humain peut réellement créer une habilitation, l'attribuer depuis la fiche
 * d'un technicien et l'exiger depuis la fiche d'un lieu d'intervention — sans
 * jamais toucher `lib/habilitations/affectation.ts`. C'est ce que ce fichier
 * éprouve, à travers un navigateur, contre une base migrée et semée.
 *
 * ## Une SEULE habilitation, créée une fois, réutilisée par les trois écrans
 *
 * Les scénarios sont SÉRIALISÉS et partagent le code `EPR-01` (lu du
 * dictionnaire, L0-11) : la création la pose, l'attribution et l'exigence la
 * consomment ensuite. *Une base qui recréerait le référentiel à chaque
 * scénario masquerait un doublon que la vraie base refuserait* (`code_pris`).
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const CODE = fr["habilitations.e2e.code"];
const LIBELLE = fr["habilitations.e2e.libelle"];

test("LA PORTE DE PARAMÉTRAGE MÈNE AUX HABILITATIONS", async ({ page }) => {
  // L'écran a un appelant : la porte ajoutée à `portes-parametrage.ts`.
  await page.goto("/parametres");
  const porte = page.getByRole("link", { name: fr["habilitations.titre"] });
  await expect(porte).toBeVisible();
  await porte.click();
  await expect(page).toHaveURL("/parametres/habilitations");
});

test("CRÉER une habilitation dans le référentiel, puis la VOIR dans la liste", async ({
  page,
}) => {
  await page.goto("/parametres/habilitations");

  const formulaireCreation = page.locator(
    'form[action="/api/habilitations/creer"]',
  );
  await formulaireCreation.getByLabel(fr["habilitations.code"]).fill(CODE);
  await formulaireCreation
    .getByLabel(fr["habilitations.libelle"])
    .fill(LIBELLE);
  await formulaireCreation
    .getByRole("button", { name: fr["habilitations.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/parametres\/habilitations/);
  // Aucun motif de refus — la création a abouti.
  await expect(page.locator("[role='status']")).toHaveCount(0);

  await expect(
    page.getByRole("cell", { name: CODE, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: LIBELLE })).toBeVisible();
});

/**
 * La fiche de modification d'un technicien, la PREMIÈRE de la liste —
 * l'écran n'en prescrit aucun en particulier, seulement qu'il en existe un.
 * Même raisonnement que `premierSite` dans `tests/e2e/sites.spec.ts`.
 *
 * **`<details>`, pas `<section>`, depuis ERGO-1** : chaque fiche est repliée
 * par défaut (repli par ligne, sur le modèle du motif VGP). Une fiche
 * fraîchement rendue est FERMÉE — l'appelant l'ouvre lui-même avant d'y agir,
 * en cliquant son `<summary>`, exactement comme le ferait un technicien.
 */
function premiereFicheTechnicien(page: Page): Locator {
  return page
    .locator("details")
    .filter({
      has: page.locator('form[action$="/modifier"][action*="/techniciens/"]'),
    })
    .first();
}

async function ouvrirFiche(fiche: Locator): Promise<void> {
  await fiche.locator("summary").click();
}

test("ATTRIBUER l'habilitation à un technicien depuis sa fiche, DATÉE, puis la RETIRER", async ({
  page,
}) => {
  await page.goto("/parametres/equipe");

  const fiche = premiereFicheTechnicien(page);
  await expect(fiche).toBeVisible();
  await ouvrirFiche(fiche);

  const formulaireAttribution = fiche.locator(
    'form[action="/api/habilitations/attributions/creer"]',
  );
  await expect(formulaireAttribution).toBeVisible();
  await formulaireAttribution
    .locator('select[name="habilitation_id"]')
    .selectOption({ label: CODE });
  await formulaireAttribution
    .locator('input[name="date_obtention"]')
    .fill("2024-01-15");
  await formulaireAttribution
    .getByRole("button", {
      name: fr["habilitations.technicien.attribuer_action"],
    })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[role='status']")).toHaveCount(0);

  // L'HABILITATION ATTRIBUÉE EST VISIBLE, avec son code — jamais un UUID.
  // La navigation qui suit la soumission rend la fiche à nouveau FERMÉE
  // (aucun état client ne survit à un aller-retour serveur) : on la rouvre.
  const ficheApres = premiereFicheTechnicien(page);
  await ouvrirFiche(ficheApres);
  const ligneAttribuee = ficheApres.locator("li").filter({ hasText: CODE });
  await expect(ligneAttribuee).toBeVisible();

  // ET ELLE SE RETIRE — la seule façon de défaire une attribution posée par
  // erreur (voir l'en-tête de `lib/habilitations/depot.ts`).
  await ligneAttribuee
    .getByRole("button", { name: fr["habilitations.retirer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[role='status']")).toHaveCount(0);
  const ficheFinale = premiereFicheTechnicien(page);
  await ouvrirFiche(ficheFinale);
  await expect(ficheFinale.locator("li").filter({ hasText: CODE })).toHaveCount(
    0,
  );
});

/**
 * ERGO-1 — LE LIEN « MODIFIER » DU TABLEAU REND SA LIGNE ATTEIGNABLE.
 *
 * Le point qui peut casser : chaque formulaire de ligne est replié par
 * défaut, et le lien pointe vers lui par ancre. Mesuré (script isolé,
 * playwright, un `<details>` statique) — seul un ÉLÉMENT À L'INTÉRIEUR du
 * contenu replié (jamais le `<details>` ni le `<summary>` eux-mêmes) fait
 * ouvrir le `<details>` tout seul à la navigation par ancre ; c'est la forme
 * que portent `habilitations/page.tsx` et `equipe/page.tsx`. Aucune
 * soumission ici : le champ atteint reste UTILISABLE, mais ce fichier ne
 * modifie pas l'habilitation partagée `EPR-01` que les autres scénarios de ce
 * fichier réutilisent (mode `serial`).
 */
test("DEPUIS LE TABLEAU, « Modifier » REND LE FORMULAIRE DE LA LIGNE ATTEIGNABLE (ERGO-1)", async ({
  page,
}) => {
  await page.goto("/parametres/habilitations");

  const ligne = page.locator("tr").filter({ hasText: CODE });
  await expect(ligne).toBeVisible();

  const lien = ligne.getByRole("link", { name: fr["habilitations.modifier"] });
  await expect(lien).toBeVisible();
  await lien.click();

  // Le champ « code » DE CETTE LIGNE, jamais celui d'une autre — sa valeur le
  // distingue, exactement comme `titreDeModification` le fait pour le titre.
  const champCode = page.locator(`input[name="code"][value="${CODE}"]`);
  await expect(champCode).toBeVisible();
  await expect(champCode).toBeEditable();
});

/**
 * Le premier lieu d'intervention de la liste — recopié de `premierSite`
 * (`tests/e2e/sites.spec.ts`) plutôt que partagé : le territoire de ce lot
 * n'autorise qu'un seul fichier neuf sous `tests/e2e/`.
 */
async function premierLieu(page: Page): Promise<string> {
  await page.goto("/sites");
  const lien = page
    .locator('a[href^="/sites/"]')
    .filter({ hasNotText: fr["sites.creer"] })
    .first();
  await expect(lien).toBeVisible();
  const href = await lien.getAttribute("href");
  if (href === null || href === "/sites/nouveau") {
    throw new Error("aucun lieu d'intervention dans la liste");
  }
  return href;
}

test("EXIGER l'habilitation depuis la fiche d'un lieu d'intervention, puis la RETIRER", async ({
  page,
}) => {
  const chemin = await premierLieu(page);
  await page.goto(chemin);

  const formulaireExigence = page.locator(
    'form[action="/api/habilitations/exigences/creer"]',
  );
  await expect(formulaireExigence).toBeVisible();
  await formulaireExigence
    .locator('select[name="habilitation_id"]')
    .selectOption({ label: CODE });
  await formulaireExigence
    .getByRole("button", { name: fr["habilitations.site.exiger_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(chemin);
  await expect(page.locator("[role='status']")).toHaveCount(0);

  const ligneExigee = page.locator("li").filter({ hasText: CODE });
  await expect(ligneExigee).toBeVisible();
  // Le défaut sûr : « bloquante », jamais un avertissement (RG-PLA-04).
  await expect(
    ligneExigee.getByText(fr["habilitations.site.bloquant"]),
  ).toBeVisible();

  await ligneExigee
    .getByRole("button", { name: fr["habilitations.retirer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[role='status']")).toHaveCount(0);
  await expect(page.locator("li").filter({ hasText: CODE })).toHaveCount(0);
});
