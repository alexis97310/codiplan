import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LA DÉCONNEXION FERME RÉELLEMENT LA SESSION (N-02, arbitrage du 16/09/2026).
 *
 * ## Le défaut que ce scénario aurait attrapé
 *
 * `POST /api/session/deconnexion` existait déjà, et un scénario de rendu du
 * composant aurait suffi à prouver que le bouton POSTE vers la bonne route —
 * c'est exactement ce que `tests/unit/navigation/deconnexion-chrome.test.tsx`
 * fait. **Ce que lui ne peut pas prouver est que le clic ferme quelque
 * chose** : un formulaire qui poste vers une route qui ne détruit rien
 * passerait la même assertion. Cet écran-ci traverse la vraie route, le vrai
 * greffon d'authentification, et vérifie que la session est bel et bien
 * morte — pas seulement que le navigateur a changé de page.
 *
 * ## Pourquoi seul le back-office, ici
 *
 * `tests/unit/navigation/deconnexion-chrome.test.tsx` couvre les trois
 * coques au niveau du composant. Aucun compte de portail ne peut ouvrir de
 * session aujourd'hui (D96), et le terrain n'a pas de scène de bout en bout
 * dédiée : le back-office est la seule coque où une vraie session s'ouvre et
 * se ferme ici.
 */

test("la déconnexion depuis le chrome ferme la session, pas seulement l'écran", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/planning");

  const deconnexion = page.getByRole("button", {
    name: fr["nav.deconnexion"],
  });
  await expect(deconnexion).toBeVisible();
  await deconnexion.click();
  await expect(page).toHaveURL(/\/connexion/);

  // LE TÉMOIN : la session est MORTE, pas seulement quittée. Un cookie que le
  // clic aurait laissé vivant renverrait encore /planning au lieu de
  // rediriger — c'est la différence entre « on a changé de page » et « on
  // s'est déconnecté ».
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/connexion/);
});

test("l'écran « Charte de la société » montre l'état de la charte active", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/societe");

  await expect(
    page.getByRole("heading", { name: fr["parametres.societe_titre"] }),
  ).toBeVisible();
  // La société de démonstration a ses propres couleurs (prisma/seed-data.ts,
  // `couleur_primaire`/`couleur_secondaire`) : c'est « Charte de la société »
  // qui doit se lire sur la PASTILLE, jamais le thème neutre — le titre de
  // l'écran porte, lui, exactement le même texte, d'où le repère qui les
  // distingue.
  await expect(
    page.locator("[data-origine-theme]").getByText(fr["theme.societe"]),
  ).toBeVisible();
});
