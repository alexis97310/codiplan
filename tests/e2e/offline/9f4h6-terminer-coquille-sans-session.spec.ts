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
 * « TERMINER » GARDÉ DANS LA COQUILLE SUR REFUS D'AUTHENTIFICATION (9F4H6,
 * point 1) — même scène et même discipline que
 * `9f4h4d-coquille-sans-session.spec.ts`, mais pour « Terminer » plutôt que
 * pour « Démarrer ».
 *
 * Avant ce correctif, `envoyerJson` rendait `null` pour le POST `/terminer`
 * (comme pour les trois autres blocs) à cause d'`auth.refus`, mais seule la
 * branche `!navigator.onLine` de `onClickTerminer` mettait réellement le
 * geste « terminer » en file — la coquille EN LIGNE tombait dans la branche
 * `hors_ligne` du dessous, qui affiche le même message mais ne garde JAMAIS
 * le geste lui-même : à la reconnexion, rien ne partait.
 *
 * Le réseau reste UP du début à la fin (`context.setOffline` n'est jamais
 * appelé) ; seul le cookie de session disparaît.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6 = uuidv7();
const SITE_9F4H6 = uuidv7();
const INTERVENTION_9F4H6 = uuidv7();

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
        id: CLIENT_9F4H6,
        societe_id: societeId,
        raison_sociale: "9F4H6 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6,
        societe_id: societeId,
        client_id: CLIENT_9F4H6,
        agence_id: agence.id,
        libelle: "9F4H6 site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H6,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H6,
        site_id: SITE_9F4H6,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H6 — intervention forgée par l'épreuve",
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
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H6,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H6,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9F4H6 },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6 } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6 } });
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

/** Même idiome que `9f4h4d-coquille-sans-session.spec.ts`. */
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

async function tailleDeLaFile(page: Page): Promise<number> {
  return page.evaluate(
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
}

test("coquille ouverte EN LIGNE, cookie de session supprimé : « Terminer » part en file, jamais affiché comme une simple coupure sans suite ; envoyé après reconnexion du même compte", async ({
  page,
  context,
}) => {
  // ── 1. EN LIGNE, SESSION VALIDE : UN PASSAGE SUR /terrain POSE LA COPIE ──
  await connecterLeTechnicien(page);
  await attendreLaCopie(page);

  // ── 2. LA COQUILLE, OUVERTE EN LIGNE (AUCUNE COUPURE RÉSEAU ICI) ─────────
  await page.goto(`/terrain-hors-reseau?id=${INTERVENTION_9F4H6}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // ── 3. LE COOKIE DE SESSION DISPARAÎT — LE RÉSEAU, LUI, RESTE UP ─────────
  await context.clearCookies();

  // ── 4. « DÉMARRER » : FAIT APPARAÎTRE LA SECTION « TERMINER » LOCALEMENT ─
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_depuis"], {
      exact: false,
    }),
  ).toBeVisible();

  // ── 5. UNE ISSUE DE SIGNATURE, SANS LAQUELLE « TERMINER » EST REFUSÉ ─────
  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("Client absent au moment du passage.");
  // Blur explicite : c'est lui qui déclenche `tenterEnvoiSignature`.
  await page.keyboard.press("Tab");

  // ── 6. « TERMINER » — JAMAIS UN REFUS, JAMAIS UN SIMPLE « SANS RÉSEAU » ──
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();
  // Le bouton « Terminer » a disparu : le geste est gardé, pas rejouable.
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toHaveCount(0);

  const enFile = await tailleDeLaFile(page);
  // compteur (démarrer) + signature + terminer.
  expect(enFile).toBe(3);

  // ── RECULE LE « DÉMARRER » DE 70 MINUTES, DIRECTEMENT DANS LA FILE ───────
  // Même raison que `reculerLeSegmentOuvert` dans `9de-terminer-signature.
  // spec.ts` : démarrer et terminer, envoyés coup sur coup par « Envoyer »,
  // mesureraient 0 minute tronquées à la minute — `peutTerminer` refuserait
  // alors « temps manquant » côté SERVEUR, quel que soit le verdict LOCAL.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const magasin = base
            .transaction("file", "readwrite")
            .objectStore("file");
          const lecture = magasin.getAll();
          lecture.onsuccess = () => {
            const entrees = lecture.result as Array<{
              id: string;
              instantAppareil: string;
              geste: { type: string };
            }>;
            const compteur = entrees.find((e) => e.geste.type === "compteur");
            if (compteur === undefined) {
              base.close();
              reject(new Error("aucune entrée compteur en file"));
              return;
            }
            compteur.instantAppareil = new Date(
              new Date(compteur.instantAppareil).getTime() - 70 * 60_000,
            ).toISOString();
            const ecriture = magasin.put(compteur);
            ecriture.onsuccess = () => {
              base.close();
              resolve();
            };
            ecriture.onerror = () => reject(ecriture.error);
          };
          lecture.onerror = () => reject(lecture.error);
        };
      }),
  );

  // ── 7. RECONNEXION DU MÊME COMPTE, PUIS « ENVOYER » ──────────────────────
  await connecterLeTechnicien(page);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H6 },
      select: { statut: true },
    });
    expect(intervention.statut).toBe("terminee");
  } finally {
    await verif.$disconnect();
  }
});
