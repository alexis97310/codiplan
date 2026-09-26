import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { instantAMinutes } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99Y-GR9-CARTE-SEMAINE — la ligne heure + client des cartes de la grille
 * Semaine tient sur deux lignes au plus, sans déborder ni disparaître.
 *
 * *Mesuré le 26/09/2026 (audit GR9, constat G1), à 1280 px : les colonnes
 * jour font ~80 px, et la ligne de tête tronquée à une seule ligne ne
 * montrait ni l'heure ni le client — deux cartes du même client étaient
 * indiscernables.* Décision d'Alexis du 26/09 : `line-clamp-2 break-words`,
 * même si la case admet de grandir pour cette ligne.
 *
 * SA PROPRE SCÈNE, préfixée `ERGO9S`, créée et supprimée par ce fichier —
 * jamais `SCENE.*` (voir `tests/e2e/setup/scene-glisser.ts`, même raison) :
 * un client au nom long, un site, une intervention planifiée à une heure de
 * la semaine courante, sur le technicien de Ducos lu depuis
 * `reperesDeLaScene`, jamais écrit par elle.
 */

// SÉRIE : `beforeAll` écrit en base (client, site, intervention) — le même
// gardien que `fiche-375.spec.ts` (`tests/unit/e2e-mise-en-scene.test.ts`).
test.describe.configure({ mode: "serial" });

const PREFIXE = "ERGO9S";
const CLIENT_LONG = `${PREFIXE}-Client-${"A".repeat(80)}`;
const SITE_LIBELLE = `${PREFIXE}-Site`;

/** Jeudi — hors des deux jours (`MARDI`, `MERCREDI`) que `scene.ts` se réserve. */
const JEUDI = 3;

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;
let admin: PrismaClient;
let clientId: string;
let siteId: string;
let interventionId: string;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: reperes.societeId,
      raison_sociale: CLIENT_LONG,
      actif: true,
    },
  });
  clientId = client.id;

  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: SITE_LIBELLE,
    },
  });
  siteId = site.id;

  const jour = jourDeLaScene(reperes, JEUDI);
  interventionId = uuidv7();
  await admin.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      technicien_id: reperes.technicienDucos,
      type: "preventif_contrat",
      priorite: "p3",
      statut: "planifiee",
      date_planifiee: new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour)),
      creneau_debut: instantAMinutes(jour, 9 * 60, reperes.fuseau),
      creneau_fin: instantAMinutes(jour, 10 * 60, reperes.fuseau),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
    },
  });
});

test.afterAll(async () => {
  try {
    await admin.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await admin.intervention.deleteMany({ where: { id: interventionId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 1280 px, la ligne heure + client d'une carte Semaine tient sur deux lignes au plus, sans déborder, et garde le client entier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();

  const bloc = page.locator(`[data-bloc="${interventionId}"]`);
  await expect(bloc).toBeVisible();

  // LA LIGNE DE TÊTE : le premier `span` du bloc, celui que porte
  // `enTeteDuBloc` (`app/(back-office)/interventions/presentation.ts`) —
  // voir `page.tsx`, la ligne heure + client, juste avant la nature.
  const ligneDeTete = bloc.locator("span").first();

  const mesure = await ligneDeTete.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      hauteur: element.getBoundingClientRect().height,
      hauteurDeLigne: parseFloat(style.lineHeight),
      texte: element.textContent ?? "",
    };
  });

  expect(mesure.scrollWidth).toBeLessThanOrEqual(mesure.clientWidth);
  expect(mesure.hauteur).toBeLessThanOrEqual(mesure.hauteurDeLigne * 2 + 1);
  expect(mesure.texte).toContain(CLIENT_LONG);
});
