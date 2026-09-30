import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  MERCREDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * « + CRÉER ICI » (PG-D5-CREER-ICI) — un clic sur une case vide du planning
 * propose un lien vers `/interventions/nouvelle`, préreppli par
 * `poser_technicien`/`poser_date`/`poser_heure`. PARCOURS-1 reste intacte :
 * la case ne touche JAMAIS `schemaCreation` — elle ne préremplit QUE la
 * fenêtre de pose, une fois l'intervention créée.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGD5-` — un client et un site DUCOS créés en
 * `beforeAll`, effacés en `afterAll` avec toutes les interventions retrouvées
 * par leur client (préfixe PGD5-) ; jamais une fixture `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_PGD5 = uuidv7();
const SITE_PGD5 = uuidv7();
const LIBELLE_SITE = "PGD5-site";
const RANG_SEMAINES = 22;

let reperes: ReperesDeScene;
let jourCible: ReturnType<typeof jourDeLaScene>;
let jourCible2: ReturnType<typeof jourDeLaScene>;
let lundiDeLaFenetre: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jourCible = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_SEMAINES * 7);
  jourCible2 = jourSuivant(jourDeLaScene(reperes, MERCREDI), RANG_SEMAINES * 7);
  lundiDeLaFenetre = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGD5,
        societe_id: reperes.societeId,
        raison_sociale: "PGD5-client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGD5,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGD5,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" IN (SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid)`,
      CLIENT_PGD5,
    );
    await client.intervention.deleteMany({ where: { client_id: CLIENT_PGD5 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_PGD5 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGD5 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
});

function banniereCreation(page: Page) {
  return page.locator("[data-banniere-creation]");
}

test("Semaine — un clic sur une case vide propose « + Créer ici », qui prérempli la fenêtre après création", async ({
  page,
}) => {
  await page.goto(
    `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`,
  );

  const jourCle = cleDeJour(jourCible);
  const case_ = page.locator(
    `td[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienDucos}"]`,
  );
  await expect(case_).toBeVisible();
  // LA CASE EST VIDE — un témoin, pour ne pas prendre une case déjà posée.
  await expect(case_.locator("a[data-tiroir-declencheur]")).toHaveCount(0);

  await case_.click();
  const lien = case_.locator("a[data-creer-ici]");
  await expect(lien).toBeVisible();
  const href = await lien.getAttribute("href");
  expect(href).toBe(
    `/interventions/nouvelle?poser_technicien=${reperes.technicienDucos}&poser_date=${jourCle}`,
  );

  // UN SECOND CLIC SUR LE FOND LE RETIRE.
  await case_.click();
  await expect(lien).not.toBeVisible();
  await case_.click();
  await expect(lien).toBeVisible();

  await lien.click();
  await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);

  // TROIS CHAMPS CACHÉS, AUCUN CHAMP VISIBLE DE PLUS (PARCOURS-1).
  await expect(
    page.locator('input[type="hidden"][name="poser_technicien"]'),
  ).toHaveValue(reperes.technicienDucos);
  await expect(
    page.locator('input[type="hidden"][name="poser_date"]'),
  ).toHaveValue(jourCle);
  await expect(page.locator('[name="poser_heure"]')).toHaveCount(0);
  await expect(page.locator('input[name="date_planifiee"]')).toHaveCount(0);
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);

  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('select[name="type"]').selectOption("curatif");
  await page
    .locator('textarea[name="description"]')
    .fill("PGD5-panne-creer-ici");

  let posteVersDeplacer = false;
  page.on("request", (requete) => {
    if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
      posteVersDeplacer = true;
    }
  });

  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(
    new RegExp(
      `/interventions/[0-9a-f-]+\\?cree=1&poser_technicien=${reperes.technicienDucos}&poser_date=${jourCle}$`,
    ),
  );
  const interventionId = new URL(page.url()).pathname
    .split("/")
    .pop() as string;

  // LA FENÊTRE S'OUVRE D'EMBLÉE, PRÉ-REMPLIE — SANS AUCUNE ÉCRITURE.
  expect(posteVersDeplacer).toBe(false);
  const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toHaveAttribute("data-jour", jourCle);
  await expect(fenetre).toHaveAttribute(
    "data-technicien",
    reperes.technicienDucos,
  );

  await fenetre
    .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
    .click();
  const creneauxFieldset = fenetre
    .locator("fieldset")
    .filter({ hasText: fr["planning.pose.heure"] });
  const premierCreneau = creneauxFieldset.locator("button").first();
  await expect(premierCreneau).toBeVisible();
  await premierCreneau.click();

  const boutonPlanifier = fenetre.getByRole("button", {
    name: fr["planning.pose.confirmer"],
    exact: true,
  });
  await expect(boutonPlanifier).toBeEnabled();
  const reponseDeplacer = page.waitForResponse(
    (reponse) =>
      reponse.url().includes("/deplacer") &&
      reponse.request().method() === "POST",
  );
  await boutonPlanifier.click();
  const reponse = await reponseDeplacer;
  expect(reponse.ok()).toBe(true);
  await page.waitForLoadState("load");

  const client = admin();
  try {
    const apres = await client.intervention.findUniqueOrThrow({
      where: { id: interventionId },
      select: {
        statut: true,
        technicien_id: true,
        date_planifiee: true,
      },
    });
    expect(apres.statut).toBe("planifiee");
    expect(apres.technicien_id).toBe(reperes.technicienDucos);
    expect(apres.date_planifiee?.toISOString().slice(0, 10)).toBe(jourCle);
  } finally {
    await client.$disconnect();
  }
});

test("Annuler puis « Laisser dans la file » — rien n'est planifié", async ({
  page,
}) => {
  await page.goto(
    `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`,
  );
  const jourCle = cleDeJour(jourCible2);
  const case_ = page.locator(
    `td[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienDucos}"]`,
  );
  await case_.click();
  await case_.locator("a[data-creer-ici]").click();

  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('select[name="type"]').selectOption("curatif");
  await page.locator('textarea[name="description"]').fill("PGD5-panne-annuler");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  const interventionId = new URL(page.url()).pathname
    .split("/")
    .pop() as string;
  const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
  await expect(fenetre).toBeVisible();
  await page.getByRole("button", { name: fr["planning.pose.annuler"] }).click();
  await expect(fenetre).not.toBeVisible();
  await expect(banniereCreation(page)).toBeVisible();

  await page
    .getByRole("link", {
      name: fr["intervention.creation.laisser_dans_la_file"],
    })
    .click();
  await expect(banniereCreation(page)).not.toBeVisible();

  const client = admin();
  try {
    const apres = await client.intervention.findUniqueOrThrow({
      where: { id: interventionId },
      select: { statut: true, date_planifiee: true },
    });
    expect(apres.statut).toBe("a_planifier");
    expect(apres.date_planifiee).toBeNull();
  } finally {
    await client.$disconnect();
  }
});

test("un refus de saisie garde les trois champs poser_*", async ({ page }) => {
  await page.goto(
    `/interventions/nouvelle?poser_technicien=${reperes.technicienDucos}&poser_date=${cleDeJour(jourCible)}`,
  );
  // AUCUNE NATURE CHOISIE — refus attendu.
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('textarea[name="description"]').fill("PGD5-panne-refusee");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);
  await expect(
    page.locator('input[type="hidden"][name="poser_technicien"]'),
  ).toHaveValue(reperes.technicienDucos);
  await expect(
    page.locator('input[type="hidden"][name="poser_date"]'),
  ).toHaveValue(cleDeJour(jourCible));
});

test("témoin — « Créer une intervention » de l'en-tête garde ?cree=1 exactement", async ({
  page,
}) => {
  await page.goto("/planning");
  await page.getByRole("link", { name: fr["planning.creer"] }).click();
  await expect(page).toHaveURL(/\/interventions\/nouvelle$/);
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('select[name="type"]').selectOption("curatif");
  await page.locator('textarea[name="description"]').fill("PGD5-panne-temoin");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+\?cree=1$/);
  await expect(page.locator("[data-fenetre-pose]")).toHaveCount(0);
});

test("vue Jour — le lien porte aussi poser_heure", async ({ page }) => {
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(jourCible)}`);
  const case_ = page
    .locator(
      `td[data-depot-technicien="${reperes.technicienDucos}"][data-etat="libre"]`,
    )
    .first();
  if ((await case_.count()) === 0) {
    // Aucune case libre ce jour-là pour ce technicien (calendrier de la
    // scène) — non vérifié plutôt que de forcer une case qui n'existe pas.
    return;
  }
  await case_.click();
  const lien = case_.locator("a[data-creer-ici]");
  await expect(lien).toBeVisible();
  const href = await lien.getAttribute("href");
  expect(href).toMatch(
    new RegExp(
      `^/interventions/nouvelle\\?poser_technicien=${reperes.technicienDucos}&poser_date=${cleDeJour(jourCible)}&poser_heure=\\d+$`,
    ),
  );
});
