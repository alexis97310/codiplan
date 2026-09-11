import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  cleDeJour,
  jourDeLaScene,
  MARDI,
  MERCREDI,
  SAMEDI,
  SCENE,
  type ReperesDeScene,
} from "./setup/scene";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE GLISSER-DÉPOSER DU PLANNING (R2-19).
 *
 * *La maquette le prescrit depuis le premier jour — « Glisser-déposer pour
 * réaffecter », `cursor: grab` sur `.ev` — et D95 en fait une source qui FAIT
 * FOI. Ne pas l'avoir fait n'était pas un choix : c'était un manquement.*
 *
 * ## Ces quatre scénarios ont été écrits AVANT l'implémentation
 *
 * C'est la consigne, et c'est aussi ce qui les rend utiles : écrits après, ils
 * auraient décrit le code au lieu de le contraindre. Les règles de refus sont
 * tranchées avant d'être codées — dépôt hors du calendrier de l'agence VISÉE,
 * chevauchement d'un même technicien —, et chacune est éprouvée ici **à
 * travers l'écran**, c'est-à-dire à travers la route, le dépôt cloisonné et les
 * politiques.
 *
 * ## Ce qu'ils regardent que rien d'autre ne regarde
 *
 * Les scénarios d'isolation prouvent que la BASE refuse. Ils ne peuvent pas
 * prouver que **le bloc revient à sa place** ni que **le motif est nommé à
 * l'écran** — et c'est précisément ce que l'exploitation a demandé : *un bloc
 * qui revient à sa place sans explication apprend à ne plus faire confiance à
 * l'écran.*
 */

/*
 * EN SÉRIE, et c'est une décision plutôt qu'une précaution.
 *
 * Les quatre scénarios partagent UNE base et UN serveur, et le premier ÉCRIT :
 * il déplace une intervention. *Mesuré le 11/09/2026 en parallèle : deux
 * scénarios sur quatre échouaient, l'un sur un délai d'attente de 30 s pour
 * amener un bloc à l'écran — un symptôme de contention, pas de règle.* La CI
 * n'emploie déjà qu'un travailleur ; le dire ici rend l'exécution locale
 * identique à la sienne, ce qui est tout l'objet d'une porte.
 */
test.describe.configure({ mode: "serial" });

/* ── Repères communs ─────────────────────────────────────────────────────── */

let reperes: ReperesDeScene;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Le bloc d'une intervention, où qu'il soit sur l'écran. */
function bloc(page: Page, id: string): Locator {
  return page.locator(`[data-bloc="${id}"]`);
}

/**
 * LE REFUS AFFICHÉ.
 *
 * Visé par `data-refus` et non par son rôle : *Next rend lui-même un annonceur
 * de route portant `role="alert"`*, et viser le rôle seul viserait deux
 * éléments — mesuré le 11/09/2026, la bannière vide de l'annonceur passait
 * pour la nôtre.
 */
function refus(page: Page): Locator {
  return page.locator("[data-refus]");
}

/** La case d'un jour pour une personne, en vue SEMAINE. */
function caseDeSemaine(
  page: Page,
  technicienId: string,
  jourRang: number,
): Locator {
  return page.locator(
    `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, jourRang))}"][data-depot-technicien="${technicienId}"]`,
  );
}

/** La case d'une heure pour une personne, en vue JOUR. */
function caseDHeure(
  page: Page,
  technicienId: string,
  minutes: number,
): Locator {
  return page.locator(
    `[data-depot-heure="${minutes}"][data-depot-technicien="${technicienId}"]`,
  );
}

async function allerAuPlanning(page: Page, jourRang?: number): Promise<void> {
  const jour =
    jourRang === undefined ? null : cleDeJour(jourDeLaScene(reperes, jourRang));
  await page.goto(
    jour === null ? "/planning" : `/planning?vue=jour&jour=${jour}`,
  );
}

/* ── 1. UN DÉPLACEMENT ACCEPTÉ ───────────────────────────────────────────── */

test("un déplacement accepté change de jour, et la base le garde", async ({
  page,
}) => {
  await allerAuPlanning(page);

  const origine = caseDeSemaine(page, reperes.technicienKone, MARDI);
  const cible = caseDeSemaine(page, reperes.technicienKone, MERCREDI);
  // Témoin : le bloc est bien là où la scène l'a mis. Sans lui, un déplacement
  // vers une case où il se trouvait déjà passerait pour un succès.
  await expect(
    origine.locator(`[data-bloc="${SCENE.deplacable}"]`),
  ).toBeVisible();

  await glisser(page, bloc(page, SCENE.deplacable), cible);

  await expect(
    cible.locator(`[data-bloc="${SCENE.deplacable}"]`),
  ).toBeVisible();
  await expect(
    origine.locator(`[data-bloc="${SCENE.deplacable}"]`),
  ).toHaveCount(0);

  // Et la BASE l'a gardé : un rechargement complet, pas un état d'écran.
  await allerAuPlanning(page);
  await expect(
    cible.locator(`[data-bloc="${SCENE.deplacable}"]`),
  ).toBeVisible();
});

/* ── 2. UN REFUS POUR JOUR FERMÉ ─────────────────────────────────────────── */

test("un dépôt hors du calendrier de l'agence visée est refusé, et le motif est nommé", async ({
  page,
}) => {
  await allerAuPlanning(page);

  // Koné ferme le samedi ; Ducos l'ouvre. La ligne d'une personne affiche
  // l'UNION de ses agences — un repère, jamais un droit de poser.
  const cible = caseDeSemaine(page, reperes.technicienKone, SAMEDI);
  await glisser(page, bloc(page, SCENE.versSamedi), cible);

  await expect(refus(page)).toContainText(fr["intervention.refus.jour_ferme"]);
  await expect(cible.locator(`[data-bloc="${SCENE.versSamedi}"]`)).toHaveCount(
    0,
  );
});

/* ── 3. UN REFUS POUR CHEVAUCHEMENT ──────────────────────────────────────── */

test("un dépôt qui chevauche une autre intervention du même technicien est refusé", async ({
  page,
}) => {
  await allerAuPlanning(page, MARDI);

  // 08:00 est occupé par `obstacle` jusqu'à 10:00. `chevauchante` dure une
  // heure : la poser à 08:00 la ferait recouvrir l'autre.
  const cible = caseDHeure(page, reperes.technicienDucos, 8 * 60);
  await glisser(page, bloc(page, SCENE.chevauchante), cible);

  await expect(refus(page)).toContainText(
    fr["intervention.refus.chevauchement"],
  );
});

/* ── 4. LE RETOUR À LA POSITION D'ORIGINE ────────────────────────────────── */

test("après un refus, le bloc est à sa place d'origine — y compris après rechargement", async ({
  page,
}) => {
  await allerAuPlanning(page, MARDI);

  const origine = caseDHeure(page, reperes.technicienDucos, 13 * 60);
  await expect(
    origine.locator(`[data-bloc="${SCENE.chevauchante}"]`),
  ).toBeVisible();

  await glisser(
    page,
    bloc(page, SCENE.chevauchante),
    caseDHeure(page, reperes.technicienDucos, 8 * 60),
  );

  // *Jamais d'écran qui montre un état que la base n'a pas accepté.* Le bloc
  // n'a pas bougé — et il n'a pas bougé non plus dans la base, ce que seul un
  // rechargement complet peut dire.
  await expect(
    origine.locator(`[data-bloc="${SCENE.chevauchante}"]`),
  ).toBeVisible();
  await allerAuPlanning(page, MARDI);
  await expect(
    origine.locator(`[data-bloc="${SCENE.chevauchante}"]`),
  ).toBeVisible();
});
