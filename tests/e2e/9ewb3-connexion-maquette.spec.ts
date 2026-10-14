import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EWB3-CONNEXION-MAQUETTE — LES ÉPREUVES NEUVES DE CE LOT.
 *
 * Trois choses, mesurées séparément :
 * 1. le panneau sombre fait 50 % de la largeur à 1280 px, et la marque s'y
 *    fond (même couleur de fond) ;
 * 2. à 375 px, rien ne déborde, et la marque reste visible malgré la
 *    disparition du panneau ;
 * 3. `/premier-acces` rend le même écran « lien plus valide » sans jeton,
 *    quel que soit `motif`.
 *
 * Les captures (375/1280, en viewport, jamais pleine page) suivent le même
 * interrupteur que `captures-9dja-acces-technicien.spec.ts` : rien n'est écrit
 * sans `CAPTURES_9EWB3`.
 */

const dictionnaire = fr as Record<string, string>;

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

test("à 1280 px, le panneau fait 50 % ± 2 px de la largeur, et la marque s'y fond", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/connexion");

  const titrePanneau = page.getByRole("heading", {
    level: 2,
    name: dictionnaire["connexion.cadre.titre"],
  });
  const panneau = titrePanneau.locator("xpath=..");
  const boitePanneau = await panneau.boundingBox();
  expect(boitePanneau).not.toBeNull();
  expect(Math.abs((boitePanneau?.width ?? 0) - 640)).toBeLessThanOrEqual(2);
  expect(boitePanneau?.x ?? -1).toBeCloseTo(0, 0);

  const marque = page.locator('a[href="/"]');
  const fondMarque = await marque.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const fondPanneau = await panneau.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(fondMarque).toBe(fondPanneau);
});

test("à 375 px, rien ne déborde et la marque reste visible malgré la disparition du panneau", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/connexion");

  const largeurDocument = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(largeurDocument).toBeLessThanOrEqual(375);

  await expect(page.locator('a[href="/"]')).toBeVisible();
  await expect(
    page.getByText(dictionnaire["connexion.cadre.titre"]),
  ).toBeHidden();
});

test("le libellé de l'adresse porte « (obligatoire) »", async ({ page }) => {
  await page.goto("/connexion");
  const suffixe = dictionnaire["intervention.creation.obligatoire_suffixe"];
  await expect(
    page.getByLabel(`${dictionnaire["connexion.email"]} ${suffixe}`),
  ).toBeVisible();
});

test("/premier-acces sans jeton rend « Ce lien n'est plus valide », quel que soit le motif", async ({
  page,
}) => {
  await page.goto("/premier-acces");
  await expect(
    page.getByRole("heading", {
      name: dictionnaire["premier_acces.lien_invalide.titre"],
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: dictionnaire["premier_acces.lien_invalide.action"],
    }),
  ).toHaveAttribute("href", "/connexion");

  // Le motif d'un jeton refusé par la route (D35, D50) ne change rien :
  // c'est la PRÉSENCE du jeton, jamais `motif`, qui décide de la branche.
  await page.goto("/premier-acces?motif=premier_acces.refuse");
  await expect(
    page.getByRole("heading", {
      name: dictionnaire["premier_acces.lien_invalide.titre"],
    }),
  ).toBeVisible();
});

// ── CAPTURES (375/1280, EN VIEWPORT) ───────────────────────────────────────

test.describe("captures", () => {
  test.describe.configure({ mode: "serial" });

  const DOSSIER = process.env.CAPTURES_9EWB3 ?? "";
  const COURRIEL_TECHNICIEN = "technicien@captures9ewb3.e2e.test";
  const MOT_DE_PASSE_CHOISI = "mot-de-passe-captures9ewb3-epreuve";

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

  async function capturerAuxDeuxLargeurs(
    page: Page,
    nom: string,
  ): Promise<void> {
    for (const largeur of [1280, 375] as const) {
      await page.setViewportSize({ width: largeur, height: 900 });
      // Laisse les media queries et le flux resize s'installer avant de
      // photographier (même garde que `captures-9dja-acces-technicien.
      // spec.ts`).
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
        fullPage: false,
      });
    }
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

  async function ouvrirLeVoletTechnicien(page: Page) {
    await page
      .getByRole("link", { name: fr["equipe.ajouter_personne"] })
      .click();
    await page
      .getByRole("link", { name: fr["equipe.volet.technicien"], exact: true })
      .click();
  }

  function formulaireCreationTechnicien(page: Page) {
    return page.locator('form[action="/api/techniciens/creer"]');
  }

  test("captures — connexion, mot de passe oublié, premier accès, lien plus valide", async ({
    page,
    browser,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/equipe");
    await ouvrirLeVoletTechnicien(page);

    const formulaireCreation = formulaireCreationTechnicien(page);
    await formulaireCreation
      .getByLabel(fr["equipe.nom"])
      .fill("9EWB3 Captures Technicien");
    await formulaireCreation
      .getByLabel(fr["equipe.email"])
      .fill(COURRIEL_TECHNICIEN);
    const options = formulaireCreation.locator(
      'select[name="agence_id"] option',
    );
    await expect(options.nth(1)).toBeAttached();
    const valeurAgence = await options.nth(1).getAttribute("value");
    await formulaireCreation
      .locator('select[name="agence_id"]')
      .selectOption(valeurAgence ?? "");
    await formulaireCreation
      .locator('select[name="statut_ressource"]')
      .selectOption("salarie");
    await formulaireCreation
      .getByRole("button", { name: fr["equipe.creer_action"] })
      .click();
    await page.waitForLoadState("networkidle");

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
      .filter({ hasText: "9EWB3 Captures Technicien" })
      .filter({ has: page.locator("form") });
    await fiche.locator("summary").click();
    await fiche
      .locator(`form[action="/api/equipe/${utilisateurId}/envoyer-acces"]`)
      .getByRole("button")
      .click();
    await page.waitForLoadState("networkidle");

    const correspondant = courrielsCaptures().find((courriel) =>
      courriel.to.includes(COURRIEL_TECHNICIEN),
    );
    expect(correspondant).toBeDefined();
    const urlPremierAcces = /https?:\/\/\S+/.exec(
      correspondant?.text ?? "",
    )?.[0];
    expect(urlPremierAcces).toBeDefined();

    const pageTechnicien = await browser.newPage();

    await pageTechnicien.goto("/connexion");
    await capturerAuxDeuxLargeurs(pageTechnicien, "connexion");

    await pageTechnicien.goto("/mot-de-passe-oublie");
    await capturerAuxDeuxLargeurs(pageTechnicien, "mot-de-passe-oublie");

    await pageTechnicien.goto(urlPremierAcces ?? "");
    await expect(
      pageTechnicien.getByLabel(fr["premier_acces.mot_de_passe"]),
    ).toBeVisible();
    await capturerAuxDeuxLargeurs(pageTechnicien, "premier-acces");

    await pageTechnicien.goto("/premier-acces");
    await expect(
      pageTechnicien.getByRole("heading", {
        name: fr["premier_acces.lien_invalide.titre"],
      }),
    ).toBeVisible();
    await capturerAuxDeuxLargeurs(
      pageTechnicien,
      "premier-acces-lien-invalide",
    );

    // L'accès reste utilisable malgré les captures — le même témoin que
    // `captures-9dja-acces-technicien.spec.ts`.
    await pageTechnicien.goto(urlPremierAcces ?? "");
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
  });
});
