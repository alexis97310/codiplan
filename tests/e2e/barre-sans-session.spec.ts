import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * R2-16 — LA BARRE DE NAVIGATION NE COIFFE PAS LES ÉCRANS SANS SESSION.
 *
 * *Mesuré le 11/09/2026, avant : la barre était du chrome de mise en page
 * racine, donc onze entrées dont dix inertes s'affichaient au-dessus du
 * formulaire de connexion — le premier écran qu'un acheteur voit — avec une
 * pastille d'identité vide par construction.*
 *
 * Ce scénario regarde le HTML RÉELLEMENT SERVI par une compilation de
 * production, et non la chaîne de mises en page que
 * `tests/unit/app/barre-par-segment.test.ts` lit dans le répertoire. Les deux ne
 * se recouvrent pas : le gardien statique éprouve les DEUX directions — une
 * page d'après-session porte bien la barre —, ce que ce scénario ne peut pas
 * faire sans session ouverte ; le scénario éprouve ce que Next rend vraiment,
 * ce qu'aucune lecture de fichier ne prouve.
 */
const SANS_SESSION = [
  "/",
  "/sante",
  "/connexion",
  "/enrolement",
  "/premier-acces",
];

for (const chemin of SANS_SESSION) {
  test(`aucune barre de navigation sur ${chemin}`, async ({ page }) => {
    await page.goto(chemin);

    // Témoin : la page a bien été servie. Sans lui, une 404 ou une erreur de
    // rendu passerait pour une absence de barre (§9, 30/08).
    await expect(page.locator("body")).toHaveAttribute("data-apparence", /.+/);

    await expect(
      page.getByRole("navigation", { name: fr["nav.libelle"] }),
    ).toHaveCount(0);
  });
}
