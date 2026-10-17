import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * LE MODE AVION, DE BOUT EN BOUT (9F4H3-HORS-RESEAU-ENVOYER, point 4 ;
 * décisions n° 105 et 108 d'Alexis, 14/10/2026).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H3-` — même discipline que 9F4H2
 *
 * Un client, un site, DEUX interventions (l'une menée jusqu'au bout, l'autre
 * annulée pendant la coupure) et une prestation active — créés en
 * `beforeAll`, supprimés en `afterAll`, aucune ligne ajoutée au semis ni à
 * `SCENE` (`tests/e2e/setup/scene.ts`), lue concurremment par d'autres
 * fichiers sous `fullyParallel`.
 *
 * ## CE QUE CE FICHIER NE SIMULE PAS
 *
 * `context.setOffline(true)` coupe la pile réseau du NAVIGATEUR — tout
 * `fetch()` lancé depuis la page échoue réellement. Aucun `goto` n'est joué
 * hors connexion : la page `/terrain/{id}` est chargée EN LIGNE, puis la
 * coupure survient sur la page déjà montée — exactement le parcours réel
 * (voir l'addendum 3 du pilote sur `tests/e2e/offline/9f4h1-
 * consultation.spec.ts` : une NAVIGATION hors réseau vers `/terrain` n'est
 * pas mesurable ici, et ce fichier ne le prétend pas).
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H3 = uuidv7();
const SITE_9F4H3 = uuidv7();
const INTERVENTION_9F4H3 = uuidv7();
const INTERVENTION_REFUS_9F4H3 = uuidv7();
const PRESTATION_9F4H3 = uuidv7();

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
        id: CLIENT_9F4H3,
        societe_id: societeId,
        raison_sociale: "9F4H3 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H3,
        societe_id: societeId,
        client_id: CLIENT_9F4H3,
        agence_id: agence.id,
        libelle: "9F4H3 site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_9F4H3,
        societe_id: societeId,
        code: "9F4H3-PREST",
        libelle: fr["terrain.e2e.prestation_libelle"],
        actif: true,
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9F4H3,
      site_id: SITE_9F4H3,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H3 — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      // SANS DATE (9F2B) — évite toute dépendance à la fenêtre
      // [aujourd'hui, J+8[ de « Ma journée », qui dépend du jour courant.
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_9F4H3, ...commun },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_REFUS_9F4H3, ...commun },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_9F4H3, INTERVENTION_REFUS_9F4H3],
    );
    // `document.intervention` est `onDelete: Restrict` (la photo déposée
    // hors réseau) — à la différence des prestations/signatures réalisées,
    // qui cascadent depuis l'intervention.
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_9F4H3, INTERVENTION_REFUS_9F4H3],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H3,
    );
    await client.prestation.deleteMany({ where: { id: PRESTATION_9F4H3 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H3 } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H3 } });
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

const COMMENTAIRE_EPREUVE = fr["terrain.e2e.commentaire"];
const SUITE_EPREUVE = fr["terrain.e2e.suite_a_donner"];
const SIGNATAIRE_EPREUVE = fr["terrain.e2e.signataire_nom"];

/** Un PNG minimal (1×1, transparent), écrit dans un fichier temporaire. */
function fichierPhotoDEpreuve(): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9f4h3-"));
  const chemin = join(dossier, "photo-9f4h3.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(chemin, png);
  return chemin;
}

async function tracerLaSignature(page: Page): Promise<void> {
  await page.locator("canvas").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
          pointerId: 1,
        }),
      );
    };
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointermove", 200, 30);
    envoyer("pointerup", 200, 30);
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H3-HORS-RESEAU-ENVOYER/captures",
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

test("saisie complète hors réseau, gardée sur le téléphone, puis envoyée sans doublon au retour du réseau", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H3}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // ── HORS RÉSEAU, SUR LA PAGE DÉJÀ CHARGÉE ──────────────────────────────
  await context.setOffline(true);

  // 1. DÉMARRER LE COMPTEUR — mis en file, jamais envoyé.
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_depuis"], {
      exact: false,
    }),
  ).toBeVisible();
  // LE BOUTON PROPOSE MAINTENANT LA PAUSE, SANS AVOIR JOINT LE SERVEUR.
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  await capturer(page, "fiche-hors-reseau-en-attente", 375);
  await capturer(page, "fiche-hors-reseau-en-attente", 1280);

  // ANTIDATE L'ENTRÉE « DÉMARRER » DE 90 MINUTES — un temps mesuré
  // STRICTEMENT POSITIF est exigé par `peutTerminer` ; attendre réellement
  // 90 minutes dans une épreuve serait absurde, et ce n'est pas le fuseau
  // ni l'heure SERVEUR qui est en cause ici (L0-08) mais la seule DURÉE
  // entre deux instants d'APPAREIL déjà posés.
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const requete = indexedDB.open("codiplan-terrain");
      requete.onerror = () => reject(requete.error);
      requete.onsuccess = () => {
        const base = requete.result;
        const transaction = base.transaction("file", "readwrite");
        const magasin = transaction.objectStore("file");
        const lecture = magasin.getAll();
        lecture.onsuccess = () => {
          type Entree = {
            readonly id: string;
            readonly geste: { readonly type: string; readonly action?: string };
            readonly instantAppareil: string;
          };
          const demarrer = (lecture.result as Entree[]).find(
            (e) => e.geste.type === "compteur" && e.geste.action === "demarrer",
          );
          if (demarrer !== undefined) {
            const antidatee = {
              ...demarrer,
              instantAppareil: new Date(Date.now() - 90 * 60_000).toISOString(),
            };
            magasin.put(antidatee);
          }
        };
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  // ARRÊTER LE COMPTEUR — même ordre que le pipeline d'envoi
  // (démarrer → arrêter → rapport/prestations/photos → signature →
  // terminer).
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_arrete"], {
      exact: false,
    }),
  ).toBeVisible();

  // 2. RAPPORT — commentaire et suite à donner.
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(COMMENTAIRE_EPREUVE);
  await page
    .getByLabel(fr["terrain.rapport.suite_libelle"])
    .fill(SUITE_EPREUVE);
  await page.getByLabel(fr["terrain.rapport.suite_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // 3. UNE PRESTATION COCHÉE.
  await page
    .getByRole("checkbox", {
      name: fr["terrain.e2e.prestation_libelle"],
    })
    .check();

  // 4. UNE PHOTO AJOUTÉE — réduite sur l'appareil, gardée en file.
  await page
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve());
  await page
    .getByRole("button", { name: fr["terrain.photos.ajouter"] })
    .click();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).last(),
  ).toBeVisible();

  // 5. SIGNATURE DU CLIENT.
  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill(SIGNATAIRE_EPREUVE);
  await tracerLaSignature(page);

  // 6. TERMINER — ACCEPTÉ LOCALEMENT (décision n° 108), jamais refusé.
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toHaveCount(0);

  await capturer(page, "fiche-hors-reseau-terminee-en-attente", 375);

  // ── LA FILE SURVIT, VÉRIFIÉE DIRECTEMENT DANS INDEXEDDB ────────────────
  // (une navigation hors réseau vers `/terrain/{id}` n'est pas mesurable
  // ici, voir l'en-tête de ce fichier — la PERSISTANCE, elle, l'est.) Au
  // passage, l'`id` de l'entrée « terminer » est capturé — c'est lui qui
  // devient `operation_id` à l'envoi (voir `lib/terrain/envoi-file.ts`) ; il
  // sert plus bas à REJOUER le même envoi (point 4 : « second clic Envoyer,
  // ou rejeu forcé, → rien de doublé »), exactement comme le ferait un
  // second clic si la réponse du premier s'était perdue en route.
  const entreesEnFile = await page.evaluate(
    () =>
      new Promise<
        readonly {
          readonly id: string;
          readonly geste: { readonly type: string };
          readonly instantAppareil: string;
        }[]
      >((resolve, reject) => {
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
            resolve(lecture.result);
          };
          lecture.onerror = () => reject(lecture.error);
        };
      }),
  );
  // démarrer, arrêter, rapport, prestations, photo, signature, terminer.
  expect(entreesEnFile).toHaveLength(7);
  const entreeTerminer = entreesEnFile.find((e) => e.geste.type === "terminer");
  expect(entreeTerminer).toBeDefined();
  const operationIdTerminer = entreeTerminer?.id as string;
  const instantAppareilTerminer = entreeTerminer?.instantAppareil as string;

  // ── LE RÉSEAU REVIENT : « ENVOYER » ─────────────────────────────────────
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }),
  ).toBeVisible();
  // REMONTÉ EN HAUT DE PAGE — le bouton vit juste sous le bandeau réseau ;
  // sans ce défilement, la capture montrerait encore le bas de la fiche où
  // la dernière saisie (signature) a eu lieu.
  await page.evaluate(() => window.scrollTo(0, 0));
  await capturer(page, "bouton-envoyer", 375);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  // ── CÔTÉ BASE : UN SEUL SEGMENT, SAISI HORS RÉSEAU, LA SUITE AU COMPLET ─
  const verif = admin();
  try {
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H3 },
      select: { saisi_hors_reseau: true, debut: true, fin: true },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].saisi_hors_reseau).toBe(true);
    expect(segments[0].fin).not.toBeNull();

    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H3 },
      select: {
        statut: true,
        commentaire_technicien: true,
        suite_a_donner: true,
        temps_mesure_min: true,
        prestations_realisees: { select: { prestation_id: true } },
        signatures: { select: { issue: true } },
        documents: { select: { id: true } },
      },
    });
    expect(intervention.statut).toBe("terminee");
    expect(intervention.commentaire_technicien).toBe(COMMENTAIRE_EPREUVE);
    expect(intervention.suite_a_donner).toBe(SUITE_EPREUVE);
    expect(intervention.temps_mesure_min).not.toBeNull();
    expect(intervention.prestations_realisees).toHaveLength(1);
    expect(intervention.prestations_realisees[0].prestation_id).toBe(
      PRESTATION_9F4H3,
    );
    expect(intervention.signatures).toHaveLength(1);
    expect(intervention.signatures[0].issue).toBe("signee");
    expect(intervention.documents).toHaveLength(1);
  } finally {
    await verif.$disconnect();
  }

  // ── UN REJEU FORCÉ DE LA MÊME OPÉRATION NE DOUBLE RIEN ─────────────────
  // (le second clic « Envoyer » décrit par le point 4 n'a plus rien à
  // envoyer — la file est déjà vide, voir « Tout est envoyé » ci-dessus.
  // Ce rejeu REJOUE le `operation_id` RÉEL capturé ci-dessus, exactement
  // comme le ferait un second clic « Envoyer » si la réponse du premier
  // s'était perdue en route — l'épreuve même que 9F4H2 promet.)
  const reponseRejeu = await page.request.post(
    `/api/terrain/${INTERVENTION_9F4H3}/terminer`,
    {
      form: {
        instant_appareil: instantAppareilTerminer,
        operation_id: operationIdTerminer,
      },
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    },
  );
  const corpsRejeu = (await reponseRejeu.json()) as {
    readonly ok: boolean;
    readonly motif: string | null;
  };
  expect(corpsRejeu.ok).toBe(true);

  const rejoueur = admin();
  try {
    const segmentsApres = await rejoueur.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H3 },
    });
    // UN SEUL SEGMENT — le rejeu est reconnu, rien de plus écrit.
    expect(segmentsApres).toHaveLength(1);
  } finally {
    await rejoueur.$disconnect();
  }
});

test("une intervention annulée au bureau pendant la coupure : la saisie reste en file, son motif s'affiche, rien n'est écrit", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_REFUS_9F4H3}`);

  await context.setOffline(true);
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(COMMENTAIRE_EPREUVE);
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // L'INTERVENTION EST ANNULÉE AU BUREAU PENDANT LA COUPURE.
  const bureau = admin();
  try {
    await bureau.intervention.update({
      where: { id: INTERVENTION_REFUS_9F4H3 },
      data: { statut: "annulee" },
    });
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(false);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  // LE MOTIF, EN CLAIR, DANS LE BANDEAU DE LA FILE (point 2) — `router.
  // refresh()` (appelé par `BoutonEnvoyer` quoi qu'il arrive) rafraîchit
  // ensuite la page avec le statut désormais « annulée » : le MÊME texte
  // générique apparaît alors aussi sur le compteur et sur « Terminer »,
  // chacun pour sa propre raison — `getByRole("status")` cible le
  // bandeau DE LA FILE, et lui seul.
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["intervention.refus.annulee_figee"] }),
  ).toBeVisible();

  await capturer(page, "refus-annulee-au-bureau", 375);

  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_REFUS_9F4H3 },
      select: { commentaire_technicien: true, statut: true },
    });
    // RIEN N'A ÉTÉ ÉCRIT sur l'intervention annulée — le refus a arrêté
    // l'envoi AVANT toute écriture (point 2).
    expect(intervention.commentaire_technicien).toBeNull();
    expect(intervention.statut).toBe("annulee");
  } finally {
    await verif.$disconnect();
  }
});
