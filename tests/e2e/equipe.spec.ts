import { createOTP } from "@better-auth/utils/otp";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

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
 * Recopié de `tests/e2e/montants-par-role.spec.ts` plutôt que partagé : le
 * territoire de ce lot n'autorise qu'un seul fichier neuf sous `tests/e2e/`.
 * La clé est lue SUR L'ÉCRAN, comme un humain la lirait — un harnais qui
 * écrirait un secret en base éprouverait un chemin qui n'existe pas.
 */
test.describe.configure({ mode: "serial" });

function base32VersBrut(base32: string): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const caractere of base32.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) {
      throw new Error(`Clé affichée illisible : « ${caractere} » hors base32.`);
    }
    bits += index.toString(2).padStart(5, "0");
  }
  let brut = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    brut += String.fromCharCode(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return brut;
}

let cleActivee = "";

async function codeCourant(): Promise<string> {
  return createOTP(cleActivee, { digits: 6, period: 30 }).totp();
}

async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

async function ouvrirLaSession(page: Page, email: string): Promise<void> {
  await seConnecter(page, email);
  if (page.url().includes("/enrolement")) {
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    const affichee = (await page.locator("code").first().innerText()).replace(
      /\s+/g,
      "",
    );
    cleActivee = base32VersBrut(affichee);
    expect(cleActivee).not.toBe("");
    await page.fill('input[name="code"]', await codeCourant());
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await seConnecter(page, email);
  }
  if (page.url().includes("/connexion/code")) {
    expect(cleActivee).not.toBe("");
    await page.fill('input[name="code"]', await codeCourant());
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }
  await expect(page).toHaveURL(/\/arrivee/);
}

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
  await ouvrirLaSession(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
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
