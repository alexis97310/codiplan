import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  SCENE,
} from "./setup/scene";

/**
 * LES CAPTURES DE 9G5-TERRAIN-ERGONOMIE — AVANT/APRÈS, même recette que
 * `zz-captures-9g4-planning-jour-et-mois.spec.ts` : ce fichier est lancé une
 * fois sur `origin/main` (AVANT), une fois sur le code livré (APRÈS).
 * Captures en VIEWPORT (pas `fullPage`), à 375 et 1280 px.
 *
 * TROIS ÉCRANS : Ma journée (points 3, 7), la fiche d'une intervention
 * (points 1, 2, 5, 7), la coquille hors réseau sans aucune copie (point 6).
 * Les points 4 (déjà réparé par 9F5B) et 8 (aucun geste visuel au repos —
 * refus affiché seulement après une réponse non JSON) n'ont rien à capturer.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G5 ?? "";
const PHASE = process.env.CAPTURES_9G5_PHASE === "avant" ? "avant" : "apres";

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

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

for (const largeur of [1280, 375] as const) {
  test(`capture — Ma journée, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirLaSessionDuTerrain(page);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "journee", largeur);
  });

  test(`capture — fiche d'une intervention, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirLaSessionDuTerrain(page);
    // DÉMARRABLE (point 1) — la même intervention que `terrain.spec.ts`
    // utilise pour démarrer le compteur : « Démarrer l'intervention » y est
    // bien proposé, ce qu'une intervention « À planifier » ne montrerait pas.
    await page.goto(`/terrain/${SCENE.compteurA}`);
    await expect(page.locator("main")).toBeVisible();
    // SANS DÉFILER (point 1) — la capture du HAUT de la fiche, telle que
    // rendue au premier écran, montre « Démarrer l'intervention » (point 1),
    // la barre basse (point 2) et le texte du compteur au repos (point 7).
    await capturer(page, "fiche-terrain", largeur);

    // LE CANEVAS DE SIGNATURE (point 5) — invisible tant qu'aucune issue
    // n'est choisie ; un simple changement d'état local (`choisirIssue`),
    // sans aucun appel réseau, donc sans effet sur la scène partagée.
    const boutonSignature = page.getByRole("button", {
      name: fr["terrain.signature.option_signee"],
    });
    if ((await boutonSignature.count()) > 0) {
      await boutonSignature.click();
      await page
        .locator("canvas")
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
    }
    await capturer(page, "fiche-signature", largeur);
  });

  test(`capture — coquille hors réseau, aucune copie, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    // AUCUNE SESSION, AUCUNE VISITE PRÉALABLE DE /terrain (point 6) — sans
    // quoi `CopieLocaleTerrain` aurait déjà écrit une copie dans IndexedDB,
    // et cet écran ne rendrait plus jamais la branche « aucune copie ».
    await page.goto("/terrain-hors-reseau");
    await expect(
      page.getByText(fr["terrain.hors_reseau.aucune_copie"]),
    ).toBeVisible();
    await capturer(page, "coquille-aucune-copie", largeur);
  });
}
