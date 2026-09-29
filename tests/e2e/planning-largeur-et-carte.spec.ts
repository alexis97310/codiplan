import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import {
  dureeCarteAffichee,
  siteDeLaCarte,
  TIRET_CRENEAU,
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
 * jeudi/vendredi étaient coupés. Une carte d'intervention se lisait « CLIENT /
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
let site: { readonly libelle: string; readonly commune: string | null };
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
        site: { select: { libelle: true, commune: true } },
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

/* ── 2. LA COLONNE « TECHNICIEN » RESTE VISIBLE PENDANT LE DÉFILEMENT (QG-1) ── */

/**
 * CE TEST A CHANGÉ DE NATURE UNE SECONDE FOIS LE 28/09/2026
 * (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026) — REVIENT sur
 * 82-PLANNING-6 (25/09/2026, constats 10/11), qui avait lui-même retiré le
 * défilement pour que la grille tienne sans lui.
 *
 * QG-1 arbitre l'inverse : une colonne de jour de 150 px minimum, quitte à
 * défiler — 79 px de colonne (mesure de l'audit du 27/09/2026, I-2) rendait
 * une carte illisible. Ce test vérifie donc désormais ce que QG-1 garantit :
 * la colonne « Technicien » reste `sticky` et VISIBLE alors que la grille,
 * elle, DÉBORDE et défile — l'inverse exact de ce qu'il vérifiait avant.
 * Voir `tests/e2e/planning-6.spec.ts` pour l'épreuve dédiée au jour courant
 * et au bouton « Aujourd'hui », également adaptée par ce même ticket.
 */
test("la colonne « Technicien » reste visible pendant que la grille défile, à 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const entete = page.locator("th", {
    hasText: fr["planning.colonne_technicien"],
  });
  await expect(entete).toBeVisible();

  const conteneur = page.locator(
    "[data-conteneur-tableau-semaine] .overflow-x-auto",
  );
  const { scrollWidth, clientWidth } = await conteneur.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  // SIX colonnes de jour à 150 px minimum, PLUS la colonne technicien
  // (170 px) : 1070 px au plancher, au-delà du conteneur disponible à
  // 1280 px (menu latéral + file d'attente déjà posés) — la grille DÉBORDE,
  // et c'est ce que QG-1 demande.
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  await expect(conteneur).toHaveAttribute("data-defile-droite", "");

  // Les commandes de semaine — hors du conteneur — restent là où elles
  // étaient.
  await expect(
    page.getByRole("link", { name: fr["planning.semaine_avant"] }),
  ).toBeVisible();
});

/**
 * LES COLONNES DE JOUR (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026,
 * point 4 du ticket) — 150 px minimum pour un jour OUVERT, 36 px pour un
 * jour FERMÉ (férié ou pont sur un jour ordinairement travaillé). Cette scène
 * n'en force aucun : au moins une colonne ouverte suffit à mesurer le
 * plancher, et une colonne fermée ne se produit que certaines semaines — le
 * test s'adapte à ce qu'il trouve plutôt que d'exiger un férié qui n'est pas
 * du ressort de ce fichier (voir `PG-A1-FERIES-GRILLE` pour ce cas).
 */
test("vue semaine : chaque colonne de jour ouvert mesure au moins 150px à 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const entetes = page.locator(
    "[data-conteneur-tableau-semaine] thead th:not(:first-child)",
  );
  const nombre = await entetes.count();
  expect(nombre).toBeGreaterThan(0);
  for (let index = 0; index < nombre; index += 1) {
    const entete = entetes.nth(index);
    const boite = await entete.boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) continue;
    const ferme = (await entete.getAttribute("data-jour-ferie")) !== null;
    expect(boite.width).toBeGreaterThanOrEqual(ferme ? 36 : 150);
  }
});

test("vue semaine : la page ne déborde pas horizontalement à 375px malgré les colonnes de 150px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
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

/* ── 4. LA CARTE NORMALISÉE (PG-C3-CARTES-COLONNES, décision QG-1) ───────── */

test("dans la grille, une carte affiche l'heure de fin quand elle est connue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const carteObstacle = page.locator(`[data-bloc="${SCENE.obstacle}"]`);
  await expect(carteObstacle).toBeVisible();
  // « heure–fin » (`creneauDeLaCarte`, `carte.ts`) : le tiret cadratin sépare
  // les deux heures, jamais la seule heure de début qu'affichait la carte
  // avant ce ticket.
  await expect(carteObstacle).toContainText(TIRET_CRENEAU);
});

/* ── 5. « PLEIN ÉCRAN » REPLIE LA COLONNE « À PLANIFIER » (décision QG-1) ── */

test("« Plein écran » replie la colonne « À planifier », et Échap la rend", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const carteAAffecter = page.locator(
    '[data-maquette-bloc="carte-a-affecter"]',
  );
  await expect(carteAAffecter).toBeVisible();

  const bouton = page.getByRole("link", {
    name: fr["planning.plein_ecran"],
  });
  await bouton.click();
  await expect(page.locator("main")).toBeVisible();
  await expect(carteAAffecter).toHaveCount(0);
  await expect(page).toHaveURL(/pleinEcran=1/);

  await page.keyboard.press("Escape");
  await expect(carteAAffecter).toBeVisible();
  await expect(page).not.toHaveURL(/pleinEcran=1/);
});

/**
 * 9BJA-REPRISE-9BJ, POINT 4a — « Plein écran » replie AUSSI la barre de
 * navigation globale. 9BJ (PG-C3) avait délibérément laissé cette barre hors
 * territoire (chrome PARTAGÉ par tout le back-office) ; ce ticket l'étend au
 * SEUL composant qui la porte, `components/navigation/barre.tsx`.
 */
test("« Plein écran » replie aussi la barre de navigation globale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await allerALaSemaineDeLaScene(page);

  const colonneNavigation = page.locator("#colonne-navigation");
  await expect(colonneNavigation).toBeVisible();

  const bouton = page.getByRole("link", {
    name: fr["planning.plein_ecran"],
  });
  await bouton.click();
  await expect(page.locator("main")).toBeVisible();
  await expect(colonneNavigation).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(colonneNavigation).toBeVisible();
});
