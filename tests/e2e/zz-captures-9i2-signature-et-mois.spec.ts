import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MARDI,
  MOT_DE_PASSE_EPREUVE,
  cleDeJour,
  jourDeLaScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS — AVANT/APRÈS, même
 * recette que `zz-captures-9g5-terrain-ergonomie.spec.ts` : lancé une fois
 * sur le commit d'avant ce lot (AVANT), une fois sur le code livré (APRÈS).
 * Captures en VIEWPORT (jamais `fullPage`).
 *
 * DEUX ÉCRANS : la signature tracée (375 px, DPR 3 — le point 1) et la vue
 * Mois défilée jusqu'à ce que le badge d'une case chevauche la colonne figée
 * (375 et 1280 px — le point 2).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I2 ?? "";
const PHASE = process.env.CAPTURES_9I2_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: false,
  });
}

const RANG_SEMAINES = 46;
const CLIENT_9I2 = uuidv7();
const SITE_9I2 = uuidv7();
const INTERVENTION_9I2 = uuidv7();
const LIBELLE_SITE = "9I2-site-capture";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9I2,
        societe_id: reperes.societeId,
        raison_sociale: "9I2-client-capture",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I2,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9I2,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_9I2,
        site_id: SITE_9I2,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 9 * 60, reperes.fuseau),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9I2,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_9I2 } });
    await client.site.deleteMany({ where: { id: SITE_9I2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9I2 } });
  } finally {
    await client.$disconnect();
  }
});

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("capture — signature tracée, 375 px, DPR 3", async ({ browser }) => {
  const contexte = await browser.newContext({
    viewport: { width: 375, height: 800 },
    deviceScaleFactor: 3,
  });
  const page = await contexte.newPage();
  try {
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_9I2}`);
    await page
      .getByRole("button", { name: fr["terrain.signature.option_signee"] })
      .click();
    await page
      .getByLabel(fr["terrain.signature.nom_libelle"])
      .fill(fr["terrain.e2e.signataire_nom"]);

    await page.locator("canvas").evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      const envoyer = (type: string, x: number, y: number): void => {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: rectangle.left + x,
            clientY: rectangle.top + y,
            pointerId: 1,
          }),
        );
      };
      envoyer("pointerdown", 15, 100);
      envoyer("pointermove", 60, 20);
      envoyer("pointermove", 120, 100);
      envoyer("pointermove", 180, 20);
      envoyer("pointermove", 240, 100);
      envoyer("pointerup", 240, 100);
    });
    await page
      .locator("canvas")
      .evaluate((element) => element.scrollIntoView({ block: "center" }));
    await capturer(page, "signature", 375);
  } finally {
    await contexte.close();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — vue Mois défilée, badge contre la colonne figée, à ${largeur}px`, async ({
    page,
  }) => {
    const reperes = await reperesDeLaScene();
    const jourMardi = jourDeLaScene(reperes, MARDI);
    const cleMardi = cleDeJour(jourMardi);

    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto(`/planning?vue=mois&jour=${cleMardi}`);

    const cellule = page.locator(
      `[data-mois-jour="${cleMardi}"][data-mois-technicien="${reperes.technicienDucos}"]`,
    );
    await expect(cellule).toBeVisible();
    const badge = cellule.locator('[class*="z-10"]');
    await expect(badge).toBeVisible();

    await page.evaluate(
      ({ jourCle, technicienId }) => {
        const table = document.querySelector(
          '[data-maquette-bloc="tableau-mois"]',
        );
        if (table === null) {
          throw new Error("tableau absent");
        }
        const lien = table.querySelector(
          `[data-mois-jour="${jourCle}"][data-mois-technicien="${technicienId}"]`,
        );
        const badgeInterne = lien?.querySelector('[class*="z-10"]');
        const ligne = lien?.closest("tr");
        const colonneFigee = ligne?.querySelector("td.sticky");
        const conteneur = table.closest(".overflow-x-auto");
        if (
          lien === null ||
          lien === undefined ||
          badgeInterne === null ||
          badgeInterne === undefined ||
          colonneFigee === null ||
          colonneFigee === undefined ||
          conteneur === null ||
          conteneur === undefined
        ) {
          throw new Error("structure attendue absente");
        }
        const rectFigee = colonneFigee.getBoundingClientRect();
        const rectBadge = badgeInterne.getBoundingClientRect();
        const cibleX = rectFigee.left + rectFigee.width / 2;
        const delta = rectBadge.left + rectBadge.width / 2 - cibleX;
        (conteneur as HTMLElement).scrollLeft += delta;
      },
      { jourCle: cleMardi, technicienId: reperes.technicienDucos },
    );

    // LE TABLEAU N'EST PAS FORCÉMENT DANS LE PREMIER ÉCRAN (les filtres et
    // le bandeau d'information au-dessus repoussent la grille sous la ligne
    // de flottaison à 375 px) — `toBeVisible` ne l'exige pas, une capture
    // VIEWPORT si.
    await cellule.evaluate((element) =>
      // `inline: "nearest"` — jamais de défaut : la cible est déjà dans la
      // fenêtre HORIZONTALE du cadre défilant (c'est tout le but du calcul
      // ci-dessus), et un défilement horizontal implicite l'annulerait.
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    await capturer(page, "mois-colonne-figee", largeur);
  });
}
