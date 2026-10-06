import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE, PARTIE A — AU TÉLÉPHONE (375 px), LE
 * BACK-OFFICE PORTE UNE BARRE BASSE, UN BOUTON « + », ET UNE ACTION COLLÉE
 * (QE-6, décision 9 du pilote du 03/10/2026, D172).
 *
 * **Aucune scène propre à cette épreuve** : elle ne lit ni ne compte aucune
 * donnée — ses assertions portent sur le CHROME (la barre, le bouton, le
 * tiroir), jamais sur une population du semis. `admin_societe` est le seul
 * rôle ouvert par `ouvrirLaSessionSensible`, et c'est pour l'une des quatre
 * destinations qu'il porte (QE-6a).
 *
 * **La feuille basse (QE-6c) n'est PAS éprouvée ici** : chaque dialogue de
 * confirmation du produit agit sur une donnée réelle (annuler une
 * intervention, défaire un import…), et l'atteindre sans toucher une donnée
 * comptée ailleurs aurait demandé sa propre scène, prefixée, créée et
 * détruite — hors du temps de ce lot. Elle est éprouvée au RENDU, dans
 * `tests/unit/ui/feuille-basse.test.tsx` (voir la passation du lot).
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("QE-6a — la barre basse porte Accueil, Planning, Interventions, Parc, Plus", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  const barre = page.getByRole("navigation", { name: fr["nav.libelle"] });
  await expect(barre).toBeVisible();

  await expect(
    barre.getByRole("link", { name: fr["nav.barre_basse.accueil"] }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    barre.getByRole("link", { name: fr["nav.planning"] }),
  ).toBeVisible();
  await expect(
    barre.getByRole("link", { name: fr["nav.interventions"] }),
  ).toBeVisible();
  await expect(
    barre.getByRole("link", { name: fr["vocabulaire.site.pluriel"] }),
  ).toHaveCount(0);
  await expect(
    barre.getByRole("button", { name: fr["nav.barre_basse.plus"] }),
  ).toBeVisible();
});

test("QE-6a — « Plus » ouvre le même tiroir que le bandeau mobile", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  const colonne = page.locator("#colonne-navigation");
  await expect(colonne).toBeHidden();

  await page
    .getByRole("navigation", { name: fr["nav.libelle"] })
    .getByRole("button", { name: fr["nav.barre_basse.plus"] })
    .click();

  await expect(colonne).toBeVisible();
});

test("QE-6b — le bouton « + » de /tableau-de-bord vise la création d'une intervention", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  const bouton = page.getByRole("link", { name: fr["planning.creer"] });
  await expect(bouton).toBeVisible();
  await expect(bouton).toHaveAttribute("href", "/interventions/nouvelle");

  const boite = await bouton.boundingBox();
  expect(boite).not.toBeNull();
  // AU-DESSUS DE LA BARRE BASSE (64 px), JAMAIS DERRIÈRE ELLE.
  expect(boite!.y + boite!.height).toBeLessThan(800 - 64);
});

test("QE-6d — l'action primaire de /interventions/nouvelle reste collée en bas de l'écran", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  const bouton = page.getByRole("button", {
    name: fr["intervention.action.creer"],
  });
  await expect(bouton).toBeVisible();

  const boite = await bouton.boundingBox();
  expect(boite).not.toBeNull();
  // COLLÉE : son bord bas touche la réserve de la barre basse (64 px), à
  // quelques pixels près (la marge intérieure de `BarreActionCollee`).
  expect(boite!.y + boite!.height).toBeGreaterThan(800 - 64 - 60);
  expect(boite!.y + boite!.height).toBeLessThanOrEqual(800 - 64);
});
