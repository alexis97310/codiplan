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
  COMPTE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EZ-LOGO-SOCIETE-1 (D87) — LE LOGO DE LA SOCIÉTÉ, DE BOUT EN BOUT.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * Les épreuves d'isolation (`tests/isolation/logo-societe.test.ts`,
 * `logo-societe-routes.test.ts`) prouvent le cloisonnement RÉEL, sous les
 * politiques RLS, entre deux sociétés distinctes. Elles ne peuvent pas
 * prouver qu'un administrateur qui dépose un fichier depuis l'écran voit
 * réellement ce logo réapparaître dans la barre ET sur le bon, ni qu'un ADV
 * qui n'a pas la capacité reçoit un refus LISIBLE plutôt qu'une page cassée.
 *
 * **La société de la scène est PARTAGÉE par tout le run e2e** — contrairement
 * à une intervention ou un client, `societe.logo_*` n'a pas de fixture à soi.
 * Ce fichier tourne donc en SÉRIE, dépose son logo le plus tard possible
 * (après les captures « sans logo »), et le RETIRE dans un `afterAll` — la
 * fenêtre où la barre d'une AUTRE épreuve pourrait la voir est donc la plus
 * courte possible, et `CI=1 pnpm verify:full` l'exécute de toute façon à
 * `workers: 1` (aucune autre épreuve ne tourne en même temps).
 *
 * **Isolation société-à-société** : déjà prouvée en profondeur par les
 * épreuves d'isolation ci-dessus, sous les vraies politiques RLS. La scène
 * e2e ne porte qu'UNE société connectable ; construire une seconde société
 * et son propre compte uniquement pour ce test dupliquerait, en plus
 * fragile, ce que l'isolation a déjà prouvé — non reproduit ici.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EZ ?? "";

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

/**
 * UN PNG RÉELLEMENT DÉCODABLE, GÉNÉRÉ ICI (I9 — jamais un vrai logo
 * d'entreprise). Une suite d'octets magiques seuls (comme ailleurs dans le
 * dépôt pour n'éprouver QUE la détection serveur) passerait
 * `formatImageReconnu` mais rendrait une icône d'image cassée à l'écran — ce
 * que les captures de ce fichier doivent éviter. 64×24, une couleur pleine :
 * assez grand pour se voir dans une capture, à peine plus gros qu'un pixel.
 */
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
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie (RGB)
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

const PNG_MINIMAL = construirePngDeTest(64, 24);
const JPEG_MINIMAL = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);

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
  // Fixture `zz9EZ-` (I9) : SA PROPRE intervention, jamais `SCENE.*`.
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
        raison_sociale: "zz9EZ-Client (logo)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EZ-Lieu (logo)",
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
    // LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1) —
    // même geste que `captures-9ewb-photos-en-base.spec.ts` : deux UPDATE
    // successifs pour respecter les transitions de statut.
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

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirEnAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

for (const largeur of [375, 1280] as const) {
  test(`capture — écran Société, sans logo, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirEnAdmin(page);
    await page.goto("/parametres/societe");
    await expect(page.getByText(fr["societe.logo_absent"])).toBeVisible();
    await capturer(page, "societe-sans-logo", largeur);
  });
}

test("(a) l'administrateur dépose un PNG — aperçu, barre, bon", async ({
  page,
}) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");

  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez-logo.png",
    mimeType: "image/png",
    buffer: PNG_MINIMAL,
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  // L'APERÇU de l'écran — scopé à `#contenu` : la barre affiche AUSSI le
  // logo désormais, et les deux partagent le même texte alternatif.
  await expect(
    page.locator("#contenu").getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();

  // LE PIED DE LA BARRE (desktop, colonne verticale).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parametres");
  await expect(
    page
      .locator("#colonne-navigation")
      .getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();

  // LE BON D'INTERVENTION — scopé à sa propre zone, hors de la barre.
  await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
  await expect(
    page
      .locator(".zone-impression-bon")
      .getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();

  for (const largeur of [375, 1280] as const) {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto("/parametres/societe");
    await capturer(page, "societe-avec-logo", largeur);
    await page.goto("/parametres");
    await capturer(page, "barre-avec-logo", largeur);
    await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
    await capturer(page, "bon-avec-logo", largeur);
  }
});

/**
 * LE NOM NE DÉBORDE JAMAIS DE LA PASTILLE (9EZ-LOGO-SOCIETE-3-CORRECTIFS) —
 * `[data-origine-theme]` est déjà posé par `BandeauSociete` pour un autre
 * usage, et sert ici de repère stable : géométrie, jamais un texte.
 */
type Boite = { readonly x: number; readonly width: number };

async function boitesDeLaPastille(
  page: Page,
): Promise<{ pastille: Boite; nom: Boite }> {
  const pastille = page.locator("[data-origine-theme]").first();
  await expect(pastille).toBeVisible();
  const nom = pastille.locator("span");
  const boitePastille = await pastille.boundingBox();
  const boiteNom = await nom.boundingBox();
  if (boitePastille === null || boiteNom === null) {
    throw new Error("boundingBox indisponible pour la pastille ou le nom.");
  }
  return { pastille: boitePastille, nom: boiteNom };
}

test("(e) le nom reste DANS la pastille — colonne à 1280, rail à 1024, bandeau du terrain à 375", async ({
  page,
  browser,
}) => {
  await ouvrirEnAdmin(page);

  // LA COLONNE DÉPLOYÉE (1280) PUIS LE RAIL (1024, QE-4, D171 — automatique
  // entre 901 et 1199 px, sans préférence posée).
  for (const largeur of [1280, 1024] as const) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/parametres");
    const { pastille, nom } = await boitesDeLaPastille(page);
    expect(nom.x).toBeGreaterThanOrEqual(pastille.x - 1);
    expect(nom.x + nom.width).toBeLessThanOrEqual(
      pastille.x + pastille.width + 1,
    );
  }

  // LE BANDEAU HORIZONTAL DU TERRAIN (R5-01) — un chrome distinct de la
  // colonne, jamais mesuré par `(f)` ci-dessous, qui ne visite que
  // `/parametres`. UN SECOND CONTEXTE, jamais la session admin déjà ouverte
  // sur `page` : `/connexion`, visitée avec une session active, redirige
  // vers l'écran du rôle plutôt que de rendre le formulaire.
  const contexteTerrain = await browser.newContext({
    viewport: { width: 375, height: 844 },
  });
  const pageTerrain = await contexteTerrain.newPage();
  try {
    await pageTerrain.goto("/connexion");
    await pageTerrain
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await pageTerrain
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await pageTerrain
      .getByRole("button", { name: fr["connexion.valider"] })
      .click();
    await expect(pageTerrain).toHaveURL(/\/terrain$/);

    const { pastille, nom } = await boitesDeLaPastille(pageTerrain);
    expect(nom.x + nom.width).toBeLessThanOrEqual(
      pastille.x + pastille.width + 1,
    );
    const scrollWidth = await pageTerrain.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(376);
  } finally {
    await contexteTerrain.close();
  }
});

test("(b) un SVG est refusé, en le nommant, le logo est inchangé", async ({
  page,
}) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");

  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg onload='alert(1)'></svg>"),
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(fr["logo.refus.type"])).toBeVisible();
  // Le logo PNG déposé par (a) est toujours là — aucune régression.
  await expect(
    page.locator("#contenu").getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();
});

test("(b) un fichier de plus de 300 Ko est refusé", async ({ page }) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");

  const trop = Buffer.concat([PNG_MINIMAL, Buffer.alloc(300 * 1024)]);
  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez-trop-lourd.png",
    mimeType: "image/png",
    buffer: trop,
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(fr["logo.refus.taille"])).toBeVisible();
});

test("(b) un texte renommé .png est refusé — l'extension ne suffit pas", async ({
  page,
}) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");

  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez-faux.png",
    mimeType: "image/png",
    buffer: Buffer.from("ceci n'est pas une image"),
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(fr["logo.refus.type"])).toBeVisible();
});

test("(a bis) un JPEG est accepté aussi", async ({ page }) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");

  await page.locator('input[type="file"]').setInputFiles({
    name: "zz9ez-logo.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG_MINIMAL,
  });
  await page
    .getByRole("button", { name: fr["societe.logo_enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.locator("#contenu").getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();
});

test("(c) retirer le logo — la barre et le bon reviennent au nom seul", async ({
  page,
}) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres/societe");
  await expect(
    page.locator("#contenu").getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toBeVisible();

  await page.getByRole("button", { name: fr["societe.logo_retirer"] }).click();
  await page
    .getByRole("button", { name: fr["societe.logo_retirer_confirmer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(fr["societe.logo_absent"])).toBeVisible();

  await page.goto("/parametres");
  await expect(
    page.getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toHaveCount(0);

  await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
  await expect(
    page.getByRole("img", { name: fr["societe.logo_alt"] }),
  ).toHaveCount(0);
});

test("(d) un compte ADV — page refusée, POST refusé, avec son motif", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);

  await page.goto("/parametres/societe");
  await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();

  const reponse = await page.request.post("/api/parametres/societe/logo", {
    multipart: {
      logo: {
        name: "zz9ez-adv.png",
        mimeType: "image/png",
        buffer: PNG_MINIMAL,
      },
    },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"]).toContain("motif=auth.refus_droit");
});

for (const largeur of [375, 1280] as const) {
  test(`(f) à ${largeur}px, aucun débordement de la barre ou du bandeau`, async ({
    page,
  }) => {
    await ouvrirEnAdmin(page);
    await page.goto("/parametres/societe");
    await page.locator('input[type="file"]').setInputFiles({
      name: "zz9ez-logo.png",
      mimeType: "image/png",
      buffer: PNG_MINIMAL,
    });
    await page
      .getByRole("button", { name: fr["societe.logo_enregistrer"] })
      .click();
    await page.waitForLoadState("networkidle");

    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto("/parametres");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(largeur + 1);

    await retirerLeLogo();
  });
}
