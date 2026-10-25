import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9G9D-CARTES-PARAMETRES-PLANNING — chaque écran converti
 * vers `Carte`, à 375 et 1280 px. Pas d'avant/après ici (contrairement à
 * `zz-captures-9g9a.spec.ts`) : ce lot ne compare pas deux commits, il
 * prouve que l'écran APRÈS conversion rend bien, sur la VRAIE page
 * (`toHaveURL` avant chaque capture).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9G9D-CARTES-PARAMETRES-PLANNING/captures",
);

async function capturer(page: Page, nom: string, largeur: number) {
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function capturerEcran(page: Page, chemin: string, nom: string) {
  await page.goto(chemin);
  await expect(page).toHaveURL(chemin);
  await expect(page.locator("main")).toBeVisible();
  for (const largeur of [1280, 375] as const) {
    await capturer(page, nom, largeur);
  }
}

test("captures — les écrans de paramétrage et le planning, convertis vers Carte", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await capturerEcran(page, "/parametres", "parametres-hub");
  await capturerEcran(page, "/parametres/societe", "parametres-societe");
  await capturerEcran(page, "/parametres/equipe", "parametres-equipe");
  await capturerEcran(
    page,
    "/parametres/habilitations",
    "parametres-habilitations",
  );
  await capturerEcran(
    page,
    "/parametres/prestations",
    "parametres-prestations",
  );
  await capturerEcran(page, "/parametres/tarifs", "parametres-tarifs");
  await capturerEcran(page, "/parametres/trajets", "parametres-trajets");
  await capturerEcran(page, "/parametres/materiel", "parametres-materiel");
  await capturerEcran(page, "/parametres/agences", "parametres-agences");
  await capturerEcran(
    page,
    "/parametres/agences/nouvelle",
    "parametres-agences-nouvelle",
  );
  await capturerEcran(page, "/planning", "planning");

  // UNE FICHE D'AGENCE RÉELLE — depuis la première ligne du tableau OU de sa
  // carte (9G2-TABLEAUX-EN-CARTES-375 : la page rend les deux, une seule
  // visible selon la largeur — `:visible` choisit celle-là, jamais un
  // identifiant fixe (la scène de démonstration n'en promet aucun)).
  // Exclut le lien « + Nouvelle agence », qui partage le même préfixe.
  await page.goto("/parametres/agences");
  const premiereAgence = page
    .locator(
      'main a[href^="/parametres/agences/"]:not([href="/parametres/agences/nouvelle"]):not([href^="/parametres/agences/calendrier/"]):visible',
    )
    .first();
  await premiereAgence.click();
  await expect(page).toHaveURL(/\/parametres\/agences\/[^/]+$/);
  for (const largeur of [1280, 375] as const) {
    await capturer(page, "parametres-agences-fiche", largeur);
  }

  // LE CALENDRIER DE CETTE AGENCE — « régler les horaires », quand le lien
  // existe (une agence sans calendrier ne le propose pas).
  const lienCalendrier = page
    .locator("main")
    .getByRole("link", { name: fr["parametres.regler_horaires"] });
  if ((await lienCalendrier.count()) > 0) {
    await lienCalendrier.first().click();
    await expect(page).toHaveURL(/\/parametres\/agences\/calendrier\/[^/]+$/);
    for (const largeur of [1280, 375] as const) {
      await capturer(page, "parametres-agences-calendrier", largeur);
    }
  }

  // UN FORFAIT RÉEL — depuis « Modifier » du catalogue de tarifs. À 1280 px :
  // le tableau (desktop) porte ce lien, la liste en cartes (téléphone) non.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parametres/tarifs");
  const lienForfait = page.locator('a[href^="/parametres/forfaits/"]').first();
  if ((await lienForfait.count()) > 0) {
    await lienForfait.click();
    await expect(page).toHaveURL(/\/parametres\/forfaits\/[^/]+$/);
    for (const largeur of [1280, 375] as const) {
      await capturer(page, "parametres-forfaits-fiche", largeur);
    }
  }
});
