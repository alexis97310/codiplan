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
 * 82-PLANNING-6 — LA SEMAINE ENTIÈRE ET LE JOUR COURANT VISIBLES À 1280 ET
 * 1440 PX, SANS DÉFILEMENT.
 *
 * ## Ce qui a été mesuré le 25/09/2026 (audit, constats 10 et 11, « Bloquant »)
 *
 * Le tableau de la vue SEMAINE portait `min-w-[920px]` dans un conteneur de
 * 805 px (mesure de production) — 662 px et 822 px, mesurés dans ce dépôt à
 * 1280 et 1440 px, menu latéral ouvert : vendredi et samedi restaient hors
 * cadre aux deux largeurs, sans le moindre indice de défilement. Aucune
 * colonne ne distinguait le jour courant, et rien ne ramenait à la semaine
 * d'aujourd'hui depuis une autre semaine.
 *
 * ## Ce que ce fichier éprouve
 *
 * Aucune donnée n'est créée : ces trois épreuves ne lisent que la STRUCTURE
 * de l'écran (largeur du conteneur, position de l'en-tête, présence d'un
 * lien), jamais le contenu du semis.
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
  test(`vue semaine : tous les jours tiennent dans le conteneur du tableau, sans défilement, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await allerALaSemaineCourante(page);

    const conteneur = page.locator("[data-conteneur-tableau-semaine]");
    await expect(conteneur).toBeVisible();
    const { scrollWidth, clientWidth } = await conteneur.evaluate(
      (element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }),
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // ── LE JOUR COURANT EST DÉSIGNÉ, ET SON EN-TÊTE EST VISIBLE EN ENTIER ──
    // Sauf le dimanche : la grille n'a que six colonnes (lundi → samedi), et
    // aucune ne porte alors `data-aujourdhui` (voir le commentaire d'en-tête).
    const entete = page.locator("[data-aujourdhui]");
    if (estDimanche(jourCivilCourant())) {
      await expect(entete).toHaveCount(0);
      return;
    }
    await expect(entete).toBeVisible();
    const boite = await entete.boundingBox();
    expect(boite).not.toBeNull();
    if (boite !== null) {
      expect(boite.x).toBeGreaterThanOrEqual(0);
      expect(boite.y).toBeGreaterThanOrEqual(0);
      expect(boite.x + boite.width).toBeLessThanOrEqual(largeur + 1);
      expect(boite.y + boite.height).toBeLessThanOrEqual(hauteur + 1);
    }
  });
}

test("« Aujourd’hui » ramène à la semaine courante depuis la semaine suivante, et n'apparaît pas sur la semaine courante", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const lundi = await allerALaSemaineCourante(page);

  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"] }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: fr["planning.semaine_apres"] }).click();
  await expect(page.locator("main")).toBeVisible();

  const bouton = page.getByRole("link", { name: fr["planning.aujourdhui"] });
  await expect(bouton).toBeVisible();
  await bouton.click();

  await expect(page).toHaveURL(new RegExp(`semaine=${cleDeJour(lundi)}`));
  await expect(
    page.getByRole("link", { name: fr["planning.aujourdhui"] }),
  ).toHaveCount(0);
});
