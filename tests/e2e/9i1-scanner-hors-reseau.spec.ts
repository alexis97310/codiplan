import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9I1-SCANNER-HORS-RESEAU — hors réseau, « Scanner » ne mène plus à l'écran
 * d'erreur du navigateur (décision A d'Alexis, 28/10/2026, question 4 de
 * l'audit du 28/10/2026).
 *
 * ## CE QUI A ÉTÉ MESURÉ ROUGE SUR `origin/main`, AVANT CE LOT
 *
 * Technicien connecté, service worker actif, réseau coupé
 * (`context.setOffline(true)`) depuis `/terrain` : un clic sur le lien
 * `href="/scanner"` atterrissait sur `chrome-error://chromewebdata/` —
 * `public/sw.js` ne reconnaissait `/scanner` dans AUCUNE de ses trois
 * catégories (statique, coquille, repli), son gestionnaire `fetch` rendait
 * donc la main sans appeler `respondWith`, et c'est le NAVIGATEUR qui a
 * ensuite tenté — et échoué — la navigation lui-même. Mesuré en direct par
 * ce lot (passation) avant d'écrire `estRepliScanner`.
 *
 * ## LA MÊME LIMITE QUE 9F4H1, RETROUVÉE ICI PAR LA MÊME MESURE
 *
 * Une fois `/scanner` reconnu par `estRepliScanner`, le service worker
 * appelle `respondWith(fetch(requete)…)` : c'est désormais LUI qui exécute le
 * `fetch`, depuis son propre contexte, et non plus le navigateur pour son
 * compte. **Mesuré ici, comme documenté par `tests/e2e/offline/
 * 9f4h1-consultation.spec.ts` pour `/terrain`** : ce `fetch`-là n'est affecté
 * NI par `context.setOffline`, NI par `context.route` — il aboutit contre le
 * vrai serveur de l'épreuve, qui répond normalement puisqu'il tourne
 * réellement. Il est donc IMPOSSIBLE de forcer ICI, par Playwright, la
 * branche `.catch()` qui sert `/scanner-hors-reseau` en repli. Ce que ce
 * fichier mesure à la place, sans dépendre de ce blocage :
 *
 * 1. **Le fait qui a changé** : la navigation hors réseau n'atterrit plus
 *    JAMAIS sur l'écran d'erreur du navigateur — avant, c'était systématique ;
 *    maintenant, `estRepliScanner` répond toujours (soit par le réseau qui
 *    aboutit malgré l'émulation, soit par la coquille le jour où le réseau
 *    échoue réellement, hors de la portée de ce harnais).
 * 2. **Le contenu de la coquille elle-même**, par navigation DIRECTE (sans
 *    émulation réseau, donc sans dépendre de la limite ci-dessus) : le
 *    message de la décision d'Alexis, et le lien de retour.
 * 3. **La présence de `/scanner-hors-reseau` dans la COQUILLE préchargée**,
 *    éprouvée par `tests/e2e/offline/socle-pwa.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I1-SCANNER-HORS-RESEAU/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function connecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("hors réseau, le lien « Scanner » depuis /terrain n'atterrit plus sur l'écran d'erreur du navigateur", async ({
  page,
  context,
}) => {
  await connecterTechnicien(page);

  // LE SERVICE WORKER DOIT ÊTRE ACTIF avant de couper le réseau — sinon la
  // coquille qu'il sert n'a jamais été installée.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.getByRole("link", { name: fr["terrain.action.scanner"] }).click();

  // LE FAIT MESURÉ : plus jamais `chrome-error://` — voir le docblock pour
  // la limite qui empêche de forcer ici la branche de repli elle-même.
  await expect(async () => {
    expect(page.url()).not.toContain("chrome-error");
  }).toPass({ timeout: 5_000 });

  await context.setOffline(false);
});

test("hors réseau, une navigation directe vers /parc/scanner n'atterrit plus sur l'écran d'erreur du navigateur", async ({
  page,
  context,
}) => {
  // AUCUNE SESSION ICI : le repli du service worker intercepte la
  // NAVIGATION avant que la moindre vérification applicative n'ait lieu —
  // c'est tout l'intérêt du repli, et pourquoi il ne regarde jamais qui
  // demande la page.
  await page.goto("/sante");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.goto("/parc/scanner").catch(() => null);

  await expect(async () => {
    expect(page.url()).not.toContain("chrome-error");
  }).toPass({ timeout: 5_000 });

  await context.setOffline(false);
});

test("la coquille `/scanner-hors-reseau` dit, par un lien direct, que le scan est indisponible", async ({
  page,
}) => {
  // UNE SESSION ACTIVE, SANS QUE LA PAGE NE LA LISE — seulement pour que le
  // lien de retour aboutisse à une `/terrain` authentifiée plutôt qu'à
  // `/connexion` : la coquille elle-même reste publique (voir son docblock).
  await connecterTechnicien(page);

  // ATTEINTE PAR LIEN DIRECT, SANS ÉMULATION RÉSEAU — ce que le repli du
  // service worker ne peut pas montrer ici (voir le docblock), cette
  // navigation directe le montre sans aucune limite : c'est la PAGE ELLE-
  // MÊME qui est éprouvée, publique et identique pour tout le monde.
  await page.goto("/scanner-hors-reseau");

  await expect(
    page.getByRole("heading", { name: fr["scanner.hors_reseau.titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["scanner.hors_reseau.message"])).toBeVisible();

  await capturer(page, "scanner-hors-reseau", 375);
  await capturer(page, "scanner-hors-reseau", 1280);

  await page.getByRole("link", { name: fr["terrain.retour"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
});
