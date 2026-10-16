import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURES EN VIEWPORT, PASTILLE AVEC LOGO (9EZ-LOGO-SOCIETE-3-CORRECTIFS,
 * point 4) — jamais `fullPage` (revue de 9EZ-LOGO-SOCIETE-1, point BAS) : une
 * capture plein contenu ne montre pas forcément ce qui est visible sans
 * défiler, exactement la question que ce correctif répare.
 *
 * **Un logo d'une couleur qui TRANCHE sur la pastille** (`#0b5cad`, voir
 * `components/theme/bandeau-societe.tsx`) — `PNG_MINIMAL` de
 * `9ez-logo-societe.spec.ts` est bleu sur bleu, invisible sur ses propres
 * captures (revue, point MOYEN). Celui-ci est orange vif.
 *
 * `test.describe.configure({ mode: "serial" })` : même discipline que
 * `9ez-logo-societe.spec.ts` — la société de la scène est partagée par tout
 * le run e2e, le logo est déposé le plus tard possible et retiré dans un
 * `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER =
  process.env.CAPTURES_9EZ3 ??
  join("docs", "propositions", "9EZ-LOGO-SOCIETE-3-CORRECTIFS", "captures");

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

/** Même fabrique que `9ez-logo-societe.spec.ts`, une couleur différente (I9). */
function construirePngDeTest(
  largeur: number,
  hauteur: number,
  rvb: readonly [number, number, number],
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const [r, v, b] = rvb;
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (1 + largeur * 3);
    for (let x = 0; x < largeur; x++) {
      brut[debut + 1 + x * 3] = r;
      brut[debut + 1 + x * 3 + 1] = v;
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

// Orange vif — tranche sur le bleu `#0b5cad` de la pastille (D122/L0-09).
const PNG_CONTRASTE = construirePngDeTest(64, 24, [0xff, 0x8c, 0x00]);

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

async function retirerLeLogo(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const reperes = await reperesDeLaScene();
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { logo_octets: null, logo_type: null, logo_empreinte: null },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EZ3-Client (pastille)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EZ3-Lieu (pastille)",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "planifiee",
        type: "curatif",
        duree_estimee_min: 60,
        date_planifiee: new Date(),
      },
    });
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'en_cours'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
  } finally {
    await client.$disconnect();
  }
  await retirerLeLogo();
});

test.afterAll(async () => {
  await retirerLeLogo();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

/** EN VIEWPORT, jamais `fullPage` — voir l'entête du fichier. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}.png`) });
}

test("déposer le logo contrasté", async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/societe");
  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez3-logo.png",
    mimeType: "image/png",
    buffer: PNG_CONTRASTE,
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#contenu").getByRole("img")).toBeVisible();
});

test("capture — barre avec logo, à 1280px", async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parametres");
  await expect(
    page.locator("#colonne-navigation").getByRole("img"),
  ).toBeVisible();
  await capturer(page, "barre-avec-logo-viewport", 1280);
});

test("capture — rail (replié) avec logo, à 1024px — le logo ne s'y montre pas (repliee)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/parametres");
  await expect(page.locator("#colonne-navigation")).toBeVisible();
  await capturer(page, "barre-avec-logo-viewport", 1024);
});

for (const largeur of [375, 1280] as const) {
  test(`capture — bon d'intervention avec logo, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
    await expect(
      page.locator(".zone-impression-bon").getByRole("img"),
    ).toBeVisible();
    await capturer(page, "bon-avec-logo-viewport", largeur);
  });
}

test("capture — bandeau du terrain avec logo, à 375px", async ({ browser }) => {
  const contexte = await browser.newContext({
    viewport: { width: 375, height: 844 },
  });
  const page = await contexte.newPage();
  try {
    await page.goto("/connexion");
    await page
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain$/);
    await expect(
      page.locator("[data-origine-theme]").getByRole("img"),
    ).toBeVisible();
    await capturer(page, "bandeau-terrain-avec-logo-viewport", 375);
  } finally {
    await contexte.close();
  }
});
