import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9G3-TITRES-CIBLES-ACTIONS, POINT 3 — `BarreActionCollee` ÉTIRE DÉSORMAIS
 * SON ACTION SUR TOUTE LA LARGEUR SOUS 901 PX, AU LIEU DE LA LAISSER À SA
 * TAILLE DE CONTENU, PETITE ET COLLÉE À GAUCHE (`components/ui/
 * action-primaire.tsx`). Mesuré sur le seul écran déjà câblé (QE-6d,
 * `/interventions/nouvelle`) — aucune scène propre, comme
 * `9dv-tp-nav4-telephone-glossaire.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 375 px, « Créer » occupe toute la largeur de la barre collée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/interventions/nouvelle");
  const bouton = page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] });
  await expect(bouton).toBeVisible();
  const boite = await bouton.boundingBox();
  expect(boite).not.toBeNull();
  // Pleine largeur, moins le `p-3` (12 px) de chaque côté de la barre
  // collée (`BarreActionCollee`).
  expect(boite!.width).toBeGreaterThan(375 - 24 - 1);
});

test("à 1280 px, « Créer » garde sa largeur de contenu — le bureau ne change pas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/interventions/nouvelle");
  const bouton = page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] });
  await expect(bouton).toBeVisible();
  const boite = await bouton.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.width).toBeLessThan(200);
});
