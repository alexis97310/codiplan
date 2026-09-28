import { expect, test, type Page } from "@playwright/test";

import {
  MARDI,
  MERCREDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { glisser } from "./setup/glisser";
import {
  poserInterventionGlisser,
  retirerInterventionGlisser,
} from "./setup/scene-glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-B5-ANNULER-DEPLACEMENT (décision QG-6 d'Alexis du 27/09/2026) — un
 * déplacement DIRECT d'une carte déjà planifiée n'écrit plus tout de suite :
 * il attend 10 s, pendant lesquelles « Annuler » revient en arrière SANS
 * AUCUNE REQUÊTE, pour que le client ne reçoive jamais deux courriels pour un
 * seul geste (`avertirApresPlanification`, `lib/avertissements/planification.ts`,
 * AVERTISSEMENTS-1).
 *
 * ## Le mécanisme éprouvé ici — voir `components/planning/pose.tsx`
 *
 * `Posable.deposer` retarde l'ÉCRITURE elle-même : pendant le délai, la carte
 * s'efface de son ancienne case (`BlocPosable`) et un bandeau
 * `[data-deplacement-en-attente]` apparaît sur la case VISÉE
 * (`CasePosable`), avec `[data-annuler-deplacement]`. Les scénarios existants
 * de `glisser-deposer.spec.ts` et `planning-semaine-garde-heure.spec.ts`
 * éprouvent déjà l'état APRÈS l'échéance ; ce fichier-ci est le seul à
 * éprouver la FENÊTRE D'ATTENTE — l'annulation, et l'absence de toute
 * requête pendant que la carte y est affichée.
 *
 * SA PROPRE intervention, posée et retirée par chaque scénario
 * (`poserInterventionGlisser`/`retirerInterventionGlisser`) — jamais une
 * fixture `SCENE.*` partagée (même raison que les fichiers voisins).
 */
test.describe.configure({ mode: "serial" });

/** Le délai fixe de PG-B5 (QG-6, 27/09/2026), plus une marge de mesure. */
const DELAI_DEPLACEMENT_MS = 10_000;
const MARGE_MS = 1_000;

let reperes: ReperesDeScene;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

function caseDeSemaine(page: Page, technicienId: string, jourRang: number) {
  return page.locator(
    `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, jourRang))}"][data-depot-technicien="${technicienId}"]`,
  );
}

test("« Annuler », pendant le délai, remet la carte en place sans aucune requête", async ({
  page,
}) => {
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 9 * 60,
    duree: 60,
  });
  try {
    let requetesDeplacer = 0;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        requetesDeplacer += 1;
      }
    });

    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const origine = caseDeSemaine(page, reperes.technicienDucos, MARDI);
    const cible = caseDeSemaine(page, reperes.technicienDucos, MERCREDI);
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    await glisser(page, page.locator(`[data-bloc="${id}"]`), cible);

    // PENDANT LE DÉLAI : la carte s'est effacée de son ANCIENNE case, et le
    // bandeau « Annuler » est apparu sur la case VISÉE — sans qu'aucune
    // requête ne soit partie.
    await expect(origine.locator(`[data-bloc="${id}"]`)).toHaveCount(0);
    const bandeau = cible.locator(`[data-deplacement-en-attente="${id}"]`);
    await expect(bandeau).toBeVisible();
    expect(requetesDeplacer).toBe(0);

    await cible.locator(`[data-annuler-deplacement="${id}"]`).click();

    // ANNULÉ : la carte est DE RETOUR à sa place, le bandeau a disparu — et
    // rien de tout cela n'est passé par une requête.
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await expect(bandeau).toHaveCount(0);
    expect(requetesDeplacer).toBe(0);

    // ET L'ÉCHÉANCE, UNE FOIS PASSÉE, NE RESSUSCITE RIEN : l'annulation a
    // bien effacé la minuterie, pas seulement le bandeau affiché.
    await page.waitForTimeout(DELAI_DEPLACEMENT_MS + MARGE_MS);
    expect(requetesDeplacer).toBe(0);
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();
  } finally {
    await retirerInterventionGlisser(id);
  }
});

test("sans annulation, une seule requête part à l'échéance, et l'état final s'écrit", async ({
  page,
}) => {
  // 15:30–16:30, PAS UNE AUTRE HEURE : c'est le créneau que
  // `planning-semaine-garde-heure.spec.ts` a mesuré libre de tout
  // chevauchement avec les interventions de démonstration du technicien, à
  // la fois le MARDI (origine) et le MERCREDI (destination, l'heure étant
  // conservée par PG-A7). Un autre créneau a été tiré au hasard une première
  // fois (10:00) et refusé par un chevauchement de démonstration réel — voir
  // la mesure du 29/09/2026 dans la passation du lot.
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 15 * 60 + 30,
    duree: 60,
  });
  try {
    let requetesDeplacer = 0;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        requetesDeplacer += 1;
      }
    });

    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const origine = caseDeSemaine(page, reperes.technicienDucos, MARDI);
    const cible = caseDeSemaine(page, reperes.technicienDucos, MERCREDI);
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    await glisser(page, page.locator(`[data-bloc="${id}"]`), cible);

    await expect(
      cible.locator(`[data-deplacement-en-attente="${id}"]`),
    ).toBeVisible();
    expect(requetesDeplacer).toBe(0);

    // AUCUNE ACTION — l'échéance seule écrit. `waitForResponse`, pas un
    // simple délai : l'écriture ACCEPTÉE déclenche un rechargement complet
    // (`window.location.assign`, voir `Posable.deposer`), et un délai fixe
    // pourrait vérifier le DOM avant que ce rechargement n'ait eu lieu.
    await page.waitForResponse(
      (reponse) =>
        reponse.request().method() === "POST" &&
        reponse.url().includes("/deplacer"),
      { timeout: DELAI_DEPLACEMENT_MS + MARGE_MS + 5_000 },
    );
    expect(requetesDeplacer).toBe(1);
    await page.waitForLoadState("load");

    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await expect(origine.locator(`[data-bloc="${id}"]`)).toHaveCount(0);

    // Et la BASE l'a gardé, ce que seul un rechargement complet peut dire.
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
  } finally {
    await retirerInterventionGlisser(id);
  }
});
