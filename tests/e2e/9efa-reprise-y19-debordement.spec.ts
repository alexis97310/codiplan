import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EFA-REPRISE-9EF-2, Y19 — aucune des deux fiches ne déborde en largeur,
 * à 1280 ni à 375 px.
 *
 * Mesuré par le pilote (captures de 9EF-TP-UX4-2-FICHES-1) : la fiche site
 * débordait à 742 px de large sous une fenêtre de 375 (la grille
 * `1fr_300px` de l'onglet « Aperçu » ne laissait pas sa colonne de gauche
 * rétrécir sous le `minWidth` posé par `Tableau`), et la fiche client à
 * 380 px (la grille des sites de l'onglet « Aperçu » imposait
 * `repeat(2, 1fr)` par un `style` en ligne, qui prime toujours sur la
 * classe Tailwind `max-[900px]:grid-cols-1` censée la remplacer). Corrigé
 * par `aa430a57` (`min-w-0` sur la colonne gauche, `style` en ligne retiré).
 *
 * **Repris par 9EFB** (relecture du pilote) : la version précédente de cette
 * épreuve lisait la scène de DÉMONSTRATION au hasard (`groupBy` sans
 * `orderBy`, `findFirstOrThrow` sans `orderBy`) — non déterministe, et sans
 * garantie que les tableaux larges (`BlocMachines` 720 px, `BlocInterventions`
 * 640 px sur la fiche site ; onglets « Sites » 520 px et « Interventions »
 * 1000 px sur la fiche client) soient seulement rendus. Remplacée par une
 * scène À SOI, préfixée `9EFBY19-`, créée et supprimée par cette épreuve :
 * un client avec un site portant deux machines et deux interventions.
 */

test.describe.configure({ mode: "serial" });

const FENETRE_TELEPHONE = { width: 375, height: 812 };
const FENETRE_BUREAU = { width: 1280, height: 900 };

const CLIENT_Y19 = uuidv7();
const SITE_Y19 = uuidv7();
const MACHINE_Y19_1 = uuidv7();
const MACHINE_Y19_2 = uuidv7();
const INTERVENTION_Y19_1 = uuidv7();
const INTERVENTION_Y19_2 = uuidv7();

const RAISON_SOCIALE_Y19 = "9EFBY19-Client (débordement)";
const LIBELLE_SITE_Y19 = "9EFBY19-Site (débordement)";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_Y19,
        societe_id: reperes.societeId,
        raison_sociale: RAISON_SOCIALE_Y19,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_Y19,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y19,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_Y19,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_Y19_1,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_Y19,
        site_id: SITE_Y19,
        numero_serie: "9EFBY19-SERIE-001",
        qr_token: `9efby19-${uuidv7()}`,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_Y19_2,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_Y19,
        site_id: SITE_Y19,
        numero_serie: "9EFBY19-SERIE-002",
        qr_token: `9efby19-${uuidv7()}`,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_Y19_1,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y19,
        site_id: SITE_Y19,
        agence_id: agence.id,
        type: "curatif",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_Y19_2,
        societe_id: reperes.societeId,
        client_id: CLIENT_Y19,
        site_id: SITE_Y19,
        agence_id: agence.id,
        type: "preventif_contrat",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [INTERVENTION_Y19_1, INTERVENTION_Y19_2] } },
    });
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_Y19_1, MACHINE_Y19_2] } },
    });
    await client.site.deleteMany({ where: { id: SITE_Y19 } });
    await client.client.deleteMany({ where: { id: CLIENT_Y19 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function sansDefilementHorizontal(
  page: import("@playwright/test").Page,
): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

for (const fenetre of [FENETRE_BUREAU, FENETRE_TELEPHONE]) {
  test(`fiche client, aperçu — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/clients/${CLIENT_Y19}`);
    await expect(page.locator("main")).toBeVisible();
    // Témoin : sans aucune date, SEULE la « dernière intervention » du KPI
    // (jamais la « prochaine », qui exige une date future) est garantie —
    // c'est elle qui met la grille de synthèse sous tension. `.first()` :
    // la carte entière est cliquable (`CarteEntite`), donc plusieurs `<a>`
    // partagent le même `href`.
    await expect(
      page.locator(`a[href^="/interventions/${INTERVENTION_Y19_2}"]`).first(),
    ).toBeVisible();
    await sansDefilementHorizontal(page);
  });

  test(`fiche client, onglet Sites — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/clients/${CLIENT_Y19}?onglet=sites`);
    // Témoin : sans le site de la scène, le tableau (minimum 520 px) ne
    // serait jamais rendu, et cette épreuve ne prouverait rien.
    await expect(
      page.locator("a").filter({ hasText: LIBELLE_SITE_Y19 }).first(),
    ).toBeVisible();
    await sansDefilementHorizontal(page);
  });

  test(`fiche client, onglet Interventions — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/clients/${CLIENT_Y19}?onglet=interventions`);
    // Témoin : le tableau (minimum 1000 px) n'est sous tension que si les
    // deux interventions de la scène s'y trouvent.
    const texte = await page.locator("main").innerText();
    expect(texte).toContain(LIBELLE_SITE_Y19);
    await sansDefilementHorizontal(page);
  });

  test(`fiche site, aperçu — aucun défilement horizontal à ${fenetre.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(fenetre);
    await page.goto(`/sites/${SITE_Y19}`);
    // Témoin : sans les deux machines, `BlocMachines` (720 px) ne rend pas de
    // tableau ; sans les deux interventions, `BlocInterventions` (640 px) non
    // plus — et cette épreuve ne prouverait rien sur ces deux grilles.
    await expect(
      page.locator("a").filter({ hasText: "9EFBY19-SERIE-001" }),
    ).toBeVisible();
    await expect(
      page.locator("a").filter({ hasText: "9EFBY19-SERIE-002" }),
    ).toBeVisible();
    // Témoin, le second (BlocInterventions) : les DEUX interventions de la
    // scène y paraissent, et c'est ce qui met la grille sous tension.
    // `.first()` : la « dernière intervention » du site peut en reprendre
    // une au-dessus du tableau, sous le même `href`.
    await expect(
      page.locator(`a[href^="/interventions/${INTERVENTION_Y19_1}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href^="/interventions/${INTERVENTION_Y19_2}"]`).first(),
    ).toBeVisible();
    await sansDefilementHorizontal(page);
  });
}

/**
 * LES CAPTURES APRÈS DE 9EFB, SUR CETTE MÊME SCÈNE — preuve que les deux
 * écrans mesurés débordants par le pilote (1330 px et 380 px, voir l'en-tête
 * de ce fichier) ne le sont plus. Mêmes noms que 9EF-TP-UX4-2-FICHES-1, dans
 * un dossier À SOI (`docs/propositions/9EFB-CORRECTIFS-FICHES-9EFA/
 * captures/`) : les images de 9EF-1 ne sont jamais réécrites par ce fichier.
 */
const CAPTURES_ACTIVES = process.env.CAPTURES_9EFB_Y19 !== undefined;
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EFB-CORRECTIFS-FICHES-9EFA/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (!CAPTURES_ACTIVES) return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("captures — fiche site (1280, 375) et fiche client, aperçu (375), après le correctif Y19", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_Y19}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-site-lecture", 1280);
  await capturer(page, "fiche-site-lecture", 375);

  await page.goto(`/clients/${CLIENT_Y19}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-client-apercu", 375);
});
