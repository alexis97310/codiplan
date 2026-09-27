import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AN-GR17-BARRE-PLANNING-TON (27/09/2026) — même recette que
 * `captures-9ah-gr14-prestations-sites.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `ERGO13-` — un client, un site et une
 * intervention, créés en `beforeAll`, supprimés en `afterAll`. Le bandeau
 * « parti » se déclenche par l'URL (`avertissement=<clé>`), exactement comme
 * `avertissement-ton.spec.ts` : aucun courriel réel n'est nécessaire pour ce
 * que cette capture montre (la couleur du bandeau).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (worktree sur le commit de départ), une fois sur le
 * code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AN ?? "";

const PREFIXE = "ERGO13-";
const RAISON_SOCIALE = `${PREFIXE}Client (captures GR17)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (captures GR17)`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

const CLE_PARTI = "intervention.avertissement.courriel_client_parti";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
        temps_trajet_min: 10,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        type: "curatif",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

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

for (const largeur of [1280, 375] as const) {
  for (const vue of ["semaine", "jour"] as const) {
    test(`capture — planning vue ${vue} à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
      await page.goto(`/planning?vue=${vue}`);
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      if (largeur < 901) {
        await page
          .getByRole("button", { name: fr["nav.ouvrir_le_menu"] })
          .click();
        await expect(page.locator("#colonne-navigation")).toBeVisible();
      }
      await capturer(page, `planning-${vue}`, largeur);
    });
  }

  test(`capture — fiche ERGO13- bandeau « parti » à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/${INTERVENTION_ID}?avertissement=${CLE_PARTI}`,
    );
    await expect(
      page.locator(`[data-avertissement="${CLE_PARTI}"]`),
    ).toBeVisible();
    await capturer(page, "fiche-bandeau-parti", largeur);
  });
}
