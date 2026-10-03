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
 */
test.describe.configure({ mode: "serial" });

test("le technicien ne voit au menu que ce que QT-2 lui ouvre", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  // La session technicien atterrit sur `/terrain`, dont la barre est PLATE
  // (sans rôle) — `/planning` est la première destination du back-office
  // que ce rôle ouvre réellement (`consulter_planning` ○).
  await page.goto("/planning");

  const nav = page.getByRole("navigation");
  await expect(
    nav.getByRole("link", { name: fr["nav.planning"] }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: fr["nav.absences"] }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: fr["nav.parc_machines"] }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: fr["nav.vgp"] })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: fr["nav.app_technicien"] }),
  ).toBeVisible();

  // FERMÉS PAR QT-2 — niveau exigé « complet » sur `consulter_planning`
  // (tableau de bord, interventions), ou capacité qu'un technicien ne porte
  // jamais (clients, sites, sociétés & tarifs, imports). `getByRole("link",
  // { exact: true })` plutôt que `getByText` : le titre du groupe « Clients
  // & parc » contient lui-même la sous-chaîne « Clients ».
  await expect(
    nav.getByRole("link", { name: fr["nav.tableau_de_bord"], exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: fr["nav.interventions"], exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: fr["nav.clients"], exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", {
      name: fr["vocabulaire.site.pluriel"],
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: fr["nav.societes_tarifs"], exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: fr["nav.imports_excel"], exact: true }),
  ).toHaveCount(0);
});

test("le registre et le tableau de bord refusent par leur URL directe, nommément", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  await page.goto("/interventions");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);
  await expect(
    page.getByRole("link", { name: fr["terrain.retour"] }),
  ).toBeVisible();

  await page.goto("/tableau-de-bord");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);

  await page.goto("/clients");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);

  await page.goto("/sites");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);

  await page.goto("/parametres/taux-horaire");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);
});
