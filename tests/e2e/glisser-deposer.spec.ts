import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  cleDeJour,
  jourDeLaScene,
  MARDI,
  MERCREDI,
  SAMEDI,
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
 *
 * ## SA PROPRE SCÈNE, PAR SCÉNARIO (99XA-STAB-GLISSER, deuxième rouge)
 *
 * Chaque test posait autrefois sur `SCENE.glissable` / `SCENE.chevauchante` /
 * `SCENE.obstacle` — des lignes écrites UNE FOIS par la préparation globale.
 * Le premier scénario DÉPLACE réellement un bloc et le laisse à sa nouvelle
 * place : une mutation permanente qu'aucune seconde exécution du fichier ne
 * retrouve à son point de départ. *Mesuré le 27/09/2026
 * (`--repeat-each=5`) : la deuxième répétition échouait déjà sur le témoin
 * d'origine* — et une reprise CI du mode `serial` (un échec plus loin dans le
 * fichier rejoue TOUT depuis le premier test) produit exactement le même
 * symptôme, observé le 26/09 par 99T. Chaque scénario pose désormais SA
 * PROPRE intervention avec `poserInterventionGlisser` (identifiant tiré au
 * sort à l'appel, jamais fixe) et la retire avec `retirerInterventionGlisser`
 * dans un `finally` — une reprise, comme une répétition, repart d'un état
 * vierge. Voir `tests/e2e/setup/scene-glisser.ts`.
 */

/*
 * EN SÉRIE, et c'est une décision plutôt qu'une précaution.
 *
 * Les scénarios partagent UN serveur, et certains déplacent réellement un
 * bloc. *Mesuré le 11/09/2026 en parallèle : deux scénarios sur quatre
 * échouaient, l'un sur un délai d'attente de 30 s pour amener un bloc à
 * l'écran — un symptôme de contention, pas de règle.* La CI n'emploie déjà
 * qu'un travailleur ; le dire ici rend l'exécution locale identique à la
 * sienne, ce qui est tout l'objet d'une porte.
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

/**
 * VERS LE PLANNING — la vue SEMAINE de `reperes`, jamais la vue par DÉFAUT
 * (mesuré le 20/09/2026, CI #817).
 *
 * `allerAuPlanning(page)` visait `/planning` nu, en confiant à l'écran le
 * choix de « la semaine courante » — exactement celle que `reperesDeLaScene`
 * a calculée, ELLE, dans un PROCESSUS SÉPARÉ (la préparation globale, voir
 * `setup/reperes.ts`). *Les deux lectures de « maintenant » sont indépendantes
 * et n'ont aucune raison de tomber le même jour civil* — la scène est écrite
 * une fois, en tête de suite ; ce fichier peut s'exécuter, lui, bien après,
 * une fois la ligne de changement de semaine franchie. Mesuré : le scénario
 * cherchait `[data-depot-jour="2026-09-15"]` — la semaine que `reperes`
 * avait calculée — sur un écran par défaut qui en montrait une autre.
 *
 * La cible ne change pas : c'est toujours `reperes.lundi`, qui a servi à
 * ÉCRIRE la scène. Ce qui change est que le test le DIT à l'écran au lieu de
 * compter sur le fait qu'il coïncide avec « aujourd'hui » — jamais un calcul
 * depuis la date du jour, une simple lecture d'une valeur déjà connue.
 */
async function allerAuPlanning(page: Page, jourRang?: number): Promise<void> {
  if (jourRang === undefined) {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );
    return;
  }
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, jourRang))}`,
  );
}

/* ── 1. UN DÉPLACEMENT ACCEPTÉ ───────────────────────────────────────────── */

test("un déplacement accepté change de jour, et la base le garde", async ({
  page,
}) => {
  // SA PROPRE intervention, MARDI, sans créneau — jamais `SCENE.glissable` :
  // ce scénario DÉPLACE réellement un bloc et le laisse à sa nouvelle place,
  // une mutation qu'aucune fixture partagée ne peut supporter deux fois.
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut: null,
    duree: 120,
  });
  try {
    await allerAuPlanning(page);

    const origine = caseDeSemaine(page, reperes.technicienKone, MARDI);
    const cible = caseDeSemaine(page, reperes.technicienKone, MERCREDI);
    // Témoin : le bloc est bien là où il vient d'être posé. Sans lui, un
    // déplacement vers une case où il se trouvait déjà passerait pour un
    // succès.
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    await glisser(page, bloc(page, id), cible);

    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await expect(origine.locator(`[data-bloc="${id}"]`)).toHaveCount(0);

    // Et la BASE l'a gardé : un rechargement complet, pas un état d'écran.
    await allerAuPlanning(page);
    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
  } finally {
    await retirerInterventionGlisser(id);
  }
});

/* ── 2. UN REFUS POUR JOUR FERMÉ ─────────────────────────────────────────── */

test("un dépôt hors du calendrier de l'agence visée est refusé, et le motif est nommé", async ({
  page,
}) => {
  // Koné ferme le samedi ; Ducos l'ouvre. La ligne d'une personne affiche
  // l'UNION de ses agences — un repère, jamais un droit de poser.
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MERCREDI,
    debut: null,
    duree: 120,
  });
  try {
    await allerAuPlanning(page);

    const cible = caseDeSemaine(page, reperes.technicienKone, SAMEDI);
    await glisser(page, bloc(page, id), cible);

    await expect(refus(page)).toContainText(
      fr["intervention.refus.jour_ferme"],
    );
    await expect(cible.locator(`[data-bloc="${id}"]`)).toHaveCount(0);
  } finally {
    await retirerInterventionGlisser(id);
  }
});

/* ── 3. UN REFUS POUR CHEVAUCHEMENT ──────────────────────────────────────── */

test("un dépôt qui chevauche une autre intervention du même technicien est refusé", async ({
  page,
}) => {
  // SON PROPRE obstacle, 08:00–10:00 : « si un scénario a besoin d'un
  // obstacle, il le crée lui-même » (99XA-STAB-GLISSER).
  const obstacleId = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 8 * 60,
    duree: 120,
  });
  const chevauchanteId = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 13 * 60,
    duree: 60,
  });
  try {
    await allerAuPlanning(page, MARDI);

    // 08:00 est occupé par l'obstacle jusqu'à 10:00. La chevauchante dure une
    // heure : la poser à 08:00 la ferait recouvrir l'autre.
    const cible = caseDHeure(page, reperes.technicienDucos, 8 * 60);
    await glisser(page, bloc(page, chevauchanteId), cible);

    await expect(refus(page)).toContainText(
      fr["intervention.refus.chevauchement"],
    );
  } finally {
    await retirerInterventionGlisser(chevauchanteId);
    await retirerInterventionGlisser(obstacleId);
  }
});

/* ── 3 bis. UNE ERREUR SERVEUR ───────────────────────────────────────────── */

/**
 * LES DEUX ISSUES TECHNIQUES (D-06, 17/09/2026) — interceptées au réseau.
 *
 * *Ni la base ni la route ne peuvent produire ces deux réponses-là* : la
 * route de `/api/interventions/[id]/deplacer` répond toujours `200` avec un
 * corps `{accepte, cle, avertissements}` — une erreur serveur réelle ou une
 * coupure réseau ne s'obtiennent qu'en interceptant la requête elle-même.
 * `tests/unit/planning/pose.test.tsx` éprouve la même distinction sans
 * navigateur ; ceci l'éprouve à travers l'écran RÉEL, la seule façon de
 * montrer que le refus s'affiche bien au bon endroit et n'empêche pas un
 * dépôt suivant.
 *
 * L'interception est posée AVANT la navigation, et un compteur vérifie
 * qu'elle a bien intercepté EXACTEMENT une requête — sans ce compteur, une
 * interception qui rate silencieusement laisse la requête réelle atteindre la
 * route, et le refus observé porte alors un tout autre motif que celui
 * attendu (mesuré par 99T le 26/09/2026 : « chevauchement » reçu à la place
 * d'« erreur_serveur »). Le compteur transforme un symptôme déroutant en un
 * défaut nommé.
 */
test("une erreur serveur affiche un message qui invite à réessayer, jamais une réussite", async ({
  page,
}) => {
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 13 * 60,
    duree: 60,
  });
  try {
    let intercepte = 0;
    await page.route("**/api/interventions/*/deplacer", (route) => {
      intercepte += 1;
      return route.fulfill({ status: 500, body: "" });
    });

    await allerAuPlanning(page, MARDI);

    const debut = caseDHeure(page, reperes.technicienDucos, 13 * 60);
    await expect(debut.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await glisser(
      page,
      bloc(page, id),
      caseDHeure(page, reperes.technicienDucos, 9 * 60),
    );

    await expect(refus(page)).toContainText(
      fr["intervention.refus.erreur_serveur"],
    );
    // Rien n'a bougé À L'ÉCRAN : la route n'a jamais été jointe.
    await expect(debut.locator(`[data-bloc="${id}"]`)).toBeVisible();
    expect(intercepte).toBe(1);
  } finally {
    await retirerInterventionGlisser(id);
  }
});

/* ── 3 ter. UNE CONNEXION INTERROMPUE ────────────────────────────────────── */

test("une connexion interrompue affiche un message qui invite à regarder ailleurs, jamais une réussite", async ({
  page,
}) => {
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 13 * 60,
    duree: 60,
  });
  try {
    let intercepte = 0;
    // `route.abort()` fait échouer la requête au niveau RÉSEAU, avant toute
    // réponse : c'est ce qu'une coupure réelle produit, et c'est distinct d'un
    // code d'erreur — le motif affiché doit l'être aussi.
    await page.route("**/api/interventions/*/deplacer", (route) => {
      intercepte += 1;
      return route.abort("failed");
    });

    await allerAuPlanning(page, MARDI);

    const debut = caseDHeure(page, reperes.technicienDucos, 13 * 60);
    await glisser(
      page,
      bloc(page, id),
      caseDHeure(page, reperes.technicienDucos, 10 * 60),
    );

    await expect(refus(page)).toContainText(
      fr["intervention.refus.connexion_interrompue"],
    );
    // Rien n'a bougé — ni à l'écran, ni en base : la requête n'a jamais
    // abouti.
    await expect(debut.locator(`[data-bloc="${id}"]`)).toBeVisible();
    expect(intercepte).toBe(1);
  } finally {
    await retirerInterventionGlisser(id);
  }
});

/* ── 4. LE RETOUR À LA POSITION D'ORIGINE ────────────────────────────────── */

test("après un refus, le bloc est à sa place d'origine — y compris après rechargement", async ({
  page,
}) => {
  const obstacleId = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 8 * 60,
    duree: 120,
  });
  const chevauchanteId = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut: 13 * 60,
    duree: 60,
  });
  try {
    await allerAuPlanning(page, MARDI);

    const origine = caseDHeure(page, reperes.technicienDucos, 13 * 60);
    await expect(
      origine.locator(`[data-bloc="${chevauchanteId}"]`),
    ).toBeVisible();

    await glisser(
      page,
      bloc(page, chevauchanteId),
      caseDHeure(page, reperes.technicienDucos, 8 * 60),
    );

    // *Jamais d'écran qui montre un état que la base n'a pas accepté.* Le bloc
    // n'a pas bougé — et il n'a pas bougé non plus dans la base, ce que seul
    // un rechargement complet peut dire.
    await expect(
      origine.locator(`[data-bloc="${chevauchanteId}"]`),
    ).toBeVisible();
    await allerAuPlanning(page, MARDI);
    await expect(
      origine.locator(`[data-bloc="${chevauchanteId}"]`),
    ).toBeVisible();
  } finally {
    await retirerInterventionGlisser(chevauchanteId);
    await retirerInterventionGlisser(obstacleId);
  }
});

/* ── 5. LE REDIMENSIONNEMENT ─────────────────────────────────────────────── */

/** La poignée de redimensionnement d'un bloc. */
function poignee(page: Page, id: string): Locator {
  return page.locator(`[data-poignee="${id}"]`);
}

/** Le lien d'une intervention dans une case d'heure — bloc ou SUITE de bloc. */
function occupe(page: Page, technicienId: string, minutes: number, id: string) {
  return caseDHeure(page, technicienId, minutes).locator(
    `a[href="/interventions/${id}"]`,
  );
}

test("la poignée ALLONGE une intervention, et la base le garde", async ({
  page,
}) => {
  // L3-01b. *Le redimensionnement était la seule pièce de L3-01 que le
  // planning n'avait pas* — le glisser-déposer et la vue ressources existent
  // depuis R2-12 et R2-19.
  //
  // SA PROPRE intervention — jamais `SCENE.redimensionnable` : ce scénario
  // ALLONGE l'intervention et la garde allongée, une mutation permanente
  // qu'aucune fixture partagée ne peut supporter deux fois.
  const debut = 14 * 60;
  const apres = 15 * 60;
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut,
    duree: 60,
  });
  try {
    await allerAuPlanning(page, MARDI);

    // TÉMOIN : l'intervention dure une heure, donc la case de 15 h ne lui
    // appartient pas. *Sans lui, un allongement vers une case déjà occupée par
    // elle passerait pour un succès.*
    await expect(
      occupe(page, reperes.technicienDucos, debut, id),
    ).toBeVisible();
    await expect(occupe(page, reperes.technicienDucos, apres, id)).toHaveCount(
      0,
    );

    await glisser(
      page,
      poignee(page, id),
      caseDHeure(page, reperes.technicienDucos, apres),
    );

    // L'ÉCRAN D'ABORD, LA BASE ENSUITE — et cet ordre est une leçon, pas une
    // préférence.
    //
    // *Mesuré le 11/09/2026 : recharger tout de suite après le geste faisait
    // échouer le scénario alors que le mécanisme était juste.* Le dépôt ne
    // bloque pas sur sa requête — `glisser` rend la main dès le `mouseup` —,
    // si bien que le `page.goto` partait pendant que le `POST` était en vol et
    // l'annulait. **Le symptôme était celui d'une règle fausse ; la cause
    // était le geste du scénario**, et seule la trace des requêtes l'a dit :
    // la route répondait `{"accepte":true}` quand on lui en laissait le
    // temps.
    //
    // Une assertion d'écran réessaie ; une navigation, non. On attend donc que
    // l'écran se soit relu du serveur — ce qui prouve au passage que la case
    // visée lui appartient — AVANT de recharger pour interroger la base.
    await expect(
      occupe(page, reperes.technicienDucos, apres, id),
    ).toBeVisible();

    // Et la BASE l'a gardé, ce que seul un rechargement complet peut dire.
    await allerAuPlanning(page, MARDI);
    await expect(
      occupe(page, reperes.technicienDucos, apres, id),
    ).toBeVisible();
    await expect(
      occupe(page, reperes.technicienDucos, debut, id),
    ).toBeVisible();
  } finally {
    await retirerInterventionGlisser(id);
  }
});

test("tirer la poignée AU-DESSUS du début est refusé, et le motif est nommé", async ({
  page,
}) => {
  // *Une intervention dure au moins un créneau.* Le refus vient du serveur —
  // la durée calculée est négative, et le schéma de saisie la refuse — et il
  // NOMME la durée plutôt que de dire « intervention inconnue ».
  const debut = 13 * 60;
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "DUCOS",
    technicienId: reperes.technicienDucos,
    rang: MARDI,
    debut,
    duree: 60,
  });
  try {
    await allerAuPlanning(page, MARDI);

    await expect(
      occupe(page, reperes.technicienDucos, debut, id),
    ).toBeVisible();

    await glisser(
      page,
      poignee(page, id),
      caseDHeure(page, reperes.technicienDucos, 11 * 60),
    );

    await expect(refus(page)).toBeVisible();

    // Et rien n'a bougé, ni à l'écran ni dans la base.
    await allerAuPlanning(page, MARDI);
    await expect(
      occupe(page, reperes.technicienDucos, debut, id),
    ).toBeVisible();
    await expect(
      occupe(page, reperes.technicienDucos, 11 * 60, id),
    ).toHaveCount(0);
  } finally {
    await retirerInterventionGlisser(id);
  }
});
