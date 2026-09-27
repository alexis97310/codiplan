import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AY-AA-1-CHOIX-SITES (27/09/2026) — même recette que
 * `captures-9ai-gr14-libelles-saisie.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `AA1CAP-` — une agence inactive et un site déjà
 * rattaché à elle, créés directement en base (le fait antérieur que la
 * décision D134 protège).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le ticket, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts. Aucune assertion ne porte sur le texte de l'option
 * (« (inactive) ») : ce que la CAPTURE montre suffit, et ce fichier n'importe
 * donc rien de `lib/i18n` — `agence.option.inactive` n'existe pas avant le
 * ticket, et `next build` type-vérifie ce fichier avec le code d'avant.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_AA1 ?? "";

const PREFIXE = "AA1CAP-";
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

    test(`capture — /sites/nouveau à ${largeur}px`, async ({ page }) => {
      await page.goto("/sites/nouveau");
      await expect(page.locator("main form")).toBeVisible();
      await capturer(page, "sites-nouveau", largeur);
    });

    test(`capture — fiche du site rattaché à l'agence inactive, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/sites/${SITE_ID}`);
      await expect(page.locator('select[name="agence_id"]')).toBeVisible();
      await capturer(page, "fiche-site", largeur);
    });
  });
}
