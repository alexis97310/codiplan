import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9AU-CG8-CASES-44 (audit captures du 26/09/2026, constat C-G10) — LES CASES
 * À COCHER DES ÉCRANS DE PARAMÉTRAGE TOUCHENT 44 PX SOUS 768 PX.
 *
 * ## Ce qui est mesuré, et où
 *
 * `/parametres/prestations`, le formulaire de CRÉATION — section titrée
 * `fr["prestations.creer"]` (`prestations/page.tsx:111`) : le catalogue naît
 * VIDE (L1-06), c'est donc la seule case à cocher que la scène ordinaire
 * garantit sans qu'aucun scénario n'ait besoin d'écrire une ligne. Une mesure
 * géométrique, comme `planning-cibles-375.spec.ts` — jamais un décompte de
 * base.
 *
 * `getByLabel` cible l'`<input>` PAR SON LABEL — jamais par un texte nu :
 * la même chaîne « Active » apparaît aussi en simple texte de statut dans le
 * tableau du catalogue quand il porte des lignes, et cette requête ne la
 * verrait pas. La boîte mesurée est celle du `<label>` lui-même (le parent
 * direct de la case, `CaseACocher`) — c'est lui qui porte la cible tactile,
 * jamais l'`<input>` seul.
 *
 * ## Aucune donnée créée
 *
 * Lecture seule : la scène partagée n'est ni créée ni modifiée par ce fichier.
 */
test.describe.configure({ mode: "serial" });

test("SOUS 768 PX, LA CASE « ACTIVE » DE LA CRÉATION D'UNE PRESTATION FAIT AU MOINS 44 PX DE HAUT", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/prestations");
  await expect(
    page.getByRole("heading", { name: fr["prestations.creer"] }),
  ).toBeVisible();

  const case_ = page.getByLabel(fr["prestations.active"]);
  await expect(case_).toHaveAttribute("type", "checkbox");
  const label = case_.locator("xpath=..");
  const boite = await label.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
});

test("À 1280 PX, LA MÊME CASE RESTE SOUS 44 PX — LE RENDU BUREAU NE CHANGE PAS", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/prestations");
  await expect(
    page.getByRole("heading", { name: fr["prestations.creer"] }),
  ).toBeVisible();

  const case_ = page.getByLabel(fr["prestations.active"]);
  const label = case_.locator("xpath=..");
  const boite = await label.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeLessThan(44);
});
