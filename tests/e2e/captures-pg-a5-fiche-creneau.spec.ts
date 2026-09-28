import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-A5-FICHE-CRENEAU (28/09/2026) — même recette que
 * `captures-gr14-duree-unique.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * Trois interventions (préfixe `PGA5CAP-`), à leur propre ligne fixe, jamais
 * une fixture `SCENE.*` partagée — les trois cas du résumé : le créneau
 * complet (heure et durée), l'heure non fixée, et la durée non renseignée.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A5 ?? "";

const CLIENT_PGA5CAP = uuidv7();
const SITE_PGA5CAP = uuidv7();
const INTERVENTION_COMPLETE = uuidv7();
const INTERVENTION_SANS_HEURE = uuidv7();
const INTERVENTION_SANS_DUREE = uuidv7();

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
        id: CLIENT_PGA5CAP,
        societe_id: reperes.societeId,
        raison_sociale: "PGA5CAP — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA5CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA5CAP,
        agence_id: agence.id,
        libelle: "PGA5CAP — Lieu de l'épreuve",
      },
    });

    // LE CRÉNEAU COMPLET — `planifiee`, une heure de début ET de fin, deux
    // heures d'écart : « jeu. 24/09 · 08:00–10:00 (2 h 00) ».
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "creneau_debut", "creneau_fin",
          "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee'::"StatutIntervention", '2026-09-24T00:00:00Z',
               '2026-09-23T21:00:00Z', '2026-09-23T23:00:00Z', 120,
               $6::uuid, now())`,
      INTERVENTION_COMPLETE,
      reperes.societeId,
      CLIENT_PGA5CAP,
      SITE_PGA5CAP,
      agence.id,
      reperes.technicienDucos,
    );

    // SANS HEURE — `planifiee` exige une durée (`intervention_planifiee_a_sa_duree`),
    // mais aucun créneau : « jeu. 24/09 · heure non fixée ».
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee'::"StatutIntervention", '2026-09-24T00:00:00Z', 90,
               $6::uuid, now())`,
      INTERVENTION_SANS_HEURE,
      reperes.societeId,
      CLIENT_PGA5CAP,
      SITE_PGA5CAP,
      agence.id,
      reperes.technicienDucos,
    );

    // SANS DURÉE — `terminee` (hors des deux statuts que la contrainte
    // couvre), une heure de début sans durée prévue : « jeu. 24/09 · 08:00 ·
    // durée non renseignée ».
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "creneau_debut", "technicien_id",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'terminee'::"StatutIntervention", '2026-09-24T00:00:00Z',
               '2026-09-23T21:00:00Z', $6::uuid, now())`,
      INTERVENTION_SANS_DUREE,
      reperes.societeId,
      CLIENT_PGA5CAP,
      SITE_PGA5CAP,
      agence.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGA5CAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA5CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA5CAP } });
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

    test(`capture — résumé complet`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_COMPLETE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "resume-complet", largeur);
    });

    test(`capture — résumé sans heure`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_SANS_HEURE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "resume-sans-heure", largeur);
    });

    test(`capture — résumé sans durée`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_SANS_DUREE}`);
      await expect(page.locator("main h1")).toBeVisible();
      await capturer(page, "resume-sans-duree", largeur);
    });
  });
}
