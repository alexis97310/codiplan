import { mkdirSync } from "node:fs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9DJA-REPRISE-9DJ (D162) — demandées par le ticket d'origine
 * (page Équipe, connexion, mot de passe oublié, premier accès), jamais
 * prises (passation de 9DJ-TP-ACC1-DONNER-ACCES, « Ce que je n'ai pas fait »).
 *
 * Rien n'est écrit sur disque sans la variable d'environnement qui nomme le
 * dossier, pour que `pnpm test:e2e` ordinaire n'écrive jamais de fichier —
 * même discipline que `captures-9ay-aa1-choix-sites.spec.ts`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `CAPTURES9DJ` (`captures9dj.e2e.nom`) — un
 * technicien créé par l'épreuve, supprimé en `afterAll`. Le courriel est
 * doublé au niveau du serveur, même mécanique que `acces-technicien.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DJA ?? "";

const NOM_TECHNICIEN = fr["captures9dj.e2e.nom"];
const COURRIEL_TECHNICIEN = "technicien@captures9dj.e2e.test";
const MOT_DE_PASSE_CHOISI = "mot-de-passe-captures9dj-epreuve";

let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(() => {
  if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
    writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.technicien.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
});

async function capturerAuxDeuxLargeurs(page: Page, nom: string): Promise<void> {
  for (const largeur of [1280, 375] as const) {
    await page.setViewportSize({ width: largeur, height: 1200 });
    // Laisse les media queries et le flux resize s'installer avant de
    // photographier — un screenshot immédiat après `setViewportSize` peut
    // encore porter la mise en page de la largeur précédente.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (DOSSIER === "") continue;
    mkdirSync(DOSSIER, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

function formulaireCreationTechnicien(page: Page) {
  return page.locator('form[action="/api/techniciens/creer"]');
}

type CorpsIntercepte = {
  readonly to: readonly string[];
  readonly text: string;
};

function courrielsCaptures(): CorpsIntercepte[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as CorpsIntercepte);
}

test("captures — donner l'accès à un technicien, de l'écran Équipe au premier accès (D162)", async ({
  page,
  browser,
}) => {
  // ── 1. ÉQUIPE : « PAS D'ACCÈS » ──────────────────────────────────────────
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  const formulaireCreation = formulaireCreationTechnicien(page);
  await formulaireCreation.getByLabel(fr["equipe.nom"]).fill(NOM_TECHNICIEN);
  await formulaireCreation
    .getByLabel(fr["equipe.email"])
    .fill(COURRIEL_TECHNICIEN);
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
  await expect(page.locator("[role='status']")).toHaveCount(0);

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_TECHNICIEN },
      select: { id: true },
    });
    utilisateurId = identite.id;
  } finally {
    await client.$disconnect();
  }

  const fiche = page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
  await expect(fiche).toBeVisible();
  await fiche.locator("summary").click();
  await expect(fiche.getByText(fr["equipe.acces.aucun"])).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-pas-dacces");

  // ── 2. ÉQUIPE : « LIEN ENVOYÉ » ──────────────────────────────────────────
  await fiche
    .locator(`form[action="/api/equipe/${utilisateurId}/envoyer-acces"]`)
    .getByRole("button")
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(fr["equipe.acces.envoye"])).toBeVisible();
  const ficheApresEnvoi = page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
  await ficheApresEnvoi.locator("summary").click();
  await expect(
    ficheApresEnvoi.getByText(fr["equipe.acces.lien_envoye_prefixe"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-lien-envoye");

  // ── 3. LE LIEN, RELU DANS LE FICHIER DES COURRIELS INTERCEPTÉS ───────────
  const correspondant = courrielsCaptures().find((courriel) =>
    courriel.to.includes(COURRIEL_TECHNICIEN),
  );
  expect(correspondant).toBeDefined();
  const urlPremierAcces = /https?:\/\/\S+/.exec(correspondant?.text ?? "")?.[0];
  expect(urlPremierAcces).toBeDefined();

  // ── 4. CONNEXION : LE LIEN « MOT DE PASSE OUBLIÉ » ───────────────────────
  const pageTechnicien = await browser.newPage();
  await pageTechnicien.goto("/connexion");
  await expect(
    pageTechnicien.getByText(fr["connexion.mot_de_passe_oublie"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(pageTechnicien, "connexion");

  // ── 5. MOT DE PASSE OUBLIÉ ────────────────────────────────────────────────
  await pageTechnicien.goto("/mot-de-passe-oublie");
  await expect(
    pageTechnicien.getByText(fr["mot_de_passe_oublie.texte"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(pageTechnicien, "mot-de-passe-oublie");

  // ── 6. PREMIER ACCÈS ──────────────────────────────────────────────────────
  await pageTechnicien.goto(urlPremierAcces ?? "");
  await expect(
    pageTechnicien.getByLabel(fr["premier_acces.mot_de_passe"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(pageTechnicien, "premier-acces");

  // ── 7. ÉQUIPE : « ACCÈS ACTIVÉ » ──────────────────────────────────────────
  await pageTechnicien
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageTechnicien
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageTechnicien
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageTechnicien.waitForLoadState("networkidle");
  await expect(pageTechnicien).toHaveURL(/\/connexion/);
  await pageTechnicien.close();

  await page.goto("/parametres/equipe");
  const ficheApresActivation = page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
  await ficheApresActivation.locator("summary").click();
  await expect(
    ficheApresActivation.getByText(fr["equipe.acces.actif"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-acces-active");
});
