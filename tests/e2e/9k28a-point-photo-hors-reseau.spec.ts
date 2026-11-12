import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

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

/**
 * UN PNG RÉELLEMENT DÉCODABLE, GÉNÉRÉ ICI (I9), UNE COULEUR PLEINE PAR APPEL
 * — même patron que `construirePngDeTest` (`9ez-logo-societe.spec.ts`).
 *
 * **UNE COULEUR DISTINCTE PAR PHOTO, ET C'EST OBLIGATOIRE** : `PhotosTerrain`
 * réduit côté client avant l'envoi (`reduire`, `photos-terrain.tsx`), et le
 * dépôt dédoublonne par empreinte SHA-256 du résultat, PAR INTERVENTION
 * (`lib/documents/depot.ts`). Deux photos visuellement IDENTIQUES (un même
 * pixel 1×1 transparent, la première version de cette fixture) produisent la
 * MÊME empreinte après réduction — le dépôt les reconnaît alors comme le
 * REJEU d'une même photo, jamais comme deux photos distinctes, et la seconde
 * ne crée aucun second lien `checklist_reponse_photo` (mesuré : `liens`
 * restait à 1 au lieu de 2 — pas un défaut de l'application, un défaut de
 * cette fixture).
 */
function construirePngDeTest(
  couleur: readonly [number, number, number],
): Buffer {
  const crc32 = (() => {
    const table = Array.from({ length: 256 }, (_unused, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      return c >>> 0;
    });
    return (buf: Buffer): number => {
      let crc = 0xffffffff;
      for (const octet of buf) {
        crc = (table[(crc ^ octet) & 0xff] ?? 0) ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
  })();
  const chunk = (type: string, data: Buffer): Buffer => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(data.length, 0);
    const typeEtDonnees = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeEtDonnees), 0);
    return Buffer.concat([longueur, typeEtDonnees, crc]);
  };
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const largeur = 8;
  const hauteur = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie (RGB)
  const [r, g, b] = couleur;
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (1 + largeur * 3);
    for (let x = 0; x < largeur; x++) {
      brut[debut + 1 + x * 3] = r;
      brut[debut + 1 + x * 3 + 1] = g;
      brut[debut + 1 + x * 3 + 2] = b;
    }
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(brut)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const COULEURS_DEPREUVE: Readonly<
  Record<string, readonly [number, number, number]>
> = {
  "en-ligne": [0x0b, 0x5c, 0xad],
  "hors-reseau": [0xad, 0x5c, 0x0b],
};

function fichierPhotoDEpreuve(suffixe: string): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9k28a-"));
  const chemin = join(dossier, `photo-9k28a-${suffixe}.png`);
  writeFileSync(
    chemin,
    construirePngDeTest(COULEURS_DEPREUVE[suffixe] ?? [0, 0, 0]),
  );
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

/**
 * LE `<form>` DE LA `PhotosTerrain` EMBARQUÉE AU POINT — la fiche terrain
 * porte DEUX formulaires `PhotosTerrain` (la section « Photos » générale, et
 * celle-ci), MÊME COMPOSANT (`checklist-terrain.tsx`, `photos-terrain.tsx`),
 * MÊME LIBELLÉ DE BOUTON (« Ajouter une photo », `checklist.terrain.
 * ajouter_photo` ET `terrain.photos.ajouter`) : ni `input[type="file"]` ni
 * `getByRole("button", …)` seuls n'y sont univoques. Son champ caché
 * `checklist_point_id` (posé UNIQUEMENT par l'instance du point, voir
 * `photos-terrain.tsx`) distingue son `<form>` sans ambiguïté — tout ce que
 * cette épreuve cherche DANS ce formulaire part de là.
 */
function formulaireDuPointPhoto(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.locator('input[name="checklist_point_id"]') });
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
  const formulairePoint = formulaireDuPointPhoto(page);
  await formulairePoint
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve("en-ligne"));
  await formulairePoint
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
  await formulairePoint
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve("hors-reseau"));
  await formulairePoint
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
