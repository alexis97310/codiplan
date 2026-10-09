import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LE PLANCHER DE 12 PX, ÉPROUVÉ AU NAVIGATEUR (D138, TP-UX1-2).
 *
 * `tests/unit/ui/plancher-12-pages.test.ts` lit le texte source ; ces cinq
 * scénarios lisent le style CALCULÉ, sur un élément précis de chaque groupe
 * de commit — jamais par une classe, toujours par le rôle, le libellé ou un
 * attribut `data-` déjà présent. Lecture seule : aucune écriture en base,
 * scène de démonstration du semis uniquement.
 */

test.describe("plancher de 12 px — D138", () => {
  test("G1 — l'en-tête « Technicien » du planning, vue Semaine, à 1280 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
    await expect(page).toHaveURL(/\/planning/);

    const entete = page.getByRole("cell", {
      name: fr["planning.colonne_technicien"],
      exact: true,
    });
    await expect(entete).toHaveCSS("font-size", "12px");
  });

  // G2 — RETIRÉ (9EGA-REPRISE-9EG-1, D185) : la tuile « Taux d'occupation »
  // et son élément `[data-bloc="kpi-occupation"] [data-non-calcule]`
  // n'existent plus sur AUCUNE composition du tableau de bord reconstruit à
  // la maquette du 28/09 — le taux d'occupation ne s'affiche désormais QUE
  // dans `Statistiques` (réutilisé tel quel, D56), qui n'a jamais eu de
  // forme « non calculé » à côté d'un grand chiffre : son repli, « Sans
  // calendrier », se rend déjà en texte uniformément petit, jamais au
  // gabarit d'une mesure. Aucun endroit du dépôt ne porte plus ce motif.

  test("G3 — le libellé du filtre « Statut » du parc", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/parc");

    const libelle = page.locator('label[for="statut"]');
    await expect(libelle).toHaveCSS("font-size", "12px");
  });

  test("G4 — l'aide du territoire, à /parametres/agences/nouvelle", async ({
    page,
  }) => {
    // RECIBLÉ (PA-32, QT-21, D167, 05/10/2026, TP-NAV1) : le témoin d'origine,
    // l'explication des exceptions de calendrier, a quitté
    // `/parametres/agences` avec la colonne qu'il accompagnait — aucune route,
    // aucun écran, aucun semis n'écrivait cette table (audit du 28/09/2026).
    //
    // COMPTE ADMIN SOCIÉTÉ, PAS `ouvrirUneSession` (D153, TP-S3) : la
    // création d'une agence exige `administrer_agences`, qu'ADV ne porte
    // pas — un compte ordinaire y lirait un refus d'accès, sans l'aide
    // qu'on veut mesurer.
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/agences/nouvelle");

    const aide = page.getByText(fr["agence.territoire.aide"], {
      exact: true,
    });
    await expect(aide).toHaveCSS("font-size", "12px");
  });

  test("G5 — la pastille de statut d'une ligne, à /terrain", async ({
    page,
  }) => {
    // Session TERRAIN (technicien), comme `tests/e2e/terrain-largeur.spec.ts` :
    // le compte de démonstration ordinaire n'atteint pas cet écran.
    await page.goto("/connexion");
    await page
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain$/);

    // Pas d'attribut `data-` ni de rôle propre à la pastille : sa position
    // est stable (dernier `span` du conteneur du badge, après le badge
    // « nouveau » optionnel), jamais son libellé — le statut de la première
    // ligne dépend du semis.
    const pastille = page
      .locator("main li")
      .first()
      .locator("span.gap-1\\.5 > span")
      .last();
    await expect(pastille).toHaveCSS("font-size", "12px");
  });
});
