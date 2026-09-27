import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AH-GR14-PRESTATIONS-SITES (27/09/2026) — même recette que
 * `captures-9ag-gr14-trajets.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `ERGO14C-` — un client, deux sites (l'un avec un
 * temps de trajet MESURÉ, l'autre livré à l'estimation par zone) et une
 * prestation, créés en `beforeAll`, supprimés en `afterAll` : la carte
 * « Trajet » mesurée et la carte « Trajet estimé » n'existent pas dans le
 * semis de démonstration (aucun site n'y porte de `zone_geo`).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AH ?? "";

const CLIENT_ERGO14C = uuidv7();
const SITE_MESURE_ERGO14C = uuidv7();
const SITE_ESTIME_ERGO14C = uuidv7();
const PRESTATION_ERGO14C = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
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
        id: CLIENT_ERGO14C,
        societe_id: reperes.societeId,
        raison_sociale: "Client ERGO14C",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_MESURE_ERGO14C,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO14C,
        agence_id: agence.id,
        libelle: "Site ERGO14C mesuré",
        temps_trajet_min: 90,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ESTIME_ERGO14C,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO14C,
        agence_id: agence.id,
        libelle: "Site ERGO14C estimé",
        zone_geo: "cote_est",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_ERGO14C,
        societe_id: reperes.societeId,
        code: `ERGO14C-${PRESTATION_ERGO14C.slice(0, 8)}`,
        libelle: "Prestation ERGO14C",
        duree_standard_min: 90,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.prestation.deleteMany({ where: { id: PRESTATION_ERGO14C } });
    await client.site.deleteMany({ where: { client_id: CLIENT_ERGO14C } });
    await client.client.deleteMany({ where: { id: CLIENT_ERGO14C } });
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
  test(`capture — catalogue des prestations à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/parametres/prestations");
    await expect(
      page.getByRole("heading", { name: fr["prestations.titre"] }),
    ).toBeVisible();
    await capturer(page, "prestations", largeur);
  });

  test(`capture — cartes des sites, trajet mesuré et estimé à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/sites");
    const cartes = page.locator("article");
    await expect(cartes.first()).toBeVisible();
    await capturer(page, "sites", largeur);
  });
}
