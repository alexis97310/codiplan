import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { hauteurChromeFixe, pointVisible } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MERCREDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE SURVOL D'UNE CASE D'ABSENCE (PG-B4-SURVOL-CASES, §3.11) — pendant un
 * glisser, AVANT tout dépôt, la case teinte en refus et affiche « Absent ».
 *
 * *Sa propre scène, préfixée `PGB4-`* : une intervention « À planifier » et
 * une absence, toutes deux forgées par ce test et retirées en fin de test —
 * jamais une fixture `SCENE.*` partagée (même raison que
 * `planning-fenetre-pose.spec.ts`).
 *
 * **Le glissé s'ARRÊTE avant le dépôt** — `mouse.up` a lieu HORS de toute
 * case (`page.mouse.up` après un déplacement vers un point neutre), pour
 * observer le survol sans jamais écrire : cette fonction est un INDICE, elle
 * ne remplace pas le serveur (voir `lib/interventions/survol.ts`).
 */

async function creerInterventionAPlanifier(
  reperes: ReperesDeScene,
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, 60, 'temps_passe', 'XPF', now())`,
      id,
      reperes.societeId,
      agence.id,
      site.client_id,
      site.id,
    );
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

async function declarerAbsence(
  reperes: ReperesDeScene,
  technicienId: string,
  jour: { annee: number; mois: number; jour: number },
): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const date = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    const absence = await client.absence.create({
      data: {
        societe_id: reperes.societeId,
        utilisateur_id: technicienId,
        du: date,
        au: date,
      },
      select: { id: true },
    });
    return absence.id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerAbsence(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.absence.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

/**
 * AMÈNE LA SOURCE ET LA CIBLE DANS LA MÊME FENÊTRE, VISIBLES ENSEMBLE — même
 * mesure que `setup/glisser.ts` (25/09/2026) : la file grandit avec ce que
 * d'AUTRES scènes du dépôt y posent en parallèle (technicien et jour de la
 * semaine COURANTE, partagés par de nombreuses épreuves), et un point hors
 * fenêtre n'est pas une erreur pour la souris — c'est un geste qui n'a pas
 * lieu, et qui ne dit rien : le `dragover` ne se déclenche jamais sur une
 * case qu'aucun pixel de la fenêtre ne recouvre, et `data-survol` reste
 * absent sans qu'aucune règle n'ait été mise en défaut. Depuis
 * 9DU-TP-NAV3-RECHERCHE-RAIL, le point visé exclut aussi la bande recouverte
 * par le bandeau fixe du bureau (`pointVisible`/`hauteurChromeFixe`,
 * importés de `setup/glisser.ts`), pour la même raison.
 *
 * Cette épreuve-ci NE SE DÉPOSE JAMAIS (voir l'entête du fichier) : cette
 * fonction ne fait que positionner la souris au-dessus de la cible, jamais
 * `mouse.up`.
 */
async function survolerSansDeposer(
  page: Page,
  source: Locator,
  cible: Locator,
): Promise<void> {
  const fenetre = page.viewportSize() ?? { width: 1280, height: 1200 };
  const chromeHaut = await hauteurChromeFixe(page);
  await cible.scrollIntoViewIfNeeded();
  const avantSource = await source.boundingBox();
  const avantCible = await cible.boundingBox();
  if (avantSource === null || avantCible === null) {
    throw new Error("source ou cible sans boîte visible");
  }
  const milieu =
    (avantSource.y +
      avantSource.height / 2 +
      (avantCible.y + avantCible.height / 2)) /
    2;
  const decalage = milieu - fenetre.height / 2;
  if (Math.abs(decalage) > 1) {
    await page.evaluate((dy) => window.scrollBy(0, dy), decalage);
  }
  const depart = await source.boundingBox();
  const arrivee = await cible.boundingBox();
  if (depart === null || arrivee === null) {
    throw new Error("source ou cible sans boîte visible après défilement");
  }
  // Point VISIBLE, pas le centre brut : le bandeau fixe du bureau (64 px,
  // `components/navigation/bandeau-bureau.tsx`, 9DU-TP-NAV3-RECHERCHE-RAIL)
  // recouvre désormais le haut de chaque page, et un centre tombé dans cette
  // bande fait atterrir la souris sur le bandeau, jamais sur la case visée —
  // `dragover` ne part alors jamais, et `data-survol` reste vide. Même
  // mesure que `setup/glisser.ts` (`pointVisible`/`hauteurChromeFixe`).
  const prise = pointVisible(depart, fenetre, chromeHaut);
  const pose = pointVisible(arrivee, fenetre, chromeHaut);
  if (prise === null || pose === null) {
    throw new Error("source ou cible sans partie visible sous le bandeau");
  }

  await page.mouse.move(prise.x, prise.y);
  await page.mouse.down();
  // Les mouvements découpés ne sont pas une précaution : Chromium n'engage
  // un glissé qu'après un déplacement franchissant son seuil, puis ne
  // recalcule `dragover` sur la cible qu'après au moins UN second
  // déplacement une fois arrivé dessus (même mesure que `setup/glisser.ts`).
  await page.mouse.move(pose.x, pose.y, { steps: 20 });
  await page.mouse.move(pose.x + 2, pose.y + 2, { steps: 10 });
}

test("survoler la case d'un technicien absent la teinte en refus et affiche « Absent », sans rien écrire", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourDeLaScene(reperes, MERCREDI);
  const jourCle = cleDeJour(jour);
  const interventionId = await creerInterventionAPlanifier(reperes);
  const absenceId = await declarerAbsence(
    reperes,
    reperes.technicienKone,
    jour,
  );

  try {
    let posteVersDeplacer = false;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        posteVersDeplacer = true;
      }
    });

    await ouvrirUneSession(page);
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const source = page.locator(`[data-bloc="${interventionId}"]`);
    const cible = page.locator(
      `[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienKone}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    // UN GLISSÉ QUI NE SE DÉPOSE JAMAIS — voir `survolerSansDeposer`, qui
    // amène d'abord la source et la cible visibles ensemble avant d'engager
    // le glissé (même mesure que `tests/e2e/setup/glisser.ts`, 25/09/2026).
    await survolerSansDeposer(page, source, cible);

    await expect(cible).toHaveAttribute("data-survol", "absent");
    await expect(cible.getByText(fr["planning.survol.absent"])).toBeVisible();
    await expect(
      page.locator('[aria-live="polite"]', {
        hasText: fr["planning.survol.absent"],
      }),
    ).toBeAttached();

    // FIN DU GLISSÉ HORS DE TOUTE CASE — `mouse.up` sur un point neutre
    // n'engage aucun dépôt : cette fonction est un indice, jamais une
    // décision (voir l'entête).
    await page.mouse.move(20, 20, { steps: 5 });
    await page.mouse.up();

    expect(posteVersDeplacer).toBe(false);
  } finally {
    await retirerAbsence(absenceId);
    await retirerIntervention(interventionId);
  }
});
