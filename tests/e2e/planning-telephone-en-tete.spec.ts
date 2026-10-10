import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EH-TP-UX-PL-PLANNING-1 (décision 69 d'Alexis, précisée par la décision 71
 * du 10/10/2026) — SOUS 901 PX, L'EN-TÊTE DU PLANNING PASSE EN COLONNE ET
 * SES DEUX BOUTONS DEVIENNENT PLEINE LARGEUR, CÔTE À CÔTE.
 *
 * ## L'ORACLE DE « DEMAIN », MÊME PATRON QUE `pg-g14b-transmettre-groupe`
 *
 * « Transmettre demain » n'apparaît QUE si au moins une intervention
 * `planifiee`/`affectee`, avec technicien, tombe sur le premier jour ouvert
 * après aujourd'hui (`prochainJourOuvert`, mêmes calendriers que la page
 * charge) — jamais un décalage fixe, qui dépendrait du jour où l'épreuve
 * tourne.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PGTEL-`, AUCUNE LIGNE AU SEMIS
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const PRETE_ID = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const fenetre = {
      du: jourSuivant(aujourdhui),
      au: jourSuivant(aujourdhui, 16),
    };
    const agences = await client.agence.findMany({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });
    const calendriers = (
      await Promise.all(
        agences.map((agence) =>
          chargerCalendrierAgence(client, {
            societeId: reperes.societeId,
            agenceId: agence.id,
            fenetre,
          }),
        ),
      )
    ).filter((c): c is Calendrier => c !== null);
    const demain = prochainJourOuvert(calendriers, fenetre.du);
    const demainCle = cleDeJour(demain);

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "PGTEL — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: ducos.id,
        libelle: "PGTEL — site forgé",
      },
    });
    await client.intervention.create({
      data: {
        id: PRETE_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${demainCle}T00:00:00.000Z`),
        creneau_debut: new Date(`${demainCle}T08:00:00.000Z`),
        creneau_fin: new Date(`${demainCle}T09:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGTEL — intervention forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: PRETE_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 375 px, aucun défilement horizontal de la page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/planning");

  const [scrollWidth, innerWidth] = await Promise.all([
    page.evaluate(() => document.documentElement.scrollWidth),
    page.evaluate(() => window.innerWidth),
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("à 375 px, « Transmettre demain » et « Intervention » sont côte à côte, pleine largeur, cible ≥ 44 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/planning");

  const transmettre = page.getByRole("button", {
    name: new RegExp(`^${fr["planning.transmettre_demain"]} \\(\\d+\\)$`),
  });
  const creer = page.getByRole("link", { name: fr["planning.creer"] });
  await expect(transmettre).toBeVisible();
  await expect(creer).toBeVisible();

  const [boiteTransmettre, boiteCreer, main] = await Promise.all([
    transmettre.boundingBox(),
    creer.boundingBox(),
    page.locator("main").first().boundingBox(),
  ]);
  expect(boiteTransmettre).not.toBeNull();
  expect(boiteCreer).not.toBeNull();
  expect(main).not.toBeNull();

  // Côte à côte : même ligne (sommets proches), jamais l'un sous l'autre.
  expect(Math.abs(boiteTransmettre!.y - boiteCreer!.y)).toBeLessThanOrEqual(2);
  // Cible tactile.
  expect(boiteTransmettre!.height).toBeGreaterThanOrEqual(44);
  expect(boiteCreer!.height).toBeGreaterThanOrEqual(44);
  // Pleine largeur : les deux boutons, ensemble, couvrent la quasi-totalité
  // de la largeur utile de l'écran (page.tsx:23, `px-5` — 20 px de marge de
  // chaque côté), à l'écart du gardien près (gap-3, 12 px).
  const largeurCombinee = boiteCreer!.width + boiteTransmettre!.width;
  expect(largeurCombinee).toBeGreaterThanOrEqual(main!.width - 12 - 4);
});

test("à 901 px, les boutons de téléphone ne sont plus dans l'arbre d'accessibilité", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  // `getByRole` exclut déjà les éléments `display:none` de l'arbre
  // d'accessibilité (Playwright) — un seul « Intervention » doit rester
  // trouvable, jamais deux (le bloc téléphone et le bloc bureau à la fois).
  await expect(
    page.getByRole("link", { name: fr["planning.creer"] }),
  ).toHaveCount(1);
});

test("à 375 px, les filtres restent visibles, en pile de deux par ligne", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/planning");

  const formulaireFiltres = page.locator('form[method="get"]');
  const technicien = formulaireFiltres.getByLabel(
    fr["intervention.technicien"],
  );
  const priorite = formulaireFiltres.getByLabel(fr["intervention.priorite"]);
  const nature = formulaireFiltres.getByLabel(fr["intervention.type"]);
  await expect(technicien).toBeVisible();
  await expect(priorite).toBeVisible();
  await expect(nature).toBeVisible();

  const [boiteTechnicien, boitePriorite, boiteNature] = await Promise.all([
    technicien.boundingBox(),
    priorite.boundingBox(),
    nature.boundingBox(),
  ]);
  expect(boiteTechnicien).not.toBeNull();
  expect(boitePriorite).not.toBeNull();
  expect(boiteNature).not.toBeNull();

  // Les deux premiers filtres partagent la même ligne (sommets proches)...
  expect(Math.abs(boiteTechnicien!.y - boitePriorite!.y)).toBeLessThanOrEqual(
    2,
  );
  // ...le troisième est rejeté sur la ligne suivante.
  expect(boiteNature!.y).toBeGreaterThan(boiteTechnicien!.y + 10);
});
