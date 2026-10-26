import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G6-FORMULAIRES — AVANT/APRÈS, même recette que
 * `zz-captures-9g5-terrain-ergonomie.spec.ts` : ce fichier est lancé une
 * fois sur `origin/main` (AVANT), une fois sur le code livré (APRÈS).
 * Captures en VIEWPORT (pas `fullPage`), à 375 et 1280 px.
 *
 * QUATRE ÉCRANS, parmi ceux touchés par ce lot : Nouvelle intervention
 * (points 1, 2), Premier accès (point 3), Enregistrer une vérification VGP
 * (point 5), Nouvelle agence (point 6). Le code d'enrôlement et le code de
 * secours de la connexion (point 4) n'ont rien à montrer de visuellement
 * distinct hors interaction clavier, déjà prouvée par
 * `enrolement-secrets-hors-url.spec.ts` et `9edz-connexion-code.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G6 ?? "";
const PHASE = process.env.CAPTURES_9G6_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: false,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — Nouvelle intervention, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/interventions/nouvelle");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "interventions-nouvelle", largeur);
  });

  test(`capture — Premier accès, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/premier-acces?token=capture-9g6");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "premier-acces", largeur);
  });

  test(`capture — Enregistrer une vérification VGP, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/vgp");
    const lien = page
      .getByRole("link", { name: fr["vgp.action_enregistrer"] })
      .first();
    if ((await lien.count()) === 0) {
      // Aucune machine soumise dans la scène de CE lancement (AVANT, sur
      // origin/main, sème sa propre base) — rien à capturer sans forcer une
      // machine qui n'existe pas forcément encore sur l'ancien code.
      return;
    }
    await lien.click();
    await expect(page).toHaveURL(/\/vgp\/enregistrer\//);
    await capturer(page, "vgp-enregistrer", largeur);
  });

  test(`capture — Nouvelle agence, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/parametres/agences/nouvelle");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "agences-nouvelle", largeur);
  });
}
