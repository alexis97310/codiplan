import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LE REFUS NOMMÉ DU POINT 1 (9F4H2A-REJEU-SANS-DOUBLON), À L'ÉCRAN — une
 * saisie « terminer » hors réseau dont l'heure de l'APPAREIL précède le
 * démarrage du segment ouvert (dérive d'horloge) est désormais refusée par
 * `compteur.refus.fin_avant_debut`, affiché en clair par le bandeau de
 * `BoutonEnvoyer` (9F4H3) au lieu d'un `intervention.refus.erreur_serveur`
 * générique.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9F4H2A-` — même discipline que 9F4H2/9F4H3 :
 * une intervention jetable, créée en `beforeAll`, supprimée en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H2A = uuidv7();
const SITE_9F4H2A = uuidv7();
const INTERVENTION_9F4H2A = uuidv7();

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
        id: CLIENT_9F4H2A,
        societe_id: societeId,
        raison_sociale: "9F4H2A client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H2A,
        societe_id: societeId,
        client_id: CLIENT_9F4H2A,
        agence_id: agence.id,
        libelle: "9F4H2A site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H2A,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H2A,
        site_id: SITE_9F4H2A,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H2A — intervention forgée par l'épreuve",
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
      INTERVENTION_9F4H2A,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H2A,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H2A } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H2A } });
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
  "docs/propositions/9F4H2A-REJEU-SANS-DOUBLON/captures",
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

test("terminer hors réseau avec une heure d'appareil antérieure au démarrage : refus nommé, en clair", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H2A}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  await context.setOffline(true);

  // DÉMARRER — mis en file.
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.hors_reseau_depuis"], {
      exact: false,
    }),
  ).toBeVisible();

  // SIGNATURE — requise par le client avant d'accepter « Terminer » hors
  // réseau (D215).
  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill("Jean Dupont");
  await tracerLaSignature(page);

  // TERMINER — accepté LOCALEMENT (décision n° 108), mis en file lui aussi.
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();

  // L'HEURE DE L'APPAREIL DÉRIVE (point 1) — l'entrée « terminer » est
  // reposée à une minute AVANT celle de « démarrer », directement dans la
  // file sur l'appareil : exactement ce qu'une horloge en retard produirait,
  // sans attendre une vraie dérive.
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
          const entrees = lecture.result as Entree[];
          const demarrer = entrees.find(
            (e) => e.geste.type === "compteur" && e.geste.action === "demarrer",
          );
          const terminer = entrees.find((e) => e.geste.type === "terminer");
          if (demarrer !== undefined && terminer !== undefined) {
            const avant = new Date(
              new Date(demarrer.instantAppareil).getTime() - 60_000,
            ).toISOString();
            magasin.put({ ...terminer, instantAppareil: avant });
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

  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();

  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["compteur.refus.fin_avant_debut"] }),
  ).toBeVisible();

  await capturer(page, "refus-fin-avant-debut", 375);
  await capturer(page, "refus-fin-avant-debut", 1280);

  // RIEN N'EST ÉCRIT SUR L'INTERVENTION : le segment reste ouvert, le statut
  // n'a jamais atteint « terminee ».
  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H2A },
      select: { statut: true },
    });
    expect(intervention.statut).toBe("en_cours");
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H2A },
      select: { fin: true },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].fin).toBeNull();
  } finally {
    await verif.$disconnect();
  }
});
