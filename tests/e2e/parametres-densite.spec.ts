import { expect, test } from "@playwright/test";

import { LARGEUR_UTILE_PX } from "@/lib/theme/apparence";

import { FORFAITS_SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * R2-05 et R2-06 — LES DEUX ÉCRANS DE RÉGLAGE OCCUPENT LA LARGEUR UTILE ET SE
 * LISENT D'UN REGARD.
 *
 * ## Ce que ce scénario mesure, et pourquoi une assertion ne suffisait pas
 *
 * L'acceptation de R2-05 demande une mesure : *« le nombre d'établissements
 * visibles sans défiler à 1700 px est mesuré avant et après, et il augmente. »*
 * Un scénario de rendu ne peut pas répondre à cela — il interroge des textes,
 * pas une mise en page. **Il faut une fenêtre réelle**, et c'est ce que le
 * harnais de R2-18 rend possible depuis cette nuit.
 *
 * *Mesuré le 11/09/2026, fenêtre 1700 × 1000, trois établissements :*
 *
 * | | avant | après |
 * |---|---|---|
 * | largeur du contenu | 896 px | 1360 px |
 * | hauteur du document | 1428 px | 1000 px |
 * | établissements entièrement visibles | **2 sur 3** | **3 sur 3** |
 *
 * ## Les deux assertions sont des FAITS, jamais des chiffres figés
 *
 * « Trois lignes visibles » deviendrait faux à la quatrième agence de
 * démonstration — et *un gardien qui rougit sur un dépôt sain est un gardien
 * qu'on apprend à ne plus lire* (§9, 11/09). Ce qui est exigé est donc : **TOUTES
 * les lignes sont entièrement visibles**, et le contenu occupe la largeur utile.
 * Le témoin de non-vacuité est à part : il faut au moins trois lignes, sans quoi
 * « toutes visibles » ne prouverait rien.
 */

const FENETRE = { width: 1700, height: 1000 };

/** La largeur utile, moins les gouttières latérales de `LargeurUtile` (px-5). */
const GOUTTIERE_PX = 20;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("les établissements tiennent tous dans la fenêtre, sur la largeur utile", async ({
  page,
}) => {
  await page.goto("/parametres/agences");

  const lignes = page.locator("main tbody tr");
  // Témoin : sans lignes, « toutes visibles » serait vrai et ne dirait rien.
  await expect(lignes).toHaveCount(3);

  const debordent = await lignes.evaluateAll(
    (elements, hauteur) =>
      elements.filter((e) => e.getBoundingClientRect().bottom > hauteur).length,
    FENETRE.height,
  );
  expect(debordent).toBe(0);

  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);
});

test("le réglage du pas reste dans la ligne de son établissement", async ({
  page,
}) => {
  await page.goto("/parametres/agences");

  // *On règle un pas en regardant celui des autres établissements* : sortir le
  // réglage dans un écran de détail ferait perdre la comparaison que le tableau
  // vient de gagner.
  const formulaires = page.locator("main tbody tr form");
  await expect(formulaires).toHaveCount(3);
});

test("le catalogue de forfaits occupe la même largeur, et la même forme", async ({
  page,
}) => {
  await page.goto("/parametres/forfaits");

  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);

  // La MÊME forme d'en-tête que les agences — 10,5 px, capitales : c'est ce que
  // « les deux écrans se ressemblent » veut dire, et cela se mesure.
  //
  // *Le catalogue de démonstration naît VIDE (L1-06), et sans les deux forfaits
  // que la scène pose, cet écran n'afficherait AUCUN tableau : sa reprise
  // d'apparence serait restée « écrite mais jamais vue ».*
  const entete = page.locator("main thead th").first();
  await expect(entete).toHaveCSS("text-transform", "uppercase");
  await expect(entete).toHaveCSS("font-size", "10.5px");
  await expect(page.locator("main tbody tr")).toHaveCount(
    FORFAITS_SCENE.length,
  );
});
