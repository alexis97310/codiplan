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
 * LA FILE SANS PERTE, DE BOUT EN BOUT (9F4H3A-FILE-SANS-PERTE, point 6) — sa
 * propre scène, préfixée `9F4H3A-`, même discipline que `9f4h3-mode-
 * avion.spec.ts` : créée en `beforeAll`, supprimée en `afterAll`, aucune
 * ligne ajoutée au semis partagé.
 *
 * (a)+(b)+(c) sont une SEULE intervention, un SEUL flux : la dernière valeur
 * gagne (C1), un second clic « Envoyer » ne double rien, et la durée du
 * segment antidaté est celle attendue. (d) est une intervention séparée :
 * annulée pendant la coupure, sa saisie reste en file avec « Envoyer (1) »
 * toujours affiché.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H3A = uuidv7();
const SITE_9F4H3A = uuidv7();
const INTERVENTION_9F4H3A = uuidv7();
const INTERVENTION_ANNULEE_9F4H3A = uuidv7();

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
        id: CLIENT_9F4H3A,
        societe_id: societeId,
        raison_sociale: "9F4H3A client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H3A,
        societe_id: societeId,
        client_id: CLIENT_9F4H3A,
        agence_id: agence.id,
        libelle: "9F4H3A site",
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9F4H3A,
      site_id: SITE_9F4H3A,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H3A — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_9F4H3A, ...commun },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_ANNULEE_9F4H3A, ...commun },
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
      [INTERVENTION_9F4H3A, INTERVENTION_ANNULEE_9F4H3A],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H3A,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H3A } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H3A } });
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

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H3A-FILE-SANS-PERTE/captures",
);

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

/** Antidate l'entrée « démarrer » du compteur, en file, de `minutes`. */
async function antidaterLeDemarrage(
  page: Page,
  minutes: number,
): Promise<void> {
  await page.evaluate((minutes) => {
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
            magasin.put({
              ...demarrer,
              instantAppareil: new Date(
                Date.now() - minutes * 60_000,
              ).toISOString(),
            });
          }
        };
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, minutes);
}

test("(a)+(b)+(c) : A hors réseau puis AB en ligne — c'est AB qui reste ; second « Envoyer » ne double rien ; la durée antidatée est respectée", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H3A}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // ── HORS RÉSEAU : UN SEGMENT DE 42 MINUTES, MIS EN FILE (point 4/6c) ───
  await context.setOffline(true);
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_depuis"], {
      exact: false,
    }),
  ).toBeVisible();
  await antidaterLeDemarrage(page, 42);
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();

  // ── TOUJOURS HORS RÉSEAU : LE RAPPORT « A » ─────────────────────────────
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).fill("A");
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // ── LE RÉSEAU REVIENT : LE RAPPORT DEVIENT « AB », ENVOYÉ EN LIGNE ──────
  await context.setOffline(false);
  const commentaire = page.getByLabel(
    fr["terrain.rapport.commentaire_libelle"],
  );
  await commentaire.fill("AB");
  await commentaire.blur();
  await expect(
    page.getByText(fr["terrain.rapport.enregistre"]).first(),
  ).toBeVisible();

  await capturer(page, "rapport-ab-en-ligne", 375);

  // CAPTURÉS AVANT L'ENVOI — l'arrêt du compteur, pour le rejeu de (b)
  // ci-dessous (même patron que `9f4h3-mode-avion.spec.ts` pour « terminer »).
  const entreesEnFile = await page.evaluate(
    () =>
      new Promise<
        readonly {
          readonly id: string;
          readonly geste: { readonly type: string; readonly action?: string };
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
  const entreeArreter = entreesEnFile.find(
    (e) => e.geste.type === "compteur" && e.geste.action === "arreter",
  );
  expect(entreeArreter).toBeDefined();

  // La file ne porte plus de rapport pour cette intervention (C1) : le
  // bouton « Envoyer » n'a plus que le compteur à transmettre, jamais « A ».
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H3A },
      select: { commentaire_technicien: true, temps_mesure_min: true },
    });
    expect(intervention.commentaire_technicien).toBe("AB");
    // (c) LA DURÉE ANTIDATÉE EST RESPECTÉE, À ±1 MINUTE.
    expect(intervention.temps_mesure_min).not.toBeNull();
    expect(intervention.temps_mesure_min).toBeGreaterThanOrEqual(41);
    expect(intervention.temps_mesure_min).toBeLessThanOrEqual(43);

    const segmentsAvant = await verif.segmentTravail.count({
      where: { intervention_id: INTERVENTION_9F4H3A },
    });

    // (b) UN REJEU DU MÊME ENVOI — le bouton « Envoyer » a disparu (la file
    // est vide, « Tout est envoyé » l'a remplacé) : ce qu'un second clic sur
    // CE MÊME bouton aurait renvoyé, à l'identique (même operation_id, même
    // instant_appareil), c'est exactement ce rejeu — la preuve qu'il ne
    // double rien, qu'il parte d'un second clic ou d'une réponse perdue.
    const rejeu = await page.request.post(
      `/api/terrain/${INTERVENTION_9F4H3A}/compteur`,
      {
        form: {
          geste: "arreter",
          instant_appareil: entreeArreter!.instantAppareil,
          operation_id: entreeArreter!.id,
        },
        headers: { Accept: "application/json" },
      },
    );
    const corpsRejeu = (await rejeu.json()) as {
      readonly ok: boolean;
      readonly motif: string | null;
    };
    expect(corpsRejeu.ok).toBe(true);
    const segmentsApres = await verif.segmentTravail.count({
      where: { intervention_id: INTERVENTION_9F4H3A },
    });
    expect(segmentsApres).toBe(segmentsAvant);
    const interventionApres = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H3A },
      select: { commentaire_technicien: true },
    });
    expect(interventionApres.commentaire_technicien).toBe("AB");
  } finally {
    await verif.$disconnect();
  }
});

test("(d) : une intervention annulée pendant la coupure — la saisie reste en file, « Envoyer (1) » reste affiché", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_ANNULEE_9F4H3A}`);

  await context.setOffline(true);
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill("Rapport d'une intervention qui sera annulée");
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  const bureau = admin();
  try {
    await bureau.intervention.update({
      where: { id: INTERVENTION_ANNULEE_9F4H3A },
      data: { statut: "annulee" },
    });
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(false);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["intervention.refus.annulee_figee"] }),
  ).toBeVisible();

  // L'ENTRÉE RESTE EN FILE, AVEC SON MOTIF — « Envoyer (1) » reste affiché,
  // jamais « Tout est envoyé » ni un bouton disparu.
  await expect(
    page.getByRole("button", { name: fr["terrain.file.envoyer"] + " (1)" }),
  ).toBeVisible();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toHaveCount(0);

  await capturer(page, "annulee-envoyer-un-reste", 375);
});
