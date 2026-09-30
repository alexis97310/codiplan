import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  cleDeJour,
  jourDeLaScene,
  MARDI,
  type ReperesDeScene,
} from "./setup/scene";
import {
  poserInterventionGlisser,
  retirerInterventionGlisser,
} from "./setup/scene-glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES — 9CF-PG-G11-JOUR-FRISE (QG-3/D142, 30/09/2026).
 *
 * SA PROPRE SCÈNE (I9) : deux interventions posées sur Koné, MARDI — une
 * avec créneau, une SANS heure (`debut: null`) pour montrer la ligne
 * « Journée — heure non fixée » — retirées en `afterAll`. Aucune fixture
 * `SCENE.*` partagée, aucune donnée réelle.
 *
 * **APRÈS SEULEMENT dans cette exécution** — voir `README.md` du dossier de
 * captures pour la recette AVANT (git worktree sur le commit mesuré avant ce
 * ticket), non rejouée ici faute de temps (passation, « ce que je n'ai pas
 * fait »).
 */

test.describe.configure({ mode: "serial" });

let reperes: ReperesDeScene;
let interventionAvecCreneau = "";
let interventionSansHeure = "";

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  interventionAvecCreneau = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut: 8 * 60,
    duree: 90,
  });
  interventionSansHeure = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut: null,
    duree: 60,
  });
});

test.afterAll(async () => {
  if (interventionAvecCreneau !== "") {
    await retirerInterventionGlisser(interventionAvecCreneau);
  }
  if (interventionSansHeure !== "") {
    await retirerInterventionGlisser(interventionSansHeure);
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9CF-PG-G11-JOUR-FRISE/captures",
);

const LARGEURS = [
  { nom: "1280", largeur: 1280, hauteur: 1000 },
  { nom: "1024", largeur: 1024, hauteur: 1000 },
  { nom: "375", largeur: 375, hauteur: 900 },
] as const;

test("photographie la frise — blocs et ligne sans heure", async ({ page }) => {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });

  await expect
    .poll(async () => {
      await page.goto(
        `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, MARDI))}`,
      );
      return page.locator('[data-maquette-bloc="vue-jour"]').count();
    })
    .toBeGreaterThan(0);

  for (const { nom, largeur, hauteur } of LARGEURS) {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto(
      `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, MARDI))}`,
    );
    await expect(
      page
        .locator(`[data-tiroir-declencheur="${interventionAvecCreneau}"]`)
        .first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-maquette-bloc="ligne-jour-sans-heure"]'),
    ).toBeVisible();
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `jour-frise-apres-${nom}.png`),
      fullPage: true,
    });
  }
});

test("photographie le blocage d'agenda dans la frise (Weber, jeudi — donnée de démonstration du semis)", async ({
  page,
}) => {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, 3))}`,
  );
  const pastille = page.locator("th [data-agenda-bloque]");
  if ((await pastille.count()) === 0) {
    // Le semis n'a pas placé le blocage sur ce rang précis cette
    // semaine-là (dépend de la date réelle d'exécution) : ce n'est pas une
    // erreur, juste une capture qu'aucune donnée ne permet cette fois-ci.
    return;
  }
  await expect(pastille.first()).toBeVisible();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "jour-frise-agenda-bloque-apres-1280.png"),
    fullPage: true,
  });
});
