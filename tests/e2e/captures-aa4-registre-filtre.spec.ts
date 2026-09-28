import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE AA-4-REGISTRE-FILTRE (28/09/2026) — même recette que
 * `captures-9ay-aa1-choix-sites.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `AA4CAP-` — une agence inactive, créée
 * directement en base (le fait antérieur que la décision D134 protège).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le ticket, une fois sur le code livré. Aucune assertion ne
 * porte sur le texte de l'option (« (inactive) ») ni sur celui de la puce :
 * ce que la CAPTURE montre suffit, et ce fichier n'importe donc rien de
 * `lib/i18n`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_AA4 ?? "";

const PREFIXE = "AA4CAP-";
const CODE_AGENCE = `${PREFIXE}INACTIVE`;
const AGENCE_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
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

    test(`capture — filtre du registre, agence sélectionnée par l'URL, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions?agence=${AGENCE_ID}`);
      await expect(page.locator('select[name="agence"]')).toBeVisible();
      await capturer(page, "registre-filtre", largeur);
    });
  });
}
