import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9DG-TP-S1-LECTURE-TECHNICIEN (QT-2, D152) — LE MENU DU TECHNICIEN NE
 * MONTRE QUE CE QUI LUI EST OUVERT.
 *
 * `tests/unit/navigation/barre-par-role.test.tsx` éprouve déjà
 * `entreesAffichables` en dehors de tout navigateur. Ce fichier-ci joue la
 * VRAIE barre, sur le VRAI compte technicien du semis (`garnier@codima.test`,
 * LECTURE SEULE — même identité que `9dd-pg-g14c-terrain-transmises.spec.ts`,
 * jamais écrite ici) : rien à forger, une vérification de menu ne dépend
 * d'aucune donnée propre à une scène.
 *
 * ## SUPERSEDÉ PAR D221 (21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES)
 *
 * **Le ○ de QT-2 sur `consulter_planning` ouvrait `/planning` au technicien
 * — restreint à son propre planning, jamais à zéro.** Défaut mesuré en
 * ligne par Alexis le 21/10 : un compte technicien ouvrait RÉELLEMENT des
 * pages du back-office. D221 ferme désormais tout le segment, SANS
 * exception pour ce ○ — `/planning` n'est plus une destination du
 * technicien, `/terrain` l'est. Les deux scénarios ci-dessous, qui
 * mesuraient « quel menu, quel refus nommé », mesurent désormais « quelle
 * redirection » : la barre (donc son menu filtré) n'a plus jamais
 * l'occasion de s'afficher pour ce rôle sur ce segment.
 */
test.describe.configure({ mode: "serial" });

test("le technicien n'atteint plus /planning — D221 l'y redirige directement vers sa journée", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/terrain$/);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
});

test("le registre, le tableau de bord, les clients, les sites et les tarifs redirigent tous vers /terrain, jamais un refus affiché", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  for (const chemin of [
    "/interventions",
    "/tableau-de-bord",
    "/clients",
    "/sites",
    "/parametres/tarifs",
  ]) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/terrain$/);
    await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
  }
});
