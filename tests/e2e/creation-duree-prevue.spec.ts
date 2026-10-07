import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirPriorite } from "./setup/formulaire-creation";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-B6-DUREE-A-LA-CREATION (audit du 27/09/2026 §4.3 ; décision QG-12
 * d'Alexis : des choix rapides, AUCUNE VALEUR PAR DÉFAUT).
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * « Créer une intervention » ne demandait pas la durée : `schemaCreation`
 * n'avait pas ce champ, et `duree_estimee_min` restait toujours `null` à la
 * naissance. La fenêtre de pose (`FenetrePose`, ouverte depuis « Trouver un
 * créneau ») ne pouvait alors jamais préremplir de puce de durée pour une
 * intervention tout juste créée.
 *
 * ## Ce que ce fichier éprouve, à travers l'écran
 *
 *   1. Une durée choisie à la création s'écrit dans `duree_estimee_min`, et
 *      RIEN D'AUTRE (ni date, ni heure, ni technicien — PARCOURS-1 tient
 *      toujours).
 *   2. Après « Créer », le bandeau « Intervention créée » propose
 *      « Planifier maintenant » (qui ouvre `FenetrePose`, PUCE DE DURÉE
 *      DÉJÀ SÉLECTIONNÉE) et « Laisser dans la file ».
 *   3. Sans durée choisie à la création, aucune puce n'est présélectionnée —
 *      exactement le comportement d'avant ce ticket.
 *   4. Une fois planifiée (ici par le repli « Saisir à la main », déterministe),
 *      la carte se pose bien dans la grille de la vue Jour.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB6-` — un client et un site créés en
 * `beforeAll`, supprimés en `afterAll` avec toutes les interventions qui s'y
 * rattachent ; aucune ligne du semis n'est touchée.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_PGB6 = uuidv7();
const SITE_PGB6 = uuidv7();
const LIBELLE_SITE = "PGB6-site";

let reperes: ReperesDeScene;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGB6,
        societe_id: reperes.societeId,
        raison_sociale: "PGB6-client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB6,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB6,
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
      CLIENT_PGB6,
    );
    await client.intervention.deleteMany({ where: { client_id: CLIENT_PGB6 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB6 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB6 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Les six puces de durée de `FenetrePose`/`ChampDureePrevue`, par minutes. */
const CLES_DUREE: Record<number, keyof typeof fr> = {
  30: "planning.pose.duree_30",
  60: "planning.pose.duree_60",
  90: "planning.pose.duree_90",
  120: "planning.pose.duree_120",
  180: "planning.pose.duree_180",
  240: "planning.pose.duree_240",
};

async function creerIntervention(
  page: Page,
  panne: string,
  dureeMinutes: number | null,
): Promise<string> {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page.locator('textarea[name="description"]').fill(panne);
  if (dureeMinutes !== null) {
    await page
      .getByRole("button", { name: fr[CLES_DUREE[dureeMinutes]], exact: true })
      .click();
  }
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+\?cree=1$/);
  return new URL(page.url()).pathname.split("/").pop() as string;
}

function banniereCreation(page: Page) {
  return page.locator("[data-banniere-creation]");
}

test("une durée choisie à la création s'écrit seule, et se retrouve présélectionnée dans la fenêtre de pose", async ({
  page,
}) => {
  const id = await creerIntervention(page, "PGB6-panne-avec-duree", 120);

  // LE BANDEAU « INTERVENTION CRÉÉE » PROPOSE LES DEUX CHOIX.
  const banniere = banniereCreation(page);
  await expect(banniere).toBeVisible();
  await expect(banniere).toContainText(
    fr["intervention.creation.bandeau_cree"],
  );
  const boutonPlanifierMaintenant = banniere.getByRole("button", {
    name: fr["intervention.creation.planifier_maintenant"],
  });
  await expect(boutonPlanifierMaintenant).toBeVisible();
  await expect(
    banniere.getByRole("link", {
      name: fr["intervention.creation.laisser_dans_la_file"],
    }),
  ).toBeVisible();

  // SEULE LA DURÉE EST ÉCRITE — ni date, ni heure, ni technicien.
  const client = admin();
  try {
    const intervention = await client.intervention.findUniqueOrThrow({
      where: { id },
      select: {
        duree_estimee_min: true,
        date_planifiee: true,
        technicien_id: true,
        statut: true,
      },
    });
    expect(intervention.duree_estimee_min).toBe(120);
    expect(intervention.date_planifiee).toBeNull();
    expect(intervention.technicien_id).toBeNull();
    expect(intervention.statut).toBe("a_planifier");
  } finally {
    await client.$disconnect();
  }

  // « PLANIFIER MAINTENANT » OUVRE LA FENÊTRE DE POSE (PG-B2), PUCE DÉJÀ
  // SÉLECTIONNÉE — la durée choisie à la création s'y retrouve.
  await boutonPlanifierMaintenant.click();
  const fenetre = page.locator(`[data-fenetre-pose="${id}"]`);
  await expect(fenetre).toBeVisible();
  await expect(
    fenetre.getByRole("button", {
      name: fr["planning.pose.duree_120"],
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  // Fermée SANS écrire — cette fenêtre ne sert ici qu'à observer le préremplissage.
  await fenetre
    .getByRole("button", { name: fr["planning.pose.annuler"], exact: true })
    .click();
  await expect(fenetre).not.toBeVisible();

  // ── LA CARTE, UNE FOIS PLANIFIÉE, SE POSE EN VUE JOUR ────────────────────
  // Le repli « Saisir à la main » complète la planification de façon
  // déterministe (même route que « Planifier maintenant », voir
  // `parcours-creer-puis-planifier.spec.ts`).
  // +126 JOURS (18 SEMAINES), UN MARDI ENCORE — à l'écart des offsets déjà
  // pris par les fichiers voisins qui posent sur le MARDI ordinaire de la
  // scène (0, 21, 35, 49, 63, 70, 91, 105 : voir `parcours-creer-puis-planifier.spec.ts`
  // et ses voisins) : la case grandit avec ce que d'autres scénarios y
  // posent, et une collision de créneau accuserait la règle au lieu du geste.
  const mardi = jourSuivant(jourDeLaScene(reperes, MARDI), 126);
  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await formulaire
    .locator("summary", { hasText: fr["intervention.action.saisir_a_la_main"] })
    .click();
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("09:00");
  await formulaire.locator('input[name="duree_min"]').fill("120");
  const options = formulaire.locator(
    'select[name="technicien_id"] option:not([value=""])',
  );
  await expect(options.first()).toBeAttached();
  const technicien = await options.first().getAttribute("value");
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(technicien ?? "");
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  // « Transmettre » est l'action PRINCIPALE d'une Planifiée depuis D141
  // (9CO-PG-G14A-TRANSMETTRE) — « Affecter » est désormais SECONDAIRE,
  // repliée dans un `<details>`, donc invisible sans l'ouvrir.
  await expect(page.locator("form#action-transmettre")).toBeVisible();

  await page.goto(`/planning?vue=jour&jour=${cleDeJour(mardi)}`);
  await expect(page.locator(`[data-bloc="${id}"]`)).toBeVisible();
});

test("sans durée choisie à la création, aucune puce n'est présélectionnée — comme avant ce ticket", async ({
  page,
}) => {
  const id = await creerIntervention(page, "PGB6-panne-sans-duree", null);

  const client = admin();
  try {
    const intervention = await client.intervention.findUniqueOrThrow({
      where: { id },
      select: { duree_estimee_min: true },
    });
    expect(intervention.duree_estimee_min).toBeNull();
  } finally {
    await client.$disconnect();
  }

  const banniere = banniereCreation(page);
  await banniere
    .getByRole("button", {
      name: fr["intervention.creation.planifier_maintenant"],
    })
    .click();
  const fenetre = page.locator(`[data-fenetre-pose="${id}"]`);
  await expect(fenetre).toBeVisible();
  for (const cle of Object.values(CLES_DUREE)) {
    await expect(
      fenetre.getByRole("button", { name: fr[cle], exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  }
});
