import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

/**
 * 9L08-EN-TETES-SECURITE — les en-têtes de sécurité HTTP sont posés sur
 * CHAQUE famille de réponse (décision d'Alexis du 10/11/2026).
 *
 * Avant ce lot, mesuré sur `81894e0` : ni `next.config.ts`, ni
 * `vercel.json`, ni `middleware.ts` n'en posait aucun — une page comme une
 * API répondait sans `Content-Security-Policy`, sans `X-Frame-Options`, et
 * le jeton de `/premier-acces` voyageait dans l'URL sans que
 * `Referrer-Policy` l'empêche de fuiter par un en-tête `Referer`.
 */

const ENTETES_COMMUNES = {
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "permissions-policy": "camera=(self), microphone=(), geolocation=()",
} as const;

function attendreLesEntetesCommunes(entetes: Record<string, string>): void {
  for (const [nom, valeur] of Object.entries(ENTETES_COMMUNES)) {
    expect(entetes[nom]).toBe(valeur);
  }
  expect(entetes["content-security-policy"]).toContain("default-src 'self'");
  // `'self'` (9L54A) : jamais `'none'` (bloquerait le préchargement
  // `/terrain-hors-reseau` de `copie-locale.tsx`), jamais `*` (ouvrirait
  // l'encadrement à un site tiers — la protection contre le détournement de
  // clic doit rester entière).
  expect(entetes["content-security-policy"]).toContain(
    "frame-ancestors 'self'",
  );
  expect(entetes["content-security-policy"]).not.toContain(
    "frame-ancestors *",
  );
}

async function connecterBureau(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

async function connecterTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("une page du bureau porte les en-têtes de sécurité, avec un `Referrer-Policy` qui autorise le renvoi same-origin", async ({
  page,
}) => {
  await connecterBureau(page);
  const reponse = await page.goto("/planning");
  const entetes = reponse!.headers();

  attendreLesEntetesCommunes(entetes);
  expect(entetes["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("une page du terrain porte les mêmes en-têtes de sécurité", async ({
  page,
}) => {
  await connecterTerrain(page);
  const reponse = await page.goto("/terrain");
  const entetes = reponse!.headers();

  attendreLesEntetesCommunes(entetes);
  expect(entetes["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("une réponse d'API porte les mêmes en-têtes de sécurité", async ({
  page,
}) => {
  const reponse = await page.request.get("/api/sante");
  const entetes = reponse.headers();

  attendreLesEntetesCommunes(entetes);
  expect(entetes["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("/premier-acces porte les mêmes en-têtes de sécurité, SAUF `Referrer-Policy` qui y devient `no-referrer` — le jeton vit dans son URL", async ({
  page,
}) => {
  const reponse = await page.goto("/premier-acces");
  const entetes = reponse!.headers();

  attendreLesEntetesCommunes(entetes);
  expect(entetes["referrer-policy"]).toBe("no-referrer");
});
