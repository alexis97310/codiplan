import { expect, test } from "@playwright/test";

import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D221 — COUVERTURE ÉTENDUE DU GARDE SERVEUR (9G8D-GARDE-TECHNICIEN-PAGES,
 * 25/10/2026). `tests/e2e/9g8-redirection-technicien.spec.ts` éprouvait déjà
 * `/planning` par navigation DURE (`page.goto`) ; ces trois scénarios
 * étendent la même preuve à `/demandes`, `/parc` et `/vgp` — les trois autres
 * destinations que la colonne offre encore au technicien (voir
 * `lib/navigation/entrees.ts`, `CAPACITE_REQUISE`) et que la chaîne 9G8
 * soupçonnait précisément d'être contournables.
 *
 * **Ce que ce fichier NE couvre PAS, et pourquoi** : mesuré le 25/10/2026,
 * un clic (navigation DOUCE, `<Link>`) sur une de ces entrées DANS LA
 * FENÊTRE DE PRÉCHARGEMENT AUTOMATIQUE qui suit le montage de la page
 * continue d'atteindre le contenu interdit, sans qu'aucune requête ne
 * reparte vers le serveur — ni vers `app/(back-office)/template.tsx`
 * (pourtant RECRÉÉ à chaque navigation, voir son en-tête), ni même vers
 * `middleware.ts`. Le cache client du routeur de Next.js rend alors le clic
 * depuis la précharge. `experimental.staleTimes.dynamic = 0` et
 * `prefetch={false}` sur l'entrée de la colonne (`components/navigation/
 * barre.tsx`) ont été essayés et mesurés SANS fermer entièrement ce chemin
 * — une épreuve qui l'affirmerait fermé serait fausse. Voir la passation du
 * lot pour le détail de la mesure et les pistes non closes.
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
