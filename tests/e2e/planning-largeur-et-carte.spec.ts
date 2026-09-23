import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import {
  dureeCarteAffichee,
  siteDeLaCarte,
} from "@/app/(back-office)/planning/carte";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, jourDeLaScene, MARDI, SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * PLANNING-2 — LE PLANNING TIENT DANS L'ÉCRAN, ET UNE CARTE DIT OÙ ET COMBIEN
 * DE TEMPS.
 *
 * ## Ce qui a été mesuré le 23/09/2026, avant ce lot
 *
 * `document.documentElement.scrollWidth = 1519` pour `clientWidth = 1265` à
 * 1280 × 900 sur `/planning` : la page entière défilait horizontalement, et
 * jeudi/vendredi étaient coupés. Une carte d'intervention se lisait « SIDAPS /
 * Curatif » — ni le site, ni la durée.
 *
 * ## Ce que ce fichier éprouve
 *
 * Le débordement de la PAGE ENTIÈRE (jamais celui, attendu, de la grille sous
 * son propre `overflow-x-auto`), la colonne « Technicien » qui reste visible
 * pendant que la grille défile, et le contenu enrichi d'une carte — dans la
 * grille (`lg` et plus) et dans la liste qui la remplace en dessous.
 */

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;
let site: { readonly libelle: string };
let dureeObstacle: string;
let dureeChevauchante: string;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const obstacle = await client.intervention.findUniqueOrThrow({
      where: { id: SCENE.obstacle },
      select: {
        creneau_debut: true,
        creneau_fin: true,
        duree_estimee_min: true,
        site: { select: { libelle: true } },
      },
    });
    const chevauchante = await client.intervention.findUniqueOrThrow({
      where: { id: SCENE.chevauchante },
      select: { creneau_debut: true, creneau_fin: true },
    });
    site = obstacle.site;
    dureeObstacle =
      dureeCarteAffichee(
        minutesDuCreneau(obstacle) ?? obstacle.duree_estimee_min ?? 0,
      ) ?? "";
    dureeChevauchante =
      dureeCarteAffichee(minutesDuCreneau(chevauchante) ?? 0) ?? "";
  } finally {
    await client.$disconnect();
  }
});

function minutesDuCreneau(ligne: {
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
}): number | null {
  if (ligne.creneau_debut === null || ligne.creneau_fin === null) {
    return null;
  }
  return Math.round(
    (ligne.creneau_fin.getTime() - ligne.creneau_debut.getTime()) / 60_000,
  );
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function allerALaSemaineDeLaScene(page: Page): Promise<void> {
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();
}

/* ── 1. AUCUN DÉBORDEMENT DE LA PAGE, À QUATRE LARGEURS ──────────────────── */

const LARGEURS = [390, 768, 1280, 1440];

for (const largeur of LARGEURS) {
  test(`vue semaine : la page ne déborde pas horizontalement à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await allerALaSemaineDeLaScene(page);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

test("vue jour : la page ne déborde pas horizontalement à 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, MARDI))}`,
  );
  await expect(page.locator("main")).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

/* ── 2. LA COLONNE « TECHNICIEN » RESTE VISIBLE AU DÉFILEMENT ───────────── */

test("la colonne « Technicien » et les commandes de semaine restent visibles quand la grille défile horizontalement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const entete = page.locator("th", {
    hasText: fr["planning.colonne_technicien"],
  });
  await expect(entete).toBeVisible();
  const avantScroll = await entete.evaluate(
    (e) => e.getBoundingClientRect().left,
  );

  const conteneur = page.locator(".overflow-x-auto").first();
  const scrollReel = await conteneur.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    return element.scrollLeft;
  });
  // Témoin : sans un défilement RÉEL du conteneur, « la position ne bouge
  // pas » serait vrai pour n'importe quelle colonne, sticky ou non.
  expect(scrollReel).toBeGreaterThan(0);

  await expect(entete).toBeVisible();
  const apresScroll = await entete.evaluate(
    (e) => e.getBoundingClientRect().left,
  );
  // Sticky : la position de la colonne ne bouge PAS pendant le défilement.
  expect(apresScroll).toBe(avantScroll);

  // Les commandes de semaine — hors du conteneur qui défile — restent là où
  // elles étaient.
  await expect(
    page.getByRole("link", { name: fr["planning.semaine_avant"] }),
  ).toBeVisible();
});

/* ── 3. UNE CARTE DIT OÙ ET COMBIEN DE TEMPS ─────────────────────────────── */

test("dans la grille (lg+), une carte affiche le site et la durée connue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const carteObstacle = page.locator(`[data-bloc="${SCENE.obstacle}"]`);
  await expect(carteObstacle).toBeVisible();
  await expect(carteObstacle).toContainText(siteDeLaCarte(site));
  await expect(carteObstacle).toContainText(dureeObstacle);

  const carteChevauchante = page.locator(`[data-bloc="${SCENE.chevauchante}"]`);
  await expect(carteChevauchante).toContainText(dureeChevauchante);
});

test("dans la liste téléphone (< lg), une carte affiche le site et la durée connue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await allerALaSemaineDeLaScene(page);

  // `ListeSemaine` ne porte PAS `data-bloc` — délibérément, pour ne jamais
  // rendre une intervention deux fois dans la page (voir le commentaire de
  // `ListeSemaine` dans `page.tsx`). `data-carte-liste` est son propre repère.
  const carteObstacle = page.locator(`[data-carte-liste="${SCENE.obstacle}"]`);
  await expect(carteObstacle).toBeVisible();
  await expect(carteObstacle).toContainText(siteDeLaCarte(site));
  await expect(carteObstacle).toContainText(dureeObstacle);
});
