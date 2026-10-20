import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * LA COPIE ANCIENNE, TOLÉRÉE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1) — une
 * copie IndexedDB écrite par un appareil AVANT 9F4H6 (forme mesurée sur
 * `8b4512d1`) ne porte ni `catalogue` (sur l'instantané) ni
 * `prestationsRealiseesIds` (sur la fiche). Avant ce correctif,
 * `catalogue.map(...)` levait une `TypeError` au rendu de la fiche — le mode
 * hors réseau cessait purement et simplement de fonctionner pour ce
 * téléphone.
 *
 * Ce scénario pose une copie VALIDE par un passage en ligne normal, puis la
 * DÉGRADE lui-même, dans IndexedDB, à la forme d'avant 9F4H6 — c'est la
 * façon la plus fidèle de reproduire « un appareil jamais rafraîchi depuis »
 * sans dépendre d'un ancien build de l'application.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H6A-` — même discipline que 9F4H4B/9F4H4D
 *
 * Un client, un site, une intervention « affectée » et une prestation ACTIVE
 * — créés en `beforeAll`, supprimés en `afterAll`, aucune ligne ajoutée au
 * semis partagé. La prestation existe bien côté société : c'est justement ce
 * qui distingue « catalogue indisponible sur cette copie » (ce correctif) de
 * « catalogue vide » (`terrain.prestations.aucune`) — la coquille doit
 * afficher le premier message, jamais le second.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6A = uuidv7();
const SITE_9F4H6A = uuidv7();
const INTERVENTION_9F4H6A = uuidv7();
const PRESTATION_9F4H6A = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9F4H6A,
        societe_id: societeId,
        raison_sociale: "9F4H6A client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6A,
        societe_id: societeId,
        client_id: CLIENT_9F4H6A,
        agence_id: agence.id,
        libelle: "9F4H6A site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_9F4H6A,
        societe_id: societeId,
        code: "9F4H6A-PREST",
        libelle: fr["terrain.e2e.prestation_libelle"],
        actif: true,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H6A,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H6A,
        site_id: SITE_9F4H6A,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H6A — intervention forgée par l'épreuve",
        statut: "affectee",
        // SANS DATE (9F2B) — évite toute dépendance à la fenêtre
        // [aujourd'hui, J+8[ de « Ma journée ».
        date_planifiee: null,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H6A,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9F4H6A },
    });
    await client.prestation.deleteMany({ where: { id: PRESTATION_9F4H6A } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6A } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6A } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** Même idiome que `9f4h1-consultation.spec.ts`. */
async function copiePosee(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => resolve(false);
        requete.onsuccess = () => {
          const base = requete.result;
          if (!base.objectStoreNames.contains("instantane")) {
            base.close();
            resolve(false);
            return;
          }
          const lecture = base
            .transaction("instantane", "readonly")
            .objectStore("instantane")
            .get("actuel");
          lecture.onsuccess = () => {
            base.close();
            resolve(lecture.result !== undefined);
          };
          lecture.onerror = () => {
            base.close();
            resolve(false);
          };
        };
      }),
  );
}

async function attendreLaCopie(page: Page): Promise<void> {
  await expect.poll(() => copiePosee(page), { timeout: 10_000 }).toBe(true);
}

/**
 * DÉGRADE LA COPIE POSÉE À LA FORME D'AVANT 9F4H6 — retire `catalogue` de
 * l'instantané et `prestationsRealiseesIds` de chaque fiche, exactement ce
 * qu'un appareil jamais rafraîchi depuis porte encore (mesuré sur
 * `8b4512d1`).
 */
async function degraderLaCopieAvant9F4H6(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const transaction = base.transaction("instantane", "readwrite");
          const magasin = transaction.objectStore("instantane");
          const lecture = magasin.get("actuel");
          lecture.onsuccess = () => {
            const instantane = lecture.result as Record<string, unknown>;
            delete instantane.catalogue;
            const fiches = instantane.fiches as Record<
              string,
              Record<string, unknown>
            >;
            for (const fiche of Object.values(fiches)) {
              delete fiche.prestationsRealiseesIds;
            }
            magasin.put(instantane, "actuel");
          };
          transaction.oncomplete = () => {
            base.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H6A-COQUILLE-ANCIENNE-COPIE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("une copie écrite avant 9F4H6 : pas d'erreur, compteur et rapport utilisables, prestations non cochables", async ({
  page,
  context,
}) => {
  // ── 1. EN LIGNE : UN PASSAGE SUR /terrain POSE UNE COPIE VALIDE ──────────
  await connecterLeTechnicien(page);
  await attendreLaCopie(page);

  // ── 2. LA COPIE EST DÉGRADÉE À LA FORME D'AVANT 9F4H6 ────────────────────
  await degraderLaCopieAvant9F4H6(page);

  // ── 3. RÉSEAU COUPÉ, OUVERTURE DIRECTE DE LA FICHE DE LA COQUILLE ────────
  await context.setOffline(true);
  await page.goto(`/terrain-hors-reseau?id=${INTERVENTION_9F4H6A}`);

  // PAS D'ERREUR — la fiche se rend malgré l'absence de `catalogue` et de
  // `prestationsRealiseesIds` sur cette copie.
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["terrain.signature.titre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["terrain.terminer.titre"] }),
  ).toBeVisible();

  // LE MÊME MESSAGE QUE « CATALOGUE JAMAIS EMPORTÉ » (9F4H4B) — jamais
  // « catalogue vide » : la prestation EXISTE bien côté société (voir
  // `beforeAll`), seule CETTE copie l'ignore.
  await expect(
    page.getByText(
      fr["terrain.prestations.catalogue_indisponible_hors_reseau"],
    ),
  ).toBeVisible();
  await expect(page.getByText(fr["terrain.prestations.aucune"])).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: fr["terrain.e2e.prestation_libelle"] }),
  ).toHaveCount(0);

  await capturer(page, "fiche-copie-ancienne", 375);
  await capturer(page, "fiche-copie-ancienne", 1280);

  // ── 4. LE COMPTEUR RESTE UTILISABLE ───────────────────────────────────────
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  // ── 5. LE RAPPORT RESTE UTILISABLE ────────────────────────────────────────
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(fr["terrain.e2e.commentaire"]);
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();
});
