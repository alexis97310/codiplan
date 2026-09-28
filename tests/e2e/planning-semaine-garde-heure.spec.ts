import { expect, test } from "@playwright/test";

import { MARDI, MERCREDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { glisser } from "./setup/glisser";
import {
  poserInterventionGlisser,
  retirerInterventionGlisser,
} from "./setup/scene-glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";
import type { ReperesDeScene } from "./setup/scene";

/**
 * PG-A7-SEMAINE-GARDE-HEURE (28/09/2026, audit d'ergonomie du 27/09, bug 9 ;
 * décision QG-4 d'Alexis du 27/09 : une intervention planifiée garde une
 * heure).
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * En vue SEMAINE, une case ne porte pas de minutes (`cible.minutes === null`,
 * `app/(back-office)/planning/page.tsx`). `components/planning/pose.tsx`
 * n'envoyait alors NI `heure_debut` NI `duree_min` — `demandeDeDeplacement`
 * (`lib/interventions/depot.ts`) traitait les deux comme absents et écrivait
 * `creneau_debut`/`creneau_fin` à NULL : une intervention planifiée à 08:00,
 * déplacée d'un jour à l'autre en vue Semaine, perdait son heure ET sa durée
 * sans que personne ne l'ait décidé.
 *
 * SA PROPRE intervention, 15:30–16:30 un MARDI (un créneau de l'après-midi
 * libre de tout chevauchement avec les interventions de démonstration du
 * technicien, mesuré en base), glissée vers le MERCREDI suivant (tous deux
 * ouverts à DUCOS) — créée et supprimée par ce fichier, jamais une fixture
 * `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

let reperes: ReperesDeScene;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("un déplacement en vue Semaine garde l'heure et la durée de l'intervention déplacée", async ({
  page,
}) => {
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 15 * 60 + 30,
    duree: 60,
  });
  try {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const origine = page.locator(
      `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, MARDI))}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    const cible = page.locator(
      `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, MERCREDI))}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    await glisser(page, page.locator(`[data-bloc="${id}"]`), cible);

    // UN DÉPLACEMENT DIRECT N'ÉCRIT PLUS TOUT DE SUITE DEPUIS
    // PG-B5-ANNULER-DEPLACEMENT (délai fixe de 10 s, décision QG-6 d'Alexis du
    // 27/09/2026) : le bandeau « Déplacée … · Annuler » de la case visée
    // remplace l'ancienne attente immédiate, et ce test n'éprouve pas cette
    // fenêtre-là (voir `planning-annuler-deplacement.spec.ts`) — il attend
    // l'échéance pour retrouver le comportement qu'il mesure.
    await expect(cible.locator("[data-deplacement-en-attente]")).toBeVisible();
    // `waitForResponse`, pas un simple délai : l'écriture ACCEPTÉE déclenche
    // un rechargement complet (`window.location.assign`, voir
    // `Posable.deposer`), et un délai fixe pourrait vérifier le DOM avant que
    // ce rechargement n'ait eu lieu.
    await page.waitForResponse(
      (reponse) =>
        reponse.request().method() === "POST" &&
        reponse.url().includes("/deplacer"),
      { timeout: 15_000 },
    );
    await page.waitForLoadState("load");

    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await expect(origine.locator(`[data-bloc="${id}"]`)).toHaveCount(0);

    // LA BASE A GARDÉ L'HEURE ET LA DURÉE — relu depuis la fiche, sur un
    // rechargement complet, jamais un état d'écran (99S-GR4-DEPLACER).
    await page.goto(`/interventions/${id}`);
    await expect(page.locator('input[name="date_planifiee"]')).toHaveValue(
      cleDeJour(jourDeLaScene(reperes, MERCREDI)),
    );
    await expect(page.locator('input[name="heure_debut"]')).toHaveValue(
      "15:30",
    );
    await expect(page.locator('input[name="duree_min"]')).toHaveValue("60");
  } finally {
    await retirerInterventionGlisser(id);
  }
});
