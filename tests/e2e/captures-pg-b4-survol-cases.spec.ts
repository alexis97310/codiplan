import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MERCREDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import type { ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-B4-SURVOL-CASES (28/09/2026) — même recette que
 * `captures-pg-b2-fenetre-pose.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git worktree`), APRÈS sur le code livré. `data-survol` est une
 * CHAÎNE, jamais une clé typée : elle n'existe pas encore sur le code
 * d'AVANT, et `tsconfig.json` inclut `tests/`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB4-` — une intervention « À planifier »
 * survolée au-dessus de la case d'un technicien absent un MERCREDI, en vue
 * Semaine. AVANT ce ticket, rien ne distingue cette case pendant le glissé.
 * APRÈS, elle teinte en refus et affiche « Absent ».
 *
 * **À 1280 px seulement** — le glisser-déposer HTML5 n'a pas d'équivalent
 * tactile (`hidden ... lg:block` sous `lg`) : il n'existe pas de capture à
 * 375 px pour ce ticket, contrairement à PG-B2 qui offrait un bouton comme
 * substitut mobile. Le survol, lui, n'a pas de substitut au clic.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_B4 ?? "";

const CLIENT_PGB4 = uuidv7();
const SITE_PGB4 = uuidv7();
const INTERVENTION_PGB4 = uuidv7();

let reperes: ReperesDeScene;
let absenceId: string;

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
      where: { societe_id: reperes.societeId, code: "KONE" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGB4,
        societe_id: reperes.societeId,
        raison_sociale: "PGB4",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB4,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB4,
        agence_id: agence.id,
        libelle: "PGB4",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, 60, 'temps_passe', 'XPF', now())`,
      INTERVENTION_PGB4,
      reperes.societeId,
      agence.id,
      CLIENT_PGB4,
      SITE_PGB4,
    );
    const jour = jourDeLaScene(reperes, MERCREDI);
    const date = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    const absence = await client.absence.create({
      data: {
        societe_id: reperes.societeId,
        utilisateur_id: reperes.technicienKone,
        du: date,
        au: date,
      },
      select: { id: true },
    });
    absenceId = absence.id;
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.absence.deleteMany({ where: { id: absenceId } });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGB4,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB4 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB4 } });
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

test("capture — le survol de la case d'un technicien absent, à 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);

  const source = page.locator(`[data-bloc="${INTERVENTION_PGB4}"]`);
  const cible = page.locator(
    `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, MERCREDI))}"][data-depot-technicien="${reperes.technicienKone}"]`,
  );
  await expect(source).toBeVisible();
  await expect(cible).toBeVisible();

  const depart = await source.boundingBox();
  const arrivee = await cible.boundingBox();
  if (depart === null || arrivee === null) {
    throw new Error("source ou cible sans boîte visible");
  }

  await page.mouse.move(
    depart.x + depart.width / 2,
    depart.y + depart.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    arrivee.x + arrivee.width / 2,
    arrivee.y + arrivee.height / 2,
    { steps: 20 },
  );
  // Un sélecteur EN CHAÎNE (voir l'entête) : n'existe que sur le code livré.
  await page
    .waitForSelector("[data-survol]", { timeout: 2000 })
    .catch(() => null);

  await capturer(page, "survol-absent-semaine", 1280);

  await page.mouse.move(20, 20, { steps: 5 });
  await page.mouse.up();
});
