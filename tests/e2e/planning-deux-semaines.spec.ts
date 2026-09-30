import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import {
  cleJour,
  instantAMinutes,
  instantDuJour,
  jourSuivant,
} from "@/lib/calendar/fuseau";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-D2-DEUX-SEMAINES (9CI-PG-G12-DEUX-SEMAINES-MOIS) — LA VUE « 2 SEMAINES ».
 *
 * *Sa propre scène*, préfixée `PGD2-` — un client et un site forgés par ce
 * fichier, une intervention posée sur le technicien DUCOS de la scène de
 * démonstration (`reperesDeLaScene`), jamais sur une fixture `SCENE.*`
 * mutée. Une semaine FUTURE (semaine +1/+2 depuis aujourd'hui), pour ne
 * jamais recouvrir ce qu'une autre épreuve compte sur la semaine courante.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "PGD2-";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function creerScene(parametres: {
  readonly societeId: string;
  readonly technicienId: string;
  readonly fuseau: string;
  readonly jour: ReturnType<typeof jourSuivant>;
}): Promise<{
  readonly interventionId: string;
  readonly clientId: string;
  readonly siteId: string;
}> {
  const interventionId = uuidv7();
  const clientId = uuidv7();
  const siteId = uuidv7();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: parametres.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: clientId,
        societe_id: parametres.societeId,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: parametres.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: `${PREFIXE}Site`,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: parametres.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: parametres.technicienId,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: instantDuJour(parametres.jour),
        creneau_debut: instantAMinutes(parametres.jour, 480, parametres.fuseau),
        creneau_fin: instantAMinutes(parametres.jour, 570, parametres.fuseau),
        duree_estimee_min: 90,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    return { interventionId, clientId, siteId };
  } finally {
    await client.$disconnect();
  }
}

async function nettoyer(scene: {
  readonly interventionId: string;
  readonly siteId: string;
  readonly clientId: string;
}): Promise<void> {
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
}

/** L'index de la ligne d'un technicien dans le tableau de la grille visible. */
async function indexDeLaLigneTechnicien(
  page: Page,
  technicienId: string,
): Promise<number> {
  const lignes = page.locator("[data-conteneur-tableau-semaine] tbody tr");
  const total = await lignes.count();
  for (let i = 0; i < total; i++) {
    const cellule = lignes
      .nth(i)
      .locator(`[data-depot-technicien="${technicienId}"]`);
    if ((await cellule.count()) > 0) {
      return i;
    }
  }
  return -1;
}

let scene: Awaited<ReturnType<typeof creerScene>>;
let lundiPlus1: ReturnType<typeof jourSuivant>;
let lundiPlus2: ReturnType<typeof jourSuivant>;
let jourIntervention: ReturnType<typeof jourSuivant>;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienId = reperes.technicienDucos;
  lundiPlus1 = jourSuivant(reperes.lundi, 7);
  lundiPlus2 = jourSuivant(reperes.lundi, 14);

  // LE PREMIER JOUR OUVERT DE LA SEMAINE +2, LU SUR LE VRAI CALENDRIER DE
  // L'AGENCE — jamais supposé (même oracle que `planning-filtres-
  // aujourdhui.spec.ts`) : `prochainJourOuvert` est la même fonction pure
  // que la page appelle pour son propre bouton « Aujourd'hui ».
  const client = admin();
  let calendrier: Calendrier | null;
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    calendrier = await chargerCalendrierAgence(client, {
      societeId: reperes.societeId,
      agenceId: agence.id,
      fenetre: { du: lundiPlus2, au: jourSuivant(lundiPlus2, 14) },
    });
  } finally {
    await client.$disconnect();
  }
  jourIntervention = prochainJourOuvert(
    calendrier === null ? [] : [calendrier],
    lundiPlus2,
  );

  scene = await creerScene({
    societeId: reperes.societeId,
    technicienId,
    fuseau: reperes.fuseau,
    jour: jourIntervention,
  });
});

test.afterAll(async () => {
  await nettoyer(scene);
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("12 en-têtes de jour, dans l'ordre, les deux lundis compris — et les techniciens dans le même ordre que la Semaine", async ({
  page,
}) => {
  await page.goto(`/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`);
  await expect(page.locator("main")).toBeVisible();

  const entetes = page.locator("[data-conteneur-tableau-semaine] thead th");
  // 1 colonne « Technicien » + 12 jours.
  await expect(entetes).toHaveCount(13);
  const textes = await entetes.allTextContents();
  await expect(textes[1]).toContain(String(lundiPlus1.jour));
  // Le second lundi commence la seconde semaine, en 7ᵉ colonne de jour.
  await expect(textes[7]).toContain(String(lundiPlus2.jour));

  const indexDeuxSemaines = await indexDeLaLigneTechnicien(page, technicienId);
  expect(indexDeuxSemaines).toBeGreaterThanOrEqual(0);

  await page.goto(`/planning?vue=semaine&semaine=${cleJour(lundiPlus1)}`);
  const indexSemaine = await indexDeLaLigneTechnicien(page, technicienId);
  expect(indexSemaine).toBe(indexDeuxSemaines);
});

test("la carte est dans la bonne case, et son texte commence par l'heure de DÉBUT suivie du client", async ({
  page,
}) => {
  await page.goto(`/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`);
  await expect(page.locator("main")).toBeVisible();

  const cellule = page.locator(
    `[data-depot-jour="${cleJour(jourIntervention)}"][data-depot-technicien="${technicienId}"]`,
  );
  await expect(cellule).toBeVisible();
  const carte = cellule.locator(
    `a[data-tiroir-declencheur="${scene.interventionId}"]`,
  );
  await expect(carte).toBeVisible();
  const texte = (await carte.innerText()).trim();
  expect(texte.startsWith(`08:00 ${PREFIXE}Client`)).toBe(true);
  expect(texte).not.toContain("09:30");
});

test("le clic ouvre le tiroir sans perdre la vue ni la période", async ({
  page,
}) => {
  await page.goto(`/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`);
  // SCOPÉ À LA GRILLE (desktop) : `ListeSemaine`, sous `lg`, porte la MÊME
  // carte (même `data-tiroir-declencheur`) dans le DOM en même temps qu'elle,
  // simplement masquée par CSS — un sélecteur non scopé trouve les deux.
  const carte = page.locator(
    `[data-conteneur-tableau-semaine] a[data-tiroir-declencheur="${scene.interventionId}"]`,
  );
  await carte.click();

  await expect(page).toHaveURL(
    new RegExp(`vue=deux_semaines.*intervention=${scene.interventionId}`),
  );
  await expect(page).toHaveURL(new RegExp(`semaine=${cleJour(lundiPlus1)}`));
  await expect(
    page.locator(`[data-tiroir-ouvert="${scene.interventionId}"]`),
  ).toBeVisible();
});

test("« suivant »/« précédent » se déplacent de 14 jours, et l'onglet « 2 semaines » est actif", async ({
  page,
}) => {
  await page.goto(`/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`);

  // SCOPÉ AUX ONGLETS DU PLANNING : la barre latérale porte elle aussi un
  // lien `aria-current="page"` (« Planning »), sans rapport avec la vue.
  const onglet = page.locator(
    '[data-maquette-bloc="selecteur-semaine-jour"] [aria-current="page"]',
  );
  await expect(onglet).toBeVisible();
  await expect(onglet).toHaveText(fr["planning.vue_deux_semaines"]);

  await page.getByRole("link", { name: /2 semaines suivantes/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`semaine=${cleJour(jourSuivant(lundiPlus1, 14))}`),
  );

  await page.goto(`/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`);
  await page.getByRole("link", { name: /2 semaines précédentes/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`semaine=${cleJour(jourSuivant(lundiPlus1, -14))}`),
  );
});
