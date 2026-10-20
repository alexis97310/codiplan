import { expect, test } from "@playwright/test";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CONSTAT 3 DE L'AUDIT FONCTIONNEL 9F5 (`docs/audits/9F5-fonctionnel/
 * rapport.md`) — `CopieLocaleTerrain` (`components/terrain/copie-locale.tsx`)
 * se montait pour TOUTE visite de `/terrain/*`, déclenchant `GET
 * /api/terrain/instantane` même pour un rôle à accès complet, que la route
 * refuse à raison (403) : un appel réseau de trop. `app/(mobile)/layout.tsx`
 * ne monte désormais ce composant que pour un technicien.
 */
test("un rôle à accès complet sur /terrain ne déclenche aucun appel à /api/terrain/instantane", async ({
  page,
}) => {
  const appels: string[] = [];
  page.on("request", (requete) => {
    if (requete.url().includes("/api/terrain/instantane")) {
      appels.push(requete.url());
    }
  });

  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/terrain");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Le temps qu'un appel parti malgré tout ait eu le temps d'arriver.
  await page.waitForLoadState("networkidle");

  expect(appels).toEqual([]);
});

test("le technicien garde exactement sa copie locale — l'appel part toujours", async ({
  page,
}) => {
  const appels: string[] = [];
  page.on("request", (requete) => {
    if (requete.url().includes("/api/terrain/instantane")) {
      appels.push(requete.url());
    }
  });

  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/terrain");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(appels.length).toBeGreaterThan(0);
});
