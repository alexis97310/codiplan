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

/* ── 2. LA COLONNE « TECHNICIEN » RESTE VISIBLE, SANS DÉFILEMENT (82-PLANNING-6) ── */

/**
 * CE TEST A CHANGÉ DE NATURE LE 25/09/2026 (82-PLANNING-6, constats 10/11).
 *
 * Il forçait un défilement RÉEL du conteneur (`scrollLeft = scrollWidth`,
 * avec un témoin `scrollReel > 0` qui aurait fait échouer l'épreuve si le
 * conteneur n'avait rien à défiler) pour prouver que la colonne « Technicien »
 * restait fixe PENDANT ce défilement — le tableau portait alors
 * `min-w-[920px]` dans un conteneur plus étroit (662 px à 1280, mesuré), donc
 * défilait forcément. 82-PLANNING-6 retire ce `min-w` : la grille ne déborde
 * plus à cette largeur, et le témoin ne peut plus être vrai — il n'y a plus
 * rien à défiler pour que `scrollLeft` y prenne appui. La classe `sticky`
 * reste posée dans `page.tsx` comme un plancher de sécurité pour une largeur
 * plus étroite que celle-ci, mais rien ici ne l'exerce plus.
 *
 * L'épreuve vérifie désormais directement ce que 82-PLANNING-6 garantit : le
 * conteneur ne déborde plus, et la colonne « Technicien » est visible sans
 * qu'aucun geste de défilement ne soit nécessaire pour l'obtenir. Voir
 * `tests/e2e/planning-6.spec.ts` pour l'épreuve dédiée à ce lot (le jour
 * courant, le bouton « Aujourd'hui »).
 */
test("la colonne « Technicien » et les commandes de semaine restent visibles, sans qu'un défilement horizontal soit nécessaire", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const entete = page.locator("th", {
    hasText: fr["planning.colonne_technicien"],
  });
  await expect(entete).toBeVisible();

  const conteneur = page.locator(".overflow-x-auto").first();
  const { scrollWidth, clientWidth } = await conteneur.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  // Les commandes de semaine — hors du conteneur — restent là où elles
  // étaient.
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
