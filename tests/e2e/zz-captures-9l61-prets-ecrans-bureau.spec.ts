import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES AVANT/APRÈS DE 9L61-PRET-2-ECRANS-BUREAU — ce fichier ne prend
 * que l'APRÈS : l'AVANT a été pris depuis un worktree séparé, au commit
 * `deadc850b` (`9L60-PRET-1-MODELE — passation`, le socle sans écran), sur
 * les MÊMES identifiants de démonstration — le seul moyen de comparer le
 * même écran avant et après sans dépendre d'un scénario qui n'existait pas
 * encore avant ce lot.
 *
 * Quatre écrans : `/parametres/prets` (créé — l'avant est une 404, l'écran
 * n'existait pas), la fiche intervention (bloc « Prêt d'appareil »), la
 * fiche client (bloc « Prêts d'appareils ») et le tableau de bord (carte
 * « Prêts en retard », state vide ici — aucun prêt en retard pour cette
 * société de démonstration).
 */
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L61-PRET-2-ECRANS-BUREAU/captures",
);

const CLIENT_ID = "0192f0a0-1000-7000-8000-000000000001";
// « a_planifier », jamais figée : la carte « Prêt d'appareil » rend son
// formulaire de sortie pour qui a `gerer_prets` (ADV) seulement si
// l'intervention n'est ni annulée ni clôturée.
const INTERVENTION_ID = "0192f0a0-6000-7000-8000-000000000001";

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`apres ${largeur}`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);

    await page.goto(`/interventions/${INTERVENTION_ID}`);
    await expect(
      page.getByRole("heading", { name: fr["intervention.pret.titre"] }),
    ).toBeVisible();
    await capturer(page, `fiche-intervention-apres-${largeur}`);

    await page.goto(`/clients/${CLIENT_ID}`);
    await expect(
      page.getByRole("heading", { name: fr["client.prets.titre"] }),
    ).toBeVisible();
    await capturer(page, `fiche-client-apres-${largeur}`);

    await page.goto("/tableau-de-bord");
    await expect(
      page.getByRole("heading", {
        name: fr["tableau_de_bord.prets_en_retard.titre"],
      }),
    ).toBeVisible();
    await capturer(page, `tableau-de-bord-apres-${largeur}`);

    await page.goto("/parametres/prets");
    await expect(
      page.getByRole("heading", { name: fr["prets.parc.titre"] }),
    ).toBeVisible();
    await capturer(page, `parc-de-pret-apres-${largeur}`);
  });
}
