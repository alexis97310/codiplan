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
 * LES CAPTURES DE PG-B5-ANNULER-DEPLACEMENT (29/09/2026, décision QG-6
 * d'Alexis du 27/09) — même recette que
 * `captures-pg-a7-semaine-garde-heure.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git stash`, le dernier commit livré), APRÈS sur le code livré.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB5-` — une intervention 15:30–16:30 un MARDI
 * (le créneau que PG-A7 a mesuré libre de tout chevauchement avec les
 * interventions de démonstration, à la fois le MARDI et le MERCREDI, pour le
 * même technicien de DUCOS), glissée vers le MERCREDI suivant en vue Semaine.
 *
 * AVANT ce ticket, le dépôt écrit tout de suite : la capture, prise après
 * que le bloc soit visible sur sa nouvelle case, ne montre aucun bandeau.
 * APRÈS ce ticket, le dépôt DIFFÈRE l'écriture de 10 s : la capture, prise
 * dès que le bandeau apparaît, montre « Déplacée … · Annuler » sur la case
 * visée, et l'ancienne case vide.
 *
 * `[data-deplacement-en-attente]` est une CHAÎNE, jamais une clé typée du
 * dictionnaire — elle n'existe pas encore sur le code d'AVANT, et
 * `tsconfig.json` inclut `tests/` (le build type-vérifie ce fichier sur
 * l'ancien code aussi).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_B5 ?? "";

const CLIENT_PGB5 = uuidv7();
const SITE_PGB5 = uuidv7();
const INTERVENTION_PGB5 = uuidv7();

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
        id: CLIENT_PGB5,
        societe_id: reperes.societeId,
        raison_sociale: "PGB5",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB5,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB5,
        agence_id: agence.id,
        libelle: "PGB5",
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
      INTERVENTION_PGB5,
      reperes.societeId,
      agence.id,
      CLIENT_PGB5,
      SITE_PGB5,
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
      CLIENT_PGB5,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB5 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB5 } });
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
 * LE DÉPÔT NE SE FAIT QU'À 1280 px — même note que PG-A7 : la grille
 * glissable est `hidden ... lg:block`, et `ListeSemaine` (la liste mobile)
 * n'utilise PAS `BlocPosable` — aucune case de dépôt, donc aucun bandeau
 * possible sous `lg`. La capture à 375 px relit donc l'état D'ORIGINE, en
 * lecture seule, jamais celui d'un dépôt qui n'a pas pu avoir lieu à cette
 * largeur.
 */
test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — l'état de la case visée juste après le dépôt, en vue Semaine, à 1280px", async ({
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
      page.locator(`[data-bloc="${INTERVENTION_PGB5}"]`),
      cible,
    );
    // SUR LE CODE D'AVANT : le bloc est déjà à sa nouvelle place (écriture
    // immédiate). SUR LE CODE D'APRÈS : le bandeau différé y est apparu à sa
    // place — l'un des deux locators résout, jamais les deux à la fois.
    await expect(
      cible.locator(
        `[data-bloc="${INTERVENTION_PGB5}"], [data-deplacement-en-attente="${INTERVENTION_PGB5}"]`,
      ),
    ).toBeVisible();
    await capturer(page, "case-visee-apres-depot-semaine", 1280);
  });
});

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la liste mobile, hors de portée du dépôt (aucun bandeau possible sous `lg`), à 375px", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    await expect(
      page.locator(`[data-carte-liste="${INTERVENTION_PGB5}"]`),
    ).toBeVisible();
    await capturer(page, "case-visee-apres-depot-semaine", 375);
  });
});
