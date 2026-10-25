import { expect, test } from "@playwright/test";

import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D221 — COUVERTURE ÉTENDUE DU GARDE SERVEUR (9G8D-GARDE-TECHNICIEN-PAGES,
 * 25/10/2026). `tests/e2e/9g8-redirection-technicien.spec.ts` éprouvait déjà
 * `/planning` par navigation DURE (`page.goto`) ; ces trois scénarios
 * étendent la même preuve à `/demandes`, `/parc` et `/vgp` — trois
 * destinations que la chaîne 9G8 soupçonnait précisément d'être
 * contournables.
 *
 * **RENOMMÉ (9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU, revue de 9G8D)** — ce
 * fichier s'appelait `9g8d-garde-navigation-douce.spec.ts` sans jamais faire
 * une seule navigation douce (`page.goto` partout, jamais un clic) : le nom
 * mentait sur ce qu'il mesure. La navigation DOUCE réelle — un clic, pendant
 * la fenêtre de préchargement, qui restait un chemin ouvert à la sortie de
 * 9G8D — est désormais éprouvée par `tests/e2e/9g8e-garde-navigation-douce.spec.ts`,
 * fermée cette fois en retirant les liens eux-mêmes plutôt qu'en continuant
 * de chasser le cache du routeur.
 */
for (const cible of ["/demandes", "/parc", "/vgp"]) {
  test(`technicien — navigation DURE vers ${cible} renvoie à /terrain`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(cible);
    await expect(page).toHaveURL(/\/terrain$/);
  });
}
