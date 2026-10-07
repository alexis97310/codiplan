import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirPriorite } from "./setup/formulaire-creation";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AZ-AA-6-REFUS-CREATION (28/09/2026) — même recette que
 * `captures-9ay-aa1-choix-sites.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `AA6CAP-` — une agence inactive et un site déjà
 * rattaché à elle, créés directement en base (le fait antérieur que le refus
 * de création protège désormais). Le site reste PROPOSABLE dans le sélecteur
 * de `/interventions/nouvelle` : `RG-PLA-08` ne filtre que sur le CLIENT
 * actif, jamais sur l'agence — c'est précisément pour cette raison qu'un
 * refus SERVEUR est nécessaire, et pas seulement un menu qui le retirerait.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_AA6 ?? "";

const PREFIXE = "AA6CAP-";
const CODE_AGENCE = `${PREFIXE}INACTIVE`;
const AGENCE_ID = randomUUID();
const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { site_id: SITE_ID },
  });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
  await client.agence.deleteMany({ where: { id: AGENCE_ID } });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.agence.create({
      data: {
        id: AGENCE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE,
        libelle: CODE_AGENCE,
        territoire: "NC",
        actif: false,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: AGENCE_ID,
        libelle: `${PREFIXE}Site`,
        temps_trajet_min: 10,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
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
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — le refus de création sur un site d'une agence inactive, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/interventions/nouvelle");
      await choisirResultatParTexte(
        page,
        "site",
        PREFIXE,
        new RegExp(`${PREFIXE}Site`),
      );
      await page.locator('select[name="type"]').selectOption("curatif");
      await choisirPriorite(page, "p2");
      await page
        .locator('textarea[name="description"]')
        .fill("Panne épreuve AA-6 — capture du refus");
      await page
        .locator("#contenu")
        .getByRole("button", { name: fr["intervention.action.creer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);
      await expect(page.locator('[role="status"]')).toHaveText(
        fr["intervention.refus.agence_inactive"],
      );
      await capturer(page, "refus-agence-inactive", largeur);
    });
  });
}
