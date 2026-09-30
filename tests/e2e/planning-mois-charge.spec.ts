import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import {
  cleJour,
  instantAMinutes,
  instantDuJour,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { estJourOuvre, type Calendrier } from "@/lib/calendar";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-D3-MOIS-CHARGE (9CI-PG-G12-DEUX-SEMAINES-MOIS) — LA VUE « MOIS ».
 *
 * *Sa propre scène*, préfixée `PGD3-` — même régime que
 * `planning-deux-semaines.spec.ts` (partie 1, 0.b) : un client et un site
 * forgés par ce fichier, une intervention posée sur le technicien DUCOS de la
 * scène de démonstration (`reperesDeLaScene`), jamais sur une fixture
 * `SCENE.*`. Un MOIS FUTUR — celui qui suit le mois de la semaine +1 — pour
 * ne jamais recouvrir ce qu'une autre épreuve compte sur le mois courant.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "PGD3-";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let premierDuMois: JourLocal;
let jourIntervention: JourLocal;
let nombreDeJoursDuMois: number;
let technicienId: string;
let scene: { interventionId: string; clientId: string; siteId: string };

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienId = reperes.technicienDucos;
  const lundiPlus1 = jourSuivant(reperes.lundi, 7);
  // Le mois suivant celui de la semaine +1 — un mois entier dans le futur.
  const moisSuivant = new Date(Date.UTC(lundiPlus1.annee, lundiPlus1.mois, 1));
  premierDuMois = {
    annee: moisSuivant.getUTCFullYear(),
    mois: moisSuivant.getUTCMonth() + 1,
    jour: 1,
  };
  nombreDeJoursDuMois = new Date(
    Date.UTC(premierDuMois.annee, premierDuMois.mois, 0),
  ).getUTCDate();

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const calendrier: Calendrier | null = await chargerCalendrierAgence(
      client,
      {
        societeId: reperes.societeId,
        agenceId: agence.id,
        fenetre: {
          du: premierDuMois,
          au: jourSuivant(premierDuMois, nombreDeJoursDuMois),
        },
      },
    );
    // LE PREMIER JOUR OUVERT DU MOIS — jamais supposé (`estJourOuvre`).
    let candidat = premierDuMois;
    while (calendrier === null || !estJourOuvre(calendrier, candidat)) {
      candidat = jourSuivant(candidat, 1);
    }
    jourIntervention = candidat;

    const interventionId = uuidv7();
    const clientId = uuidv7();
    const siteId = uuidv7();
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: `${PREFIXE}Site`,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: instantDuJour(jourIntervention),
        creneau_debut: instantAMinutes(jourIntervention, 480, reperes.fuseau),
        creneau_fin: instantAMinutes(jourIntervention, 570, reperes.fuseau),
        duree_estimee_min: 90,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    scene = { interventionId, clientId, siteId };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("autant de colonnes que de jours du mois, la case PGD3- porte « 1 »", async ({
  page,
}) => {
  await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);
  await expect(page.locator("main")).toBeVisible();

  const colonnesDeJour = page.locator("[data-mois-jour]");
  const jours = new Set(
    await colonnesDeJour.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("data-mois-jour")),
    ),
  );
  expect(jours.size).toBe(nombreDeJoursDuMois);

  const cellule = page.locator(
    `[data-mois-jour="${cleJour(jourIntervention)}"][data-mois-technicien="${technicienId}"]`,
  );
  await expect(cellule).toBeVisible();
  // Une seule intervention forgée sur cette case : le chiffre attendu est
  // dérivé de la scène, jamais une chaîne visible recopiée (L0-11).
  await expect(cellule).toContainText(String(1));
});

test("un jour fermé pour toutes les agences porte la trame", async ({
  page,
}) => {
  await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.locator("[data-mois-jour].trame-fermee, [data-mois-jour-ferme]"),
  ).not.toHaveCount(0);
});

test("clic sur la case → vue Jour de ce jour", async ({ page }) => {
  await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);
  const cellule = page.locator(
    `[data-mois-jour="${cleJour(jourIntervention)}"][data-mois-technicien="${technicienId}"]`,
  );
  await cellule.click();
  await expect(page).toHaveURL(
    new RegExp(`vue=jour&jour=${cleJour(jourIntervention)}`),
  );
});

test("« suivant »/« précédent » changent de mois, l'onglet « Mois » est actif", async ({
  page,
}) => {
  await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);

  const onglet = page.locator(
    '[data-maquette-bloc="selecteur-semaine-jour"] [aria-current="page"]',
  );
  await expect(onglet).toBeVisible();
  await expect(onglet).toHaveText(fr["planning.vue_mois"]);

  const moisSuivant = new Date(
    Date.UTC(premierDuMois.annee, premierDuMois.mois, 1),
  );
  await page.getByRole("link", { name: /mois suivant/i }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `jour=${moisSuivant.getUTCFullYear()}-${String(moisSuivant.getUTCMonth() + 1).padStart(2, "0")}-01`,
    ),
  );

  await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);
  const moisPrecedent = new Date(
    Date.UTC(premierDuMois.annee, premierDuMois.mois - 2, 1),
  );
  await page.getByRole("link", { name: /mois précédent/i }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `jour=${moisPrecedent.getUTCFullYear()}-${String(moisPrecedent.getUTCMonth() + 1).padStart(2, "0")}-01`,
    ),
  );
});
