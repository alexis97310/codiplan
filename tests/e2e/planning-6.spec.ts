import { expect, test, type Page } from "@playwright/test";

import { jourDe, maintenant, type JourLocal } from "@/lib/calendar/fuseau";
import {
  DIMANCHE,
  jourSemaineIso,
  lundiDeLaSemaine,
} from "@/lib/calendar/semaine";
import { fr } from "@/lib/i18n";

import { cleDeJour } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 82-PLANNING-6 — LE JOUR COURANT DÉSIGNÉ DANS LA GRILLE, ET UN RETOUR
 * RAPIDE À LA SEMAINE COURANTE.
 *
 * ## RÉÉCRIT LE 28/09/2026 (PG-C3-CARTES-COLONNES, décision QG-1 du
 * 27/09/2026) — le titre d'origine, « sans défilement », ne tient plus
 *
 * 82-PLANNING-6 (25/09/2026, constats 10/11) avait retiré `min-w-[920px]`
 * pour que les six colonnes de jour tiennent SANS défiler à 1280 et 1440 px
 * — au prix d'une colonne mesurée à 79 px, une carte à 11 px de contenu utile
 * (audit du 27/09/2026, I-2) : illisible. **QG-1 arbitre l'inverse** : une
 * colonne de jour ouvert mesure 150 px au MINIMUM (`LARGEUR_COLONNE_JOUR_
 * OUVERT_PX`, `lib/theme/apparence.ts`), quitte à ce que la grille déborde et
 * défile — avec un indice de défilement visible
 * (`components/ui/cadre-defilant.tsx`) plutôt que le débordement muet que
 * 82-PLANNING-6 avait corrigé. Les deux décisions ne peuvent pas être vraies
 * en même temps ; la plus récente prime (§1).
 *
 * Ce que ce fichier éprouvait déjà — largeur des colonnes, indice de
 * défilement — a migré vers `tests/e2e/planning-largeur-et-carte.spec.ts`
 * (adapté par le même ticket), qui porte déjà la scène de semaine partagée.
 * Ce qui RESTE ici, propre à ce fichier : le jour courant est DÉSIGNÉ dans la
 * grille (`data-aujourdhui`), et le bouton « Aujourd'hui » y ramène —
 * qu'il faille défiler jusqu'à sa colonne ou non n'est plus ce que ce
 * fichier juge.
 *
 * ## Ce que ce fichier éprouve
 *
 * Aucune donnée n'est créée : ces épreuves ne lisent que la STRUCTURE de
 * l'écran (présence d'un attribut, présence d'un lien), jamais le contenu du
 * semis.
 *
 * ## Étape 0 — le jour CIVIL de la société, jamais celui de l'appareil (27/09/2026)
 *
 * `reperes.lundi` (`setup/reperes.ts`) est calculé à partir de la date **UTC**
 * de la machine qui joue l'épreuve, pas du fuseau de la société : entre 0 h et
 * 11 h à Nouméa, la date UTC est encore la veille, et ce fichier ouvrait alors
 * la semaine précédente. Ce fichier calcule donc son propre jour civil et son
 * propre lundi, dans `reperes.fuseau`, avec les fonctions existantes de
 * `lib/calendar` — jamais avec `reperes.lundi`. `setup/reperes.ts` n'est pas
 * touché : 35 autres épreuves le lisent.
 *
 * Le DIMANCHE est un second cas à part : le serveur (`app/(back-office)/planning/page.tsx`)
 * ne pose `data-aujourdhui` que sur une colonne de jour, et la grille n'a que
 * six colonnes, du lundi au samedi. Le dimanche, aucune colonne ne porte donc
 * l'attribut — ce n'est pas une panne de l'écran, et l'épreuve l'atteste au
 * lieu de le constater rouge.
 */

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Le jour civil d'aujourd'hui dans le fuseau de la société — jamais celui de l'appareil. */
function jourCivilCourant(): JourLocal {
  return jourDe(maintenant(reperes.fuseau).local);
}

function estDimanche(jour: JourLocal): boolean {
  return jourSemaineIso(jour) === DIMANCHE;
}

async function allerALaSemaineCourante(page: Page): Promise<JourLocal> {
  const lundi = lundiDeLaSemaine(jourCivilCourant());
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(lundi)}`);
  await expect(page.locator("main")).toBeVisible();
  return lundi;
}

const LARGEURS = [
  { largeur: 1280, hauteur: 800 },
  { largeur: 1440, hauteur: 900 },
];

for (const { largeur, hauteur } of LARGEURS) {
  test(`vue semaine : le jour courant est désigné dans la grille, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await allerALaSemaineCourante(page);

    const conteneur = page.locator("[data-conteneur-tableau-semaine]");
    await expect(conteneur).toBeVisible();

    // ── LE JOUR COURANT EST DÉSIGNÉ — DANS LE DOM, PAS FORCÉMENT DANS LA
    // FENÊTRE DE DÉFILEMENT INITIALE (QG-1, la grille peut désormais défiler).
    // Sauf le dimanche : la grille n'a que six colonnes (lundi → samedi), et
    // aucune ne porte alors `data-aujourdhui` (voir le commentaire d'en-tête).
    const entete = page.locator("[data-aujourdhui]");
    if (estDimanche(jourCivilCourant())) {
      await expect(entete).toHaveCount(0);
      return;
    }
    await expect(entete).toHaveCount(1);
  });
}

test("« Aujourd’hui » ramène à la semaine courante depuis la semaine suivante, et reste présent partout (PG-C6-FILTRES-AUJOURDHUI)", async ({
  page,
}) => {
  // REVIENT sur 82-PLANNING-6 (25/09/2026) : ce fichier attendait ABSENT le
  // bouton sur la semaine courante — *mesuré à l'audit du 27/09/2026 (§5) :
  // le dimanche, le planning montre la semaine écoulée sans aucun moyen d'un
  // clic pour revenir à « maintenant ».* Le bouton est désormais PERMANENT,
  // dans les deux vues, y compris sur la semaine courante.
  await page.setViewportSize({ width: 1280, height: 800 });
  const lundi = await allerALaSemaineCourante(page);

  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"], exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: fr["planning.semaine_apres"] }).click();
  await expect(page.locator("main")).toBeVisible();

  const bouton = page.getByRole("link", {
    name: fr["planning.aujourdhui"],
    exact: true,
  });
  await expect(bouton).toBeVisible();
  await bouton.click();

  await expect(page).toHaveURL(new RegExp(`semaine=${cleDeJour(lundi)}`));
  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"], exact: true }),
  ).toBeVisible();
});
