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
 * LA COQUILLE `/terrain-hors-reseau` OUVERTE EN LIGNE, SANS SESSION VALIDE
 * (point 2, 9F4H4D-ARRETER-BORNE).
 *
 * ## CE QUE CE SCÉNARIO ÉPROUVE, ET POURQUOI IL NE COUPE JAMAIS LE RÉSEAU
 *
 * Mesuré à la relecture de `e71c8247` (20/10/2026) : `BoutonCompteurTerrain`
 * ne mettait en file QUE sur une exception réseau (`catch`) — une réponse
 * SERVEUR `{ ok: false, motif: "auth.refus" }`, qui arrive bel et bien quand
 * le cookie de session a expiré ou a été supprimé PENDANT que le réseau
 * fonctionne, était affichée comme un refus ordinaire et le geste n'était
 * JAMAIS gardé — alors que la coquille affiche en permanence « Vos saisies
 * sont gardées… » (`consultation-hors-reseau.tsx`).
 *
 * Ce scénario reproduit exactement cette situation : le réseau reste UP du
 * début à la fin (`context.setOffline` n'est jamais appelé), seul le cookie
 * de session disparaît (`context.clearCookies()`) — la requête POST atteint
 * donc réellement le serveur et reçoit une vraie réponse JSON, jamais une
 * exception `fetch`.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H4D-` — même discipline que 9F4H4B
 *
 * Un client, un site et une intervention « affectée », créés en `beforeAll`,
 * supprimés en `afterAll`, aucune ligne ajoutée au semis partagé.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H4D = uuidv7();
const SITE_9F4H4D = uuidv7();
const INTERVENTION_9F4H4D = uuidv7();

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
        id: CLIENT_9F4H4D,
        societe_id: societeId,
        raison_sociale: "9F4H4D client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H4D,
        societe_id: societeId,
        client_id: CLIENT_9F4H4D,
        agence_id: agence.id,
        libelle: "9F4H4D site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H4D,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H4D,
        site_id: SITE_9F4H4D,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H4D — intervention forgée par l'épreuve",
        statut: "affectee",
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
      INTERVENTION_9F4H4D,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9F4H4D },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H4D } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H4D } });
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

/** Même idiome que `9f4h4-ouverture-a-froid.spec.ts` : la copie IndexedDB
 * existe-t-elle déjà sur cette page ? */
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

test("coquille ouverte EN LIGNE, cookie de session supprimé : « Démarrer » part en file, jamais affiché en refus ; envoyé après reconnexion du même compte", async ({
  page,
  context,
}) => {
  // ── 1. EN LIGNE, SESSION VALIDE : UN PASSAGE SUR /terrain POSE LA COPIE ──
  await connecterLeTechnicien(page);
  await attendreLaCopie(page);

  // ── 2. LA COQUILLE, OUVERTE EN LIGNE (AUCUNE COUPURE RÉSEAU ICI) ─────────
  await page.goto(`/terrain-hors-reseau?id=${INTERVENTION_9F4H4D}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // ── 3. LE COOKIE DE SESSION DISPARAÎT — LE RÉSEAU, LUI, RESTE UP ─────────
  await context.clearCookies();

  // ── 4. « DÉMARRER » : LA REQUÊTE ABOUTIT VRAIMENT, AVEC `auth.refus` ─────
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();

  // JAMAIS un refus affiché — c'est exactement ce que corrige 9F4H4D.
  await expect(page.getByText(fr["auth.refus"])).toHaveCount(0);
  // Le MÊME message que la coupure réseau, « Vos saisies sont gardées… »
  // ayant déjà promis que rien ne se perd.
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_depuis"], {
      exact: false,
    }),
  ).toBeVisible();

  const enFile = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const lecture = base
            .transaction("file", "readonly")
            .objectStore("file")
            .getAll();
          lecture.onsuccess = () => {
            base.close();
            resolve(lecture.result.length);
          };
          lecture.onerror = () => reject(lecture.error);
        };
      }),
  );
  expect(enFile).toBe(1);

  // ── 5. RECONNEXION DU MÊME COMPTE, PUIS « ENVOYER » ──────────────────────
  await connecterLeTechnicien(page);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H4D },
      select: { fin: true, saisi_hors_reseau: true },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].fin).toBeNull();
    expect(segments[0].saisi_hors_reseau).toBe(true);
  } finally {
    await verif.$disconnect();
  }
});
