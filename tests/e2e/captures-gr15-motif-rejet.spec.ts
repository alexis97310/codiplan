import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  CODE_EXTERNE_DETAIL_REJET,
  fabriquerLeClasseurDetailRejet,
} from "./setup/classeur-detail-rejet";
import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AK-GR15-MOTIF-REJET — même recette que
 * `captures-9ah-gr14-prestations-sites.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * **N'affirme PAS la présence de `[data-detail-rejet]`** — à la différence de
 * `imports-detail-rejet.spec.ts` — précisément pour rester rejouable AVANT le
 * lot : AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois
 * avec `[id]/page.tsx` remisé (`git stash push -- ".../page.tsx"`), une fois
 * avec le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_GR15_MOTIF_REJET ?? "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let idDuLot: string | null = null;

test.afterEach(async () => {
  if (idDuLot === null) return;
  const client = admin();
  try {
    await client.importLot.deleteMany({ where: { id: idDuLot } });
  } finally {
    await client.$disconnect();
  }
  idDuLot = null;
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
  test(`capture — rapport d'un rejet « saisie refusée » à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/imports");
    await page.locator('input[name="classeur"]').setInputFiles({
      name: "clients-detail-rejet.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await fabriquerLeClasseurDetailRejet(),
    });
    await page.getByRole("button", { name: fr["imports.controler"] }).click();

    await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
    idDuLot = /\/imports\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? null;

    // Depuis PA-55 (TP-A3-RAPPORT-IMPORT) : le rejet vit derrière un groupe
    // replié — ouvrir avant de capturer, sinon la ligne n'existe pas à
    // l'écran.
    const groupe = page.locator("details").first();
    await expect(groupe).toBeVisible();
    await groupe.locator("summary").click();
    const ligne = groupe.locator("tr", { hasText: CODE_EXTERNE_DETAIL_REJET });
    await expect(ligne).toBeVisible();
    await capturer(page, "rapport-detail-rejet", largeur);
  });
}
