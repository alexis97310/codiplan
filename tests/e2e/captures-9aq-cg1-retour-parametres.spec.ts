import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9AQ-CG1-RETOUR-PARAMETRES — même recette que
 * `captures-9ap-gr17-kpi-vgp-sante.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (worktree sur le commit de départ, `CAPTURES_9AQ_FASE=avant`),
 * une fois sur le code livré (`CAPTURES_9AQ_FASE=apres`). LECTURE SEULE :
 * aucune scène propre, les neuf écrans se lisent tels que le semis les rend
 * déjà.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AQ ?? "";
const FASE = process.env.CAPTURES_9AQ_FASE ?? "";

async function capturer(page: Page, ecran: string, largeur: number) {
  if (DOSSIER === "" || FASE === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${FASE}-${largeur}.png`),
    fullPage: true,
  });
}

const ECRANS: readonly { nom: string; chemin: string }[] = [
  { nom: "societe", chemin: "/parametres/societe" },
  { nom: "agences", chemin: "/parametres/agences" },
  { nom: "trajets", chemin: "/parametres/trajets" },
  { nom: "forfaits", chemin: "/parametres/forfaits" },
  { nom: "taux-horaire", chemin: "/parametres/taux-horaire" },
  { nom: "prestations", chemin: "/parametres/prestations" },
  { nom: "materiel", chemin: "/parametres/materiel" },
  { nom: "equipe", chemin: "/parametres/equipe" },
  { nom: "habilitations", chemin: "/parametres/habilitations" },
];

for (const largeur of [1280, 375] as const) {
  for (const ecran of ECRANS) {
    test(`capture — ${ecran.nom} à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(ecran.chemin);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, ecran.nom, largeur);
    });
  }
}
