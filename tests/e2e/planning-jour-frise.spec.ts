import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  cleDeJour,
  jourDeLaScene,
  MARDI,
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
 * LA VUE JOUR EN FRISE — QG-3/D142, 30/09/2026 (9CF-PG-G11-JOUR-FRISE).
 *
 * Ces scénarios ont été écrits AVANT la frise, et ont d'abord échoué contre
 * l'ancienne vue en colonnes (techniciens en colonnes, heures en lignes) —
 * c'est la preuve qu'ils la contraignent, pas qu'ils la décrivent.
 *
 * SA PROPRE SCÈNE, PAR SCÉNARIO (même modèle que `glisser-deposer.spec.ts`,
 * `tests/e2e/setup/scene-glisser.ts`) : `poserInterventionGlisser` réutilise
 * un site EXISTANT de l'agence Koné (jamais créé ni muté par ce fichier), et
 * pose une intervention à un identifiant tiré au sort, retirée dans un
 * `finally`. Aucune fixture `SCENE.*` partagée n'est ni lue, ni écrite.
 *
 * **KONÉ, PAS DUCOS** : mesuré le 30/09/2026, le technicien Ducos porte déjà,
 * au semis, des interventions posées de 08:00 à 13:00 ce MARDI-là (le semis
 * pose ses propres démonstrations relativement à AUJOURD'HUI, comme
 * `reperesDeLaScene`) — une seconde ligne posée par ce fichier sur le même
 * créneau y chevaucherait en silence (la création directe par Prisma ne
 * rejoue aucune règle de gestion). Koné n'a, lui, aucune intervention datée
 * ce jour-là : c'est le technicien libre que `reperesDeLaScene` expose.
 */

test.describe.configure({ mode: "serial" });

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

/** La poignée de redimensionnement d'un bloc. */
function poignee(page: Page, id: string): Locator {
  return page.locator(`[data-poignee="${id}"]`);
}

/** Le refus affiché — `data-refus`, jamais le rôle seul (voir glisser-deposer.spec.ts). */
function refus(page: Page): Locator {
  return page.locator("[data-refus]");
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

/** Le lien d'une intervention dans SA CASE DE DÉBUT — la seule qui le porte. */
function occupe(page: Page, technicienId: string, minutes: number, id: string) {
  return caseDHeure(page, technicienId, minutes).locator(
    `[data-tiroir-declencheur="${id}"]`,
  );
}

/**
 * LA FIN RÉELLE D'UN BLOC — `data-fin-heure`, posée sur l'enveloppe qui
 * positionne CE bloc précis. Scopée par `id` via `:has()` (Chromium natif),
 * jamais par la seule case de début : deux blocs peuvent commencer à la même
 * heure pour la même personne (chevauchement), et un sélecteur non scopé
 * résoudrait alors à plusieurs éléments.
 */
function finDuBloc(
  page: Page,
  technicienId: string,
  debutMinutes: number,
  id: string,
): Locator {
  return caseDHeure(page, technicienId, debutMinutes).locator(
    `div:has(> [data-bloc="${id}"])`,
  );
}

/** Même délai que `glisser-deposer.spec.ts` — voir son docblock. */
const DELAI_DEPLACEMENT_MS = 10_500;

async function allerAJour(page: Page, jourRang: number): Promise<void> {
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, jourRang))}`,
  );
}

/**
 * L'ORDRE DES TECHNICIENS, LU SUR L'ÉCRAN — le premier `data-depot-technicien`
 * rencontré par colonne (Semaine) ou par ligne (Jour), l'un et l'autre
 * répétant la même valeur sur toutes LEURS cases. Un identifiant vu deux fois
 * ne compte qu'à son premier rang : c'est l'ORDRE d'apparition qui est jugé,
 * jamais un compte.
 */
async function ordreDesTechniciens(page: Page): Promise<string[]> {
  const valeurs = await page
    .locator("[data-depot-technicien]")
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("data-depot-technicien")),
    );
  const vus = new Set<string>();
  const ordre: string[] = [];
  for (const valeur of valeurs) {
    if (valeur !== null && valeur !== "" && !vus.has(valeur)) {
      vus.add(valeur);
      ordre.push(valeur);
    }
  }
  return ordre;
}

/* ── 1. LES TECHNICIENS EN LIGNES, MÊME ORDRE QUE LA SEMAINE ────────────── */

test("la vue Jour montre les techniciens en LIGNES, dans le même ordre que la vue Semaine du même jour", async ({
  page,
}) => {
  await allerAJour(page, MARDI);
  const ordreJour = await ordreDesTechniciens(page);
  // Au moins Ducos et Koné, les deux techniciens de repère.
  expect(ordreJour.length).toBeGreaterThan(0);

  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  const ordreSemaine = await ordreDesTechniciens(page);

  expect(ordreJour).toEqual(ordreSemaine);
});

/* ── 2. DÉPLACER UNE CARTE, SUR LA MÊME LIGNE, D'UNE HEURE À UNE AUTRE ──── */

test("glisser une carte de 08:00 à 10:00, sur la même ligne, garde la durée — la base le confirme", async ({
  page,
}) => {
  const debut = 8 * 60;
  const cible = 10 * 60;
  const duree = 60;
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut,
    duree,
  });
  try {
    await allerAJour(page, MARDI);

    await expect(occupe(page, reperes.technicienKone, debut, id)).toBeVisible();

    await glisser(
      page,
      bloc(page, id),
      caseDHeure(page, reperes.technicienKone, cible),
    );

    // Le dépôt DIRECT est DIFFÉRÉ (PG-B5, QG-6) : l'écrit n'a lieu qu'après
    // l'échéance — voir `glisser-deposer.spec.ts` pour la mesure complète de
    // ce mécanisme, non reprise ici.
    await page.waitForTimeout(DELAI_DEPLACEMENT_MS);

    await expect(occupe(page, reperes.technicienKone, cible, id)).toBeVisible();
    await expect(
      finDuBloc(page, reperes.technicienKone, cible, id),
    ).toHaveAttribute("data-fin-heure", String(cible + duree));

    // Et la BASE l'a gardé — seul un rechargement complet le dit.
    await allerAJour(page, MARDI);
    await expect(occupe(page, reperes.technicienKone, cible, id)).toBeVisible();
    await expect(occupe(page, reperes.technicienKone, debut, id)).toHaveCount(
      0,
    );
    await expect(
      finDuBloc(page, reperes.technicienKone, cible, id),
    ).toHaveAttribute("data-fin-heure", String(cible + duree));
  } finally {
    await retirerInterventionGlisser(id);
  }
});

/* ── 3. LA POIGNÉE DE FIN, SUR LE BORD DROIT DU BLOC ─────────────────────── */

test("la poignée de fin, tirée vers la DROITE, allonge le bloc — la base le confirme", async ({
  page,
}) => {
  const debut = 8 * 60;
  const duree = 60;
  const finInitiale = debut + duree;
  const cible = 9 * 60;
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut,
    duree,
  });
  try {
    await allerAJour(page, MARDI);

    await expect(
      finDuBloc(page, reperes.technicienKone, debut, id),
    ).toHaveAttribute("data-fin-heure", String(finInitiale));

    await glisser(
      page,
      poignee(page, id),
      caseDHeure(page, reperes.technicienKone, cible),
    );

    // Même calcul que `glisser-deposer.spec.ts` (`construireFormulaireDeplacement`,
    // inchangé par la frise) : nouvelle fin = case visée + son pas.
    const nouvelleFin = cible + 30;
    await expect(
      finDuBloc(page, reperes.technicienKone, debut, id),
    ).toHaveAttribute("data-fin-heure", String(nouvelleFin));

    await allerAJour(page, MARDI);
    await expect(
      finDuBloc(page, reperes.technicienKone, debut, id),
    ).toHaveAttribute("data-fin-heure", String(nouvelleFin));
    // Le début n'a pas bougé : le lien vit toujours dans sa case d'origine.
    await expect(occupe(page, reperes.technicienKone, debut, id)).toBeVisible();
  } finally {
    await retirerInterventionGlisser(id);
  }
});

test("la poignée de fin, tirée à GAUCHE du début, est refusée — rien n'a bougé", async ({
  page,
}) => {
  const debut = 9 * 60;
  const duree = 60;
  const id = await poserInterventionGlisser(reperes, {
    codeAgence: "KONE",
    technicienId: reperes.technicienKone,
    rang: MARDI,
    debut,
    duree,
  });
  try {
    await allerAJour(page, MARDI);

    await expect(occupe(page, reperes.technicienKone, debut, id)).toBeVisible();

    await glisser(
      page,
      poignee(page, id),
      caseDHeure(page, reperes.technicienKone, 8 * 60),
    );

    await expect(refus(page)).toContainText(
      fr["intervention.refus.duree_invalide"],
    );

    await allerAJour(page, MARDI);
    await expect(occupe(page, reperes.technicienKone, debut, id)).toBeVisible();
    await expect(
      finDuBloc(page, reperes.technicienKone, debut, id),
    ).toHaveAttribute("data-fin-heure", String(debut + duree));
  } finally {
    await retirerInterventionGlisser(id);
  }
});
