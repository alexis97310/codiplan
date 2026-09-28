import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { MARDI, MERCREDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";
import { urlAdministration } from "./setup/base";
import type { ReperesDeScene } from "./setup/scene";

/**
 * LES CAPTURES DE PG-A7-SEMAINE-GARDE-HEURE (28/09/2026) — bug 9 de l'audit
 * d'ergonomie du 27/09/2026 : un déplacement en vue Semaine d'une
 * intervention déjà planifiée à une heure lui retirait son heure ET sa
 * durée. Même recette que `captures-pg-a3a-messages-pose.spec.ts` : AVANT
 * sur le code d'avant ce ticket (`git worktree`), APRÈS sur le code livré.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGA7-` — une intervention 15:30–16:30 un MARDI,
 * affectée à un technicien de DUCOS (créneau libre de tout chevauchement
 * avec les interventions de démonstration, mesuré en base), déplacée vers
 * le MERCREDI suivant. La carte affiche l'heure en tête (`enTeteDuBloc`) :
 * après le dépôt, AVANT ce ticket elle ne montre plus que le client, APRÈS
 * elle montre toujours « 15:30 PGA7 ».
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A7 ?? "";

const CLIENT_PGA7 = uuidv7();
const SITE_PGA7 = uuidv7();
const INTERVENTION_PGA7 = uuidv7();

let reperes: ReperesDeScene;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGA7,
        societe_id: reperes.societeId,
        raison_sociale: "PGA7",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA7,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA7,
        agence_id: agence.id,
        libelle: "PGA7",
      },
    });
    const jourMardi = jourDeLaScene(reperes, MARDI);
    const jour = new Date(
      Date.UTC(jourMardi.annee, jourMardi.mois - 1, jourMardi.jour),
    );
    // 15:30 à Nouméa (UTC+11) est 04:30 UTC le MÊME jour.
    const creneauDebut = new Date(jour.getTime() + (15.5 - 11) * 3_600_000);
    const creneauFin = new Date(creneauDebut.getTime() + 60 * 60_000);
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'curatif', 'p3',
               'planifiee', $7::date, $8::timestamp, $9::timestamp, 60, 'temps_passe', 'XPF', now())`,
      INTERVENTION_PGA7,
      reperes.societeId,
      agence.id,
      CLIENT_PGA7,
      SITE_PGA7,
      reperes.technicienDucos,
      jour,
      creneauDebut,
      creneauFin,
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
      CLIENT_PGA7,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA7 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA7 } });
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

/*
 * LE DÉPÔT NE SE FAIT QU'À 1280 px — la grille glissable est `hidden ...
 * lg:block` (`app/(back-office)/planning/page.tsx`) : sous `lg`,
 * `ListeSemaine` la remplace et « PAS DE `BlocPosable` ICI » (aucune cible
 * de dépôt). La capture à 375 px se contente donc de RELIRE, dans la liste
 * mobile, l'état que le dépôt à 1280 px vient de produire en base — le mode
 * SÉRIE du fichier garantit l'ordre.
 */
test.describe(`à 1280px`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la carte après un dépôt en vue Semaine, à 1280px", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    const cible = page.locator(
      `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, MERCREDI))}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    await glisser(
      page,
      page.locator(`[data-bloc="${INTERVENTION_PGA7}"]`),
      cible,
    );
    await expect(
      cible.locator(`[data-bloc="${INTERVENTION_PGA7}"]`),
    ).toBeVisible();
    await capturer(page, "carte-apres-depot-semaine", 1280);
  });
});

test.describe(`à 375px`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la carte après un dépôt en vue Semaine (liste mobile), à 375px", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    await expect(
      page.locator(`[data-carte-liste="${INTERVENTION_PGA7}"]`),
    ).toBeVisible();
    await capturer(page, "carte-apres-depot-semaine", 375);
  });
});
