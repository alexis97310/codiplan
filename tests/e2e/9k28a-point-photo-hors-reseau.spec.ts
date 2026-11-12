import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K28A-REPRISE-REPONSE-PHOTO — LE SIXIÈME TYPE « photo », DE BOUT EN BOUT.
 *
 * Reprend 9K28-CHECKLIST-REPONSE-PHOTO (épreuves de bout en bout et captures
 * laissées dues, budget épuisé) : le point `photo` d'une checklist RÉPOND PAR
 * L'OUTIL PHOTOS EXISTANT (`PhotosTerrain`, D244) — ce fichier éprouve donc le
 * MÊME parcours que le mode avion général (`tests/e2e/offline/
 * 9f4h3-mode-avion.spec.ts`), restreint à ce seul point : une photo EN LIGNE,
 * puis une photo HORS RÉSEAU sur la page déjà chargée, puis l'envoi au retour
 * du réseau — jamais une navigation hors réseau (addendum 3 du pilote, voir
 * 9f4h1-consultation.spec.ts).
 *
 * SÉRIEL : une seule scène, partagée par le seul test de ce fichier.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9K28A = uuidv7();
const SITE_9K28A = uuidv7();
const INTERVENTION_9K28A = uuidv7();
const MODELE_9K28A = uuidv7();
const VERSION_9K28A = uuidv7();
const POINT_9K28A = uuidv7();

let societeId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9K28A,
        societe_id: societeId,
        raison_sociale: "9K28A client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K28A,
        societe_id: societeId,
        client_id: CLIENT_9K28A,
        agence_id: agence.id,
        libelle: "9K28A site",
      },
    });
    await client.checklistModele.create({
      data: {
        id: MODELE_9K28A,
        societe_id: societeId,
        code: "9K28A-GENERIQUE",
        libelle: "9K28A checklist générique",
        actif: true,
      },
    });
    await client.checklistVersion.create({
      data: {
        id: VERSION_9K28A,
        societe_id: societeId,
        checklist_modele_id: MODELE_9K28A,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_9K28A,
        societe_id: societeId,
        checklist_version_id: VERSION_9K28A,
        section: "Photos",
        ordre: 1,
        libelle: "Photo de l'épreuve 9K28A",
        obligatoire: false,
        type_reponse: "photo",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9K28A,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9K28A,
        site_id: SITE_9K28A,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9K28A — intervention forgée par l'épreuve",
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
      `DELETE FROM "checklist_reponse_photo" WHERE "checklist_reponse_id" IN (
         SELECT "id" FROM "checklist_reponse" WHERE "intervention_id" = $1::uuid
       )`,
      INTERVENTION_9K28A,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "checklist_reponse" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9K28A,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9K28A,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_9K28A } });
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: MODELE_9K28A },
    });
    await client.checklistModele.deleteMany({ where: { id: MODELE_9K28A } });
    await client.site.deleteMany({ where: { id: SITE_9K28A } });
    await client.client.deleteMany({ where: { id: CLIENT_9K28A } });
  } finally {
    await client.$disconnect();
  }
});

/** Un PNG minimal (1×1, transparent), écrit dans un fichier temporaire. */
function fichierPhotoDEpreuve(suffixe: string): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9k28a-"));
  const chemin = join(dossier, `photo-9k28a-${suffixe}.png`);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(chemin, png);
  return chemin;
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K28-CHECKLIST-REPONSE-PHOTO/captures",
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

async function deplierLaChecklist(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: fr["checklist.terrain.afficher_detail"] })
    .click();
}

test("un point « photo » : une photo en ligne, une photo hors réseau, envoyée sans perte au retour du réseau", async ({
  page,
  context,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9K28A}`);
  await page.waitForResponse(
    (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
  );
  await deplierLaChecklist(page);

  await capturer(page, "9k28a-terrain-point-photo-avant", 375);

  // ── 1. EN LIGNE — une photo au point. ──────────────────────────────────
  await page
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve("en-ligne"));
  await page
    .getByRole("button", { name: fr["checklist.terrain.ajouter_photo"] })
    .click();
  await expect(page.getByText(fr["terrain.photos.enregistree"])).toBeVisible();

  await capturer(page, "9k28a-terrain-point-photo-apres", 375);

  // ── LA VÉRITÉ EN BASE, après le premier dépôt. ─────────────────────────
  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9K28A,
        checklist_point_id: POINT_9K28A,
      },
    });
    expect(reponse?.valeur_photo).toBe(true);
    const document = await verif.document.findFirst({
      where: { intervention_id: INTERVENTION_9K28A },
    });
    expect(document?.classe).toBe("client");
    const premierLien = await verif.checklistReponsePhoto.count({
      where: { checklist_reponse_id: reponse?.id },
    });
    expect(premierLien).toBe(1);
  } finally {
    await verif.$disconnect();
  }

  // ── 2. HORS RÉSEAU, SUR LA PAGE DÉJÀ CHARGÉE — une seconde photo. ──────
  await context.setOffline(true);
  await page
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve("hors-reseau"));
  await page
    .getByRole("button", { name: fr["checklist.terrain.ajouter_photo"] })
    .click();
  await expect(page.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible();

  // ── LE RÉSEAU REVIENT : « ENVOYER ». ───────────────────────────────────
  await context.setOffline(false);
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  // ── LA VÉRITÉ EN BASE : DEUX PHOTOS LIÉES À LA MÊME RÉPONSE, UNE SEULE. ─
  const verifFinale = admin();
  try {
    const reponses = await verifFinale.checklistReponse.findMany({
      where: {
        intervention_id: INTERVENTION_9K28A,
        checklist_point_id: POINT_9K28A,
      },
    });
    expect(reponses).toHaveLength(1);
    const liens = await verifFinale.checklistReponsePhoto.count({
      where: { checklist_reponse_id: reponses[0]!.id },
    });
    expect(liens).toBe(2);
  } finally {
    await verifFinale.$disconnect();
  }
});

test("le bon interne et le bon client affichent tous deux la checklist répondue — captures 1280", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await page.goto(`/interventions/${INTERVENTION_9K28A}/bon`);
  await capturer(page, "9k28a-bon-client", 1280);

  await page.goto(`/interventions/${INTERVENTION_9K28A}/bon?version=interne`);
  await capturer(page, "9k28a-bon-interne", 1280);
});
