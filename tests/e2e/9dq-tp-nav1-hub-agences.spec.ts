import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { TERRITOIRE_NOUVELLE_CALEDONIE } from "@/prisma/seed-data";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9DQ-TP-NAV1-HUB-AGENCES — LE HUB EN SECTIONS, LA CARTE IDENTITÉ, UNE
 * ADRESSE PAR AGENCE, LES LISTES DE TERRITOIRE ET DE FUSEAU (QT-21, QT-22,
 * D167, 05/10/2026).
 *
 * Écrans en LECTURE pour les trois premiers scénarios (aucune donnée créée,
 * même compte que `tous-les-ecrans-rendent.spec.ts`). Le dernier scénario
 * FORGE SA PROPRE agence (préfixe `NAV1-`, code tiré au sort à chaque
 * exécution) et la supprime en `finally` — jamais une ligne de `SCENE.*`.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("LE HUB EST RANGÉ EN SECTIONS, SANS LES PORTES CLIENTS ET SITES, AVEC IMPORTS", async ({
  page,
}) => {
  await page.goto("/parametres");

  for (const section of [
    "parametres.index_section_tarifs",
    "parametres.index_section_planification",
    "parametres.index_section_organisation",
    "parametres.index_section_referentiels",
    "parametres.index_section_donnees",
  ] as const) {
    await expect(
      page.getByRole("heading", { name: fr[section] }),
    ).toBeVisible();
  }

  // Clients et Sites ont quitté le hub (QT-21) — ils restent au menu.
  await expect(page.locator("main").locator('a[href="/clients"]')).toHaveCount(
    0,
  );
  await expect(page.locator("main").locator('a[href="/sites"]')).toHaveCount(0);

  // Imports est entré au hub, section Données. Scopé à `main` : le lien de
  // la barre de navigation porte le même nom.
  await expect(
    page.locator("main").getByRole("link", { name: fr["nav.imports_excel"] }),
  ).toBeVisible();
});

test("LA CARTE « IDENTITÉ » LIT LA SOCIÉTÉ ACTIVE", async ({ page }) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  const societe = await client.societe
    .findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { raison_sociale: true, territoire: true, devise_code: true },
    })
    .finally(() => client.$disconnect());

  await page.goto("/parametres");

  const carte = page
    .getByRole("heading", { name: fr["parametres.identite_titre"] })
    .locator("..");
  await expect(carte.getByText(societe.raison_sociale)).toBeVisible();
  await expect(
    carte.getByText(societe.territoire, { exact: true }),
  ).toBeVisible();
  await expect(
    carte.getByText(societe.devise_code, { exact: true }),
  ).toBeVisible();
});

test("LA FICHE D'UNE AGENCE SE REJOINT PAR SON PROPRE IDENTIFIANT, AVEC « Agence » EN TITRE", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  // L'agence DE LA SCÈNE, par son code — jamais la première trouvée sans
  // tri : une agence forgée par un autre spec sous `fullyParallel` peut être
  // supprimée en cours de route (9DW-SOLDE-9DR, Q2).
  const agence = await client.agence
    .findFirstOrThrow({
      where: { societe: { code: "CODIMA-NC" }, code: "DUCOS" },
      select: { id: true, libelle: true },
    })
    .finally(() => client.$disconnect());

  await page.goto(`/parametres/agences/${agence.id}`);

  await expect(
    page.getByRole("heading", { name: new RegExp(agence.libelle) }),
  ).toBeVisible();
  // Le mot imposé se compose (D5, D47) : le titre n'est jamais le seul
  // libellé de l'agence.
  await expect(page.locator("h1")).not.toHaveText(agence.libelle);
});

const PREFIXE_AGENCE_FORGEE = "NAV1-";

function codeAgenceForgee(): string {
  return `${PREFIXE_AGENCE_FORGEE}${Date.now()}`;
}

test("CRÉER UNE AGENCE : TERRITOIRE ET FUSEAU EN LISTE, AUCUNE VALEUR PAR DÉFAUT", async ({
  page,
}) => {
  const code = codeAgenceForgee();

  try {
    await page.goto("/parametres/agences/nouvelle");

    const territoire = page.locator('select[name="territoire"]');
    const fuseau = page.locator('select[name="fuseau_horaire"]');

    // AUCUNE VALEUR PAR DÉFAUT (PA-35) : le territoire n'a encore rien choisi.
    await expect(territoire).toHaveValue("");
    // Le fuseau, lui, porte une option EXPLICITE — « hérite de la société » —
    // plutôt qu'un défaut silencieux.
    await expect(fuseau).toHaveValue("");
    await expect(
      fuseau.locator("option", { hasText: fr["agence.fuseau_horaire.herite"] }),
    ).toHaveCount(1);

    await page.locator('input[name="code"]').fill(code);
    await page.locator('input[name="libelle"]').fill(code);
    await territoire.selectOption(TERRITOIRE_NOUVELLE_CALEDONIE);
    await page
      .locator("#contenu")
      .getByRole("button", { name: fr["agence.action.creer"] })
      .click();
    await page.waitForLoadState("networkidle");

    // LE SUCCÈS MÈNE AU RÉGLAGE DES HORAIRES (AGENCE-1), SOUS LE SEGMENT
    // EXPLICITE DU CALENDRIER (PA-29) — jamais `/parametres/agences/<id>`,
    // qui désigne l'agence elle-même depuis ce lot.
    await expect(page).toHaveURL(/\/parametres\/agences\/calendrier\//);

    // AUCUNE PLAGE PRÉ-REMPLIE (PA-34) : le formulaire d'ajout du premier
    // jour part de deux champs vides, jamais 08:00–12:00.
    const debut = page.locator('input[name="debut"]').first();
    const fin = page.locator('input[name="fin"]').first();
    await expect(debut).toHaveValue("");
    await expect(fin).toHaveValue("");
  } finally {
    const client = new PrismaClient({
      datasources: { db: { url: urlAdministration() } },
    });
    try {
      const agence = await client.agence.findFirst({
        where: { code },
        select: { calendrier_id: true },
      });
      await client.agence.deleteMany({ where: { code } });
      if (agence?.calendrier_id) {
        await client.calendrier.deleteMany({
          where: { id: agence.calendrier_id },
        });
      }
    } finally {
      await client.$disconnect();
    }
  }
});
