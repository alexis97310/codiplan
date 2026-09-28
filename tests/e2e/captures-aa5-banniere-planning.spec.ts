import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE AA-5-BANNIERE-PLANNING (28/09/2026) — même recette que
 * `captures-9ay-aa1-choix-sites.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `AA5CAP-` — une agence ACTIVE et une agence
 * INACTIVE, sans calendrier rattaché (leur clause dans la bannière ne dépend
 * pas d'un calendrier posé), créées directement en base.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le ticket, une fois sur le code livré. Aucune assertion ne
 * porte sur le texte de la bannière : ce que la CAPTURE montre suffit, et ce
 * fichier n'importe donc rien de `lib/i18n`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_AA5 ?? "";

const PREFIXE = "AA5CAP-";
const CODE_AGENCE_ACTIVE = `${PREFIXE}ACTIVE`;
const CODE_AGENCE_INACTIVE = `${PREFIXE}INACTIVE`;
const AGENCE_ACTIVE_ID = randomUUID();
const AGENCE_INACTIVE_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.agence.deleteMany({
    where: { id: { in: [AGENCE_ACTIVE_ID, AGENCE_INACTIVE_ID] } },
  });
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
        id: AGENCE_ACTIVE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE_ACTIVE,
        libelle: CODE_AGENCE_ACTIVE,
        territoire: "NC",
        actif: true,
      },
    });
    await client.agence.create({
      data: {
        id: AGENCE_INACTIVE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE_INACTIVE,
        libelle: CODE_AGENCE_INACTIVE,
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

    test(`capture — bannière du planning, à ${largeur}px`, async ({ page }) => {
      await page.goto("/planning");
      await expect(
        page.locator('[data-maquette-bloc="banniere-calendriers"]'),
      ).toBeVisible();
      await capturer(page, "banniere-planning", largeur);
    });
  });
}
