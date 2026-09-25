import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { cleDeJour } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 82-PLANNING-6 — LA SEMAINE ENTIÈRE ET LE JOUR COURANT VISIBLES À 1280 ET
 * 1440 PX, SANS DÉFILEMENT.
 *
 * ## Ce qui a été mesuré le 25/09/2026 (audit, constats 10 et 11, « Bloquant »)
 *
 * Le tableau de la vue SEMAINE portait `min-w-[920px]` dans un conteneur de
 * 805 px (mesure de production) — 662 px et 822 px, mesurés dans ce dépôt à
 * 1280 et 1440 px, menu latéral ouvert : vendredi et samedi restaient hors
 * cadre aux deux largeurs, sans le moindre indice de défilement. Aucune
 * colonne ne distinguait le jour courant, et rien ne ramenait à la semaine
 * d'aujourd'hui depuis une autre semaine.
 *
 * ## Ce que ce fichier éprouve
 *
 * Aucune donnée n'est créée : ces trois épreuves ne lisent que la STRUCTURE
 * de l'écran (largeur du conteneur, position de l'en-tête, présence d'un
 * lien), jamais le contenu du semis.
 */

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function allerALaSemaineCourante(page: Page): Promise<void> {
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();
}

const LARGEURS = [
  { largeur: 1280, hauteur: 800 },
  { largeur: 1440, hauteur: 900 },
];

for (const { largeur, hauteur } of LARGEURS) {
  test(`vue semaine : tous les jours tiennent dans le conteneur du tableau, sans défilement, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await allerALaSemaineCourante(page);

    const conteneur = page.locator("[data-conteneur-tableau-semaine]");
    await expect(conteneur).toBeVisible();
    const { scrollWidth, clientWidth } = await conteneur.evaluate(
      (element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }),
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // ── LE JOUR COURANT EST DÉSIGNÉ, ET SON EN-TÊTE EST VISIBLE EN ENTIER ──
    const entete = page.locator("[data-aujourdhui]");
    await expect(entete).toBeVisible();
    const boite = await entete.boundingBox();
    expect(boite).not.toBeNull();
    if (boite !== null) {
      expect(boite.x).toBeGreaterThanOrEqual(0);
      expect(boite.y).toBeGreaterThanOrEqual(0);
      expect(boite.x + boite.width).toBeLessThanOrEqual(largeur + 1);
      expect(boite.y + boite.height).toBeLessThanOrEqual(hauteur + 1);
    }
  });
}

test("« Aujourd’hui » ramène à la semaine courante depuis la semaine suivante, et n'apparaît pas sur la semaine courante", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await allerALaSemaineCourante(page);

  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"] }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: fr["planning.semaine_apres"] }).click();
  await expect(page.locator("main")).toBeVisible();

  const bouton = page.getByRole("link", { name: fr["planning.aujourdhui"] });
  await expect(bouton).toBeVisible();
  await bouton.click();

  await expect(page).toHaveURL(
    new RegExp(`semaine=${cleDeJour(reperes.lundi)}`),
  );
  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"] }),
  ).toHaveCount(0);
});
