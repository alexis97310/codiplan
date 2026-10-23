import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES (D219-D221, décisions
 * d'Alexis du 21/10/2026) — même recette que `captures-9ac-clients-compteur-
 * gris.spec.ts` : rien n'est écrit sans une variable d'environnement qui
 * nomme le dossier, pour que l'exécution ordinaire de `pnpm test:e2e` n'écrive
 * jamais de fichier.
 *
 * Quatre écrans, à 1280 et 375 px : la confirmation avant « Terminer »
 * (D219), la question de réouverture (D220), la fiche terrain avec l'adresse
 * du site (défaut mesuré en ligne, point 4 du ticket), et la page de refus
 * nommé d'un ADV sur un écran qui exige `administrer_utilisateurs` (D221,
 * `components/ui/refus-acces.tsx`).
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G8_TERRAIN_CONFIRMATIONS_ET_ACCES ?? "";

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9G8 Capture Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9G8 Capture Site",
        adresse: { rue: "12 rue des Cocotiers" },
        commune: "Nouméa",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_COURS,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "en_cours",
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        duree_estimee_min: 30,
        date_planifiee: new Date(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_TERMINEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "terminee",
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        duree_estimee_min: 30,
        date_planifiee: new Date(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [INTERVENTION_EN_COURS, INTERVENTION_TERMINEE] } },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
    });

    test(`capture — fiche terrain avec adresse, puis confirmation de Terminer`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
      await page.goto(`/terrain/${INTERVENTION_EN_COURS}`);
      await expect(page.getByText("12 rue des Cocotiers")).toBeVisible();
      await capturer(page, "fiche-terrain-adresse", largeur);

      await page
        .getByRole("button", { name: fr["terrain.terminer.bouton"] })
        .click();
      await expect(
        page.getByText(fr["terrain.terminer.confirmation.titre"]),
      ).toBeVisible();
      await capturer(page, "confirmation-terminer", largeur);
      // JAMAIS SOUMIS — « Non » referme sans rien changer, pour laisser la
      // scène intacte au prochain test de ce fichier.
      await page
        .getByRole("button", { name: fr["terrain.terminer.confirmation.non"] })
        .click();
    });

    test(`capture — question de réouverture`, async ({ page }) => {
      await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
      await page.goto(`/terrain/${INTERVENTION_TERMINEE}`);
      await page
        .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
        .click();
      await expect(
        page.getByText(fr["terrain.compteur.reouverture.titre"]),
      ).toBeVisible();
      await capturer(page, "question-reouverture", largeur);
      // JAMAIS SOUMIS — « Non » referme sans rien changer.
      await page
        .getByRole("button", { name: fr["terrain.compteur.reouverture.non"] })
        .click();
    });

    test(`capture — refus nommé d'un ADV sur /parametres/equipe`, async ({
      page,
    }) => {
      await ouvrirUneSession(page);
      await page.goto("/parametres/equipe");
      await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();
      await capturer(page, "refus-acces-adv", largeur);
    });
  });
}
