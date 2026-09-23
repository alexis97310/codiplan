import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FICHE NOMME LA PERSONNE, OU DIT L'ABSENCE — JAMAIS L'IDENTIFIANT (FICHE-1,
 * C-06, ticket #198 ; I10).
 *
 * Le constat du ticket — `ligne.technicien_id ?? t("intervention.aucun_technicien")`
 * — n'est plus l'état de `main` depuis `edb089a` (#239) : la fiche passe par
 * `technicienAfficheSurLaFiche`, qui reprend `quiTravaille` et l'annuaire
 * cloisonné de la liste. Ce qui manquait n'est pas la résolution, c'est
 * l'ÉPREUVE DE RENDU des deux cas que le ticket exige :
 *
 * - `tests/unit/interventions/technicien-fiche.test.ts` éprouve la FONCTION,
 *   sur un annuaire factice — pas l'écran ;
 * - `tests/e2e/intervention-technicien-select.spec.ts` lit le nom sur la fiche
 *   une fois affecté, mais ne regarde jamais la fiche d'une intervention SANS
 *   technicien, et n'affirme nulle part qu'aucun identifiant n'est rendu.
 *
 * Or c'est précisément le second cas qui est le cas réel d'Alexis (mesure du
 * 22/09 : aucun technicien en base, 1751 interventions d'archive sans clé).
 *
 * ## Ce que « aucun UUID dans le rendu » veut dire ici
 *
 * Le TEXTE VISIBLE (`innerText` de `main`) ne porte aucun identifiant de la
 * forme `8-4-4-4-12`. Les `<option value="…">` des sélecteurs « Affecter » et
 * « Déplacer » portent des UUID dans un ATTRIBUT — c'est leur rôle, et un
 * attribut n'est pas lu par un humain. `Local-XXXXXX` (référence d'une
 * intervention sans numéro serveur) prend six caractères de l'`id`, pas
 * l'`id` : il ne correspond pas au motif.
 *
 * `CAPTURES_FICHE_1=<dossier>` fait écrire les deux captures à 1280 px et
 * `mesure.json` — empreinte du commit, horodatage, ce que chaque fiche a rendu.
 *
 * **ADAPTÉ PAR PARCOURS-1 (23/09/2026, arbitrage Alexis)** : la création ne
 * porte plus de technicien — *« ni la date, ni le technicien affecté »* ne se
 * décident plus à la création. Le cas « AFFECTÉE » nomme donc désormais le
 * technicien par le geste PLANIFIER, sur la fiche, une fois l'intervention
 * créée — la fiche affiche alors le même nom, par le même chemin de lecture
 * (`technicienAfficheSurLaFiche`) qu'avant ce lot.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_FICHE_1 ?? "";

/** La forme canonique d'un UUID, la seule que Prisma écrit (`@db.Uuid`). */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  fiches: Record<string, { url: string; technicien_rendu: string }>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  fiches: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

/** Le `<dd>` qui suit le `<dt>` « Technicien » de la fiche — la valeur lue. */
function valeurTechnicien(page: Page) {
  return page
    .locator("dt", { hasText: fr["intervention.technicien"] })
    .first()
    .locator("xpath=following-sibling::dd[1]");
}

/** Crée une intervention sur le premier site — NI date, NI technicien (PARCOURS-1). */
async function creerUneIntervention(page: Page): Promise<void> {
  await page.goto("/interventions/nouvelle");
  const optionsSite = page.locator('select[name="site"] option');
  await expect(optionsSite.first()).toBeAttached();
  const valeurSite = await optionsSite.first().getAttribute("value");
  await page.locator('select[name="site"]').selectOption(valeurSite ?? "");
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve — fiche-technicien-nomme");

  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
}

/**
 * PLANIFIE l'intervention actuellement ouverte avec le technicien d'index
 * `option` du bloc « Planifier » (PARCOURS-1) — date, heure et durée sont
 * posées à des valeurs plausibles, exigées ensemble avec le technicien.
 * Rend le NOM affiché par l'option choisie, tel que la liste le nommerait.
 */
async function planifierAvecTechnicien(
  page: Page,
  option: number,
): Promise<string> {
  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  const options = formulaire.locator('select[name="technicien_id"] option');
  await expect(options.nth(option)).toBeAttached();
  const nom = ((await options.nth(option).textContent()) ?? "").trim();
  const valeur = await options.nth(option).getAttribute("value");
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(valeur ?? "");
  const reperes = await reperesDeLaScene();
  const mardi = jourDeLaScene(reperes, MARDI);
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("10:00");
  await formulaire.locator('input[name="duree_min"]').fill("60");
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  return nom;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("SANS technicien : la fiche dit l'absence, et aucun identifiant n'est rendu", async ({
  page,
}) => {
  await creerUneIntervention(page);

  const valeur = valeurTechnicien(page);
  await expect(valeur).toHaveText(fr["intervention.aucun_technicien"]);

  const texteVisible = await page.locator("main").innerText();
  expect(texteVisible).not.toMatch(UUID);

  mesure.fiches.sans_technicien = {
    url: new URL(page.url()).pathname,
    technicien_rendu: (await valeur.innerText()).trim(),
  };
  await capturer(page, "fiche-sans-technicien");
});

test("AFFECTÉE : la fiche nomme la personne comme la liste la nomme — le nom, jamais la clé", async ({
  page,
}) => {
  await creerUneIntervention(page);
  // La PREMIÈRE option est « Aucun technicien affecté » ; la SECONDE est le
  // premier technicien réel du semis — celui que la liste nommerait.
  const nom = await planifierAvecTechnicien(page, 1);
  expect(nom).not.toBeNull();
  expect(nom ?? "").not.toMatch(UUID);
  expect((nom ?? "").length).toBeGreaterThan(0);

  const valeur = valeurTechnicien(page);
  await expect(valeur).toHaveText(nom ?? "");
  // Ni le libellé d'absence, ni les deux replis de `quiTravaille` : la
  // personne a bien été NOMMÉE, pas seulement « pas identifiée ».
  await expect(valeur).not.toHaveText(fr["intervention.aucun_technicien"]);
  await expect(valeur).not.toHaveText(fr["planning.nom_non_communique"]);
  await expect(valeur).not.toHaveText(fr["planning.nom_non_demande"]);

  const texteVisible = await page.locator("main").innerText();
  expect(texteVisible).not.toMatch(UUID);

  mesure.fiches.affectee = {
    url: new URL(page.url()).pathname,
    technicien_rendu: (await valeur.innerText()).trim(),
  };
  await capturer(page, "fiche-technicien-nomme");
});
