import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H6-FINITIONS-HORS-RESEAU/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  versLeBas?: Locator,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  // `versLeBas` est rejoué APRÈS le redimensionnement : une largeur plus
  // étroite allonge la page, et un défilement fait AVANT le resize ne
  // montre plus le même élément une fois la mise en page recalculée.
  await versLeBas?.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function capturerLesDeux(
  page: Page,
  nom: string,
  versLeBas?: Locator,
): Promise<void> {
  await capturer(page, nom, 375, versLeBas);
  await capturer(page, nom, 1280, versLeBas);
}

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
const PRESTATION_9F4H6 = uuidv7();

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
    await client.prestation.create({
      data: {
        id: PRESTATION_9F4H6,
        societe_id: societeId,
        code: "9F4H6-PREST",
        libelle: fr["terrain.e2e.prestation_libelle"],
        actif: true,
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
    await client.prestation.deleteMany({ where: { id: PRESTATION_9F4H6 } });
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

  // ── CAPTURE (d) : LE NOUVEAU BANDEAU, « …, saisies gardées sur ce
  // téléphone » — JAMAIS « lecture seule » au-dessus d'une fiche de travail
  // (point 4). Le bandeau ne s'affiche QUE hors ligne — une coupure RÉELLE,
  // brève, juste pour ce cliché, remise en ligne tout de suite après ─────────
  await context.setOffline(true);
  await expect(
    page.getByText(fr["terrain.bandeau.suffixe_travail"], { exact: false }),
  ).toBeVisible();
  await capturerLesDeux(page, "bandeau-saisies-gardees");
  await context.setOffline(false);

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

  // ── UNE PRESTATION COCHÉE DEPUIS LE CATALOGUE EMPORTÉ (point 3) ──────────
  await page
    .getByRole("checkbox", { name: fr["terrain.e2e.prestation_libelle"] })
    .check();
  await expect(
    page.getByRole("checkbox", { name: fr["terrain.e2e.prestation_libelle"] }),
  ).toBeChecked();
  // ── CAPTURE (c) : LA PRESTATION COCHÉE DANS LA COQUILLE ──────────────────
  await capturerLesDeux(page, "prestation-cochee-coquille");

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
  // ── CAPTURE (b) : LA COQUILLE APRÈS « TERMINER » GARDÉ ───────────────────
  await capturerLesDeux(
    page,
    "terminer-garde-coquille",
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  );

  const enFile = await tailleDeLaFile(page);
  // compteur (démarrer) + prestations + signature + terminer.
  expect(enFile).toBe(4);

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

/**
 * CAPTURE (a) — LA QUESTION DE DÉCONNEXION SANS INSTANTANÉ (9F4H4CA,
 * `effacement-copie-locale.tsx`) : `lireCopie()` rend `null` (aucune copie de
 * consultation), mais la file porte encore une saisie — la question reste
 * posée, sans bouton « Envoyer d'abord » (l'identité de la file est alors
 * inconnue sans session).
 */
test("déconnexion SANS instantané, file NON VIDE : la question reste posée, sans « Envoyer d'abord »", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await attendreLaCopie(page);

  // UNE SAISIE EN FILE, ÉCRITE DIRECTEMENT — sans passer par une vraie
  // coupure réseau, hors du territoire de cette capture.
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
          const ecriture = magasin.put({
            id: crypto.randomUUID(),
            interventionId: crypto.randomUUID(),
            utilisateurId: crypto.randomUUID(),
            societeId: crypto.randomUUID(),
            instantAppareil: new Date().toISOString(),
            geste: { type: "rapport", commentaire: "9F4H6", suite: "" },
            motifRefus: null,
          });
          ecriture.onsuccess = () => {
            base.close();
            resolve();
          };
          ecriture.onerror = () => reject(ecriture.error);
        };
      }),
  );

  // L'INSTANTANÉ DISPARAÎT — même état que 9F4H4CA : « pas de copie »,
  // jamais « pas de saisie ».
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const magasin = base
            .transaction("instantane", "readwrite")
            .objectStore("instantane");
          const suppression = magasin.delete("actuel");
          suppression.onsuccess = () => {
            base.close();
            resolve();
          };
          suppression.onerror = () => reject(suppression.error);
        };
      }),
  );

  await page.goto("/terrain/profil");
  await page
    .locator("main")
    .getByRole("button", { name: fr["nav.deconnexion"] })
    .click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByText(fr["terrain.deconnexion.envoyer_dabord"]),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["terrain.deconnexion.deconnecter_quand_meme"]),
  ).toBeVisible();

  // ── CAPTURE (a) ───────────────────────────────────────────────────────────
  await capturerLesDeux(page, "deconnexion-sans-instantane");
});
