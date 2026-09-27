import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AD-GR13-FICHE-TELEPHONE (27/09/2026) — même recette que
 * `captures-gr12-sites.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * La fiche intervention, à 375 et 1280 px, sur trois statuts : `planifiee`
 * (principale « Affecter »), `terminee` (principale « Clôturer »), `en_cours`
 * (AUCUNE action principale).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`git show <parent>:...` remis temporairement sur le
 * disque pour les fichiers touchés, jamais commité), une fois sur le code
 * livré — jamais en comparant deux fichiers distincts. Cette scène est la
 * SIENNE (préfixe `GR13CAP-`), distincte de celle de `fiche-telephone.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_GR13 ?? "";

const CLIENT_GR13CAP = uuidv7();
const SITE_GR13CAP = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();

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
        id: CLIENT_GR13CAP,
        societe_id: reperes.societeId,
        raison_sociale: "GR13CAP — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_GR13CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_GR13CAP,
        agence_id: agence.id,
        libelle: "GR13CAP — Lieu de l'épreuve",
      },
    });

    for (const [id, statut] of [
      [INTERVENTION_PLANIFIEE, "planifiee"],
      [INTERVENTION_TERMINEE, "terminee"],
      [INTERVENTION_EN_COURS, "en_cours"],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
            "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
            "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                 $6::"StatutIntervention", '2026-09-24T00:00:00Z', 60,
                 $7::uuid, now())`,
        id,
        reperes.societeId,
        CLIENT_GR13CAP,
        SITE_GR13CAP,
        agence.id,
        statut,
        reperes.technicienDucos,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_GR13CAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_GR13CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_GR13CAP } });
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
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — fiche planifiee`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "fiche-planifiee", largeur);
    });

    test(`capture — fiche terminee`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_TERMINEE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "fiche-terminee", largeur);
    });

    test(`capture — fiche en_cours`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "fiche-en-cours", largeur);
    });
  });
}
