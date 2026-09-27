import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AP-GR17-KPI-VGP-SANTE (28/09/2026) — même recette que
 * `captures-9ao-gr17-demande-champ-nature.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * LECTURE SEULE — aucune scène propre : les cinq écrans se lisent tels que le
 * semis les rend déjà. La fiche machine capturée est `NUS-SPL-2022-0007`
 * (pont, modèle SPL-4000), la SEULE machine du semis dont l'échéance VGP est
 * passée (voir `tests/e2e/vgp-retard-visible.spec.ts`).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (worktree sur le commit de départ), une fois sur le
 * code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AP ?? "";

let machineDepasseeId: string;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const machine = await client.machine.findFirstOrThrow({
      where: { numero_serie: "NUS-SPL-2022-0007" },
      select: { id: true },
    });
    machineDepasseeId = machine.id;
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
  test(`capture — tableau de bord à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "tableau-de-bord", largeur);
  });

  test(`capture — registre VGP à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/vgp");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "vgp", largeur);
  });

  test(`capture — registre VGP filtré sur les échéances dépassées à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/vgp?etat=depassees");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "vgp-depassees", largeur);
  });

  test(`capture — fiche machine à échéance VGP dépassée à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/parc/${machineDepasseeId}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-machine-vgp-depassee", largeur);
  });

  test(`capture — page Santé à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto("/sante");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "sante", largeur);
  });
}
