import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES — 9I7-BON-INTERVENTION-EN-TUILES, point 2 bis et point 5.
 *
 * Un bon préventif et un bon curatif, en 1280 px et en rendu impression,
 * AVEC logo et mentions légales. Le semis de démonstration n'en porte ni
 * l'un ni l'autre (`prisma/seed-data.ts`) : les poser ici, le plus tard
 * possible, et les RETIRER dans `afterAll` — même discipline que
 * `tests/e2e/9ez-logo-societe.spec.ts`, pour la même raison (la société de
 * la scène est partagée par tout le run e2e).
 *
 * SA PROPRE PAIRE D'INTERVENTIONS, jamais celle de `9i7-bon-en-tuiles.spec.ts`
 * ni de `bon-intervention.spec.ts` (AFFICHAGE-MATERIEL-1).
 */
test.describe.configure({ mode: "serial" });

const BON_CURATIF_CAP = "01a0f200-0000-7000-8000-0000000009c5";
const BON_PREVENTIF_CAP = "01a0f200-0000-7000-8000-0000000009c6";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I7-BON-INTERVENTION-EN-TUILES/captures",
);

/** Même géométrie que `tests/e2e/9ez-logo-societe.spec.ts` — voir sa note. */
function construirePngDeTest(largeur: number, hauteur: number): Buffer {
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
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (1 + largeur * 3);
    for (let x = 0; x < largeur; x++) {
      brut[debut + 1 + x * 3] = 0x0b;
      brut[debut + 1 + x * 3 + 1] = 0x5c;
      brut[debut + 1 + x * 3 + 2] = 0xad;
    }
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(brut)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG_DE_TEST = construirePngDeTest(240, 80);
const MENTIONS_LEGALES_DE_TEST =
  "CODIMA-NC — SARL au capital de 1 000 000 XPF\nRIDET 000 000.000\nSiège : 1 rue des Essais, Nouméa";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
        libelle: "Atelier principal",
      },
      select: { id: true, client_id: true },
    });
    await client.intervention.deleteMany({
      where: { id: { in: [BON_CURATIF_CAP, BON_PREVENTIF_CAP] } },
    });
    for (const [id, type] of [
      [BON_CURATIF_CAP, "curatif"],
      [BON_PREVENTIF_CAP, "preventif_contrat"],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
           "technicien_id", "type", "priorite", "statut", "date_planifiee",
           "mode_valorisation", "devise_code", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
                 $7::"TypeIntervention", 'p3', 'terminee'::"StatutIntervention",
                 now()::date, 'temps_passe', 'XPF', now())`,
        id,
        reperes.societeId,
        ducos.id,
        site.client_id,
        site.id,
        reperes.technicienDucos,
        type,
      );
    }
    await client.societe.update({
      where: { id: reperes.societeId },
      data: {
        logo_octets: new Uint8Array(PNG_DE_TEST),
        logo_type: "image/png",
        logo_empreinte: createHash("sha256").update(PNG_DE_TEST).digest("hex"),
        mentions_legales: MENTIONS_LEGALES_DE_TEST,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [BON_CURATIF_CAP, BON_PREVENTIF_CAP] } },
    });
    await client.societe.update({
      where: { id: reperes.societeId },
      data: {
        logo_octets: null,
        logo_type: null,
        logo_empreinte: null,
        mentions_legales: null,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-${largeur}-viewport.png`),
  });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-${largeur}-plein.png`),
    fullPage: true,
  });
}

async function capturerImpression(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  // MÊME CLASSE QUE `ActionsBonIntervention` AVANT `window.print()` — posée
  // ici directement (jamais en cliquant le bouton, qui ouvrirait une boîte
  // de dialogue native) : sans elle, la capture montrerait la barre
  // latérale, jamais ce qui part réellement chez le client.
  await page.evaluate(() => document.body.classList.add("print-bon"));
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-impression.png`),
    fullPage: true,
  });
  await page.pdf({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-impression.pdf`),
    format: "A4",
  });
  await page.evaluate(() => document.body.classList.remove("print-bon"));
  await page.emulateMedia({ media: null });
}

test("bon curatif — 375 px, 1280 px et rendu impression, avec logo et mentions légales", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${BON_CURATIF_CAP}/bon`);
  await capturer(page, "bon-curatif", 375);
  await capturer(page, "bon-curatif", 1280);
  await capturerImpression(page, "bon-curatif");
});

test("bon préventif sous contrat — 1280 px et rendu impression, Prestations avancée", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${BON_PREVENTIF_CAP}/bon`);
  await capturer(page, "bon-preventif", 1280);
  await capturerImpression(page, "bon-preventif");
});
