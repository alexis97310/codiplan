import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LE TERRAIN TIENT SUR UN TÉLÉPHONE — 390 px, PAS 272 px DE CHROME AVANT LE
 * CONTENU (revue de #224, 17/09/2026).
 *
 * ## Ce que #224 a laissé passer, et pourquoi ce gardien existe
 *
 * La colonne latérale de D121 est une réponse aux QUATORZE destinations du
 * back-office. `ENTREES_TERRAIN` est vide (R5-01) : lui donner la même
 * colonne, c'est dépenser 272 px de chrome pour une marque et un bouton de
 * déconnexion, sur un écran qui n'en offre que 390. **Mesuré sur `main` AVANT
 * ce correctif** (`app/(mobile)/layout.tsx` en `flex`, `BarreDeNavigation` en
 * colonne quelle que soit la liste) : 156 px pour tout l'écran de la journée
 * d'un technicien — moins que le calcul théorique (390 moins 272), la mise en
 * page flexible cédant un peu de largeur au contenu, mais radicalement moins
 * que ce que l'écran offre. Après (le terrain reprend son chrome D'AVANT
 * D121, un bandeau horizontal) : 358 px, dérivé ci-dessous et non constaté
 * sur un succès.
 *
 * ## Le calcul, pas un nombre constaté
 *
 * `app/(mobile)/layout.tsx` pose `<div class="mx-auto w-full max-w-[720px]
 * px-4 py-4">` — aucune colonne latérale ne lui dispute plus la largeur.
 * `px-4` vaut 16 px de chaque côté (Tailwind, `1rem` à `16px` la base) :
 * `LARGEUR_UTILE_TERRAIN_PX = 390 − 2 × 16 = 358`.
 */
const FENETRE = { width: 390, height: 844 };
const GOUTTIERE_TERRAIN_PX = 16;
const LARGEUR_UTILE_TERRAIN_PX = FENETRE.width - 2 * GOUTTIERE_TERRAIN_PX;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Retouché par 99A-ARRIVEE : ce compte n'a qu'UNE société, donc `/arrivee`
  // redirige d'emblée au terrain plutôt que de s'y arrêter.
  await expect(page).toHaveURL(/\/terrain$/);
});

test("le contenu du terrain occupe la largeur du téléphone, pas ce qu'une colonne lui laisse", async ({
  page,
}) => {
  await page.goto("/terrain");

  // Voir `ecrans-largeur-utile.spec.ts` : attendre la révélation du flux
  // avant de mesurer un rectangle, sous peine de mesurer un conteneur caché
  // de largeur nulle (#220).
  await expect(page.locator("main")).toBeVisible();

  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_TERRAIN_PX);

  // LE TÉMOIN QUI AURAIT DÛ ROUGIR : mesuré à 156 px avant ce correctif, avec
  // une colonne de 272 px sur cette même fenêtre — très en dessous de la
  // largeur utile attendue. Une régression future qui redonnerait au terrain
  // une colonne latérale ferait tomber l'assertion ci-dessus avant
  // celle-ci ; le seuil est posé entre les deux valeurs mesurées, jamais sur
  // la seule qui doit rester vraie.
  expect(largeur).toBeGreaterThan(250);
});

test("aucune colonne latérale n'est rendue sur le terrain", async ({
  page,
}) => {
  await page.goto("/terrain");
  // Le chrome du terrain est un `<header>` de niveau racine (rôle
  // « banner »), jamais un `<aside>` — c'est ce changement de balise, pas une
  // classe, qui distingue les deux formes. La page elle-même porte SON PROPRE
  // `<header>` de titre, imbriqué dans `<main>` : il ne porte pas ce rôle
  // (HTML-ARIA ne l'accorde qu'à un `<header>` hors sectionnement), donc ne
  // fausse pas ce témoin.
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(1);
});
