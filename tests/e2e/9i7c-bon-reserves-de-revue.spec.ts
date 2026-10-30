import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I7C-BON-RESERVES-DE-REVUE, POINT 4 — LES PREUVES QUE 9I7 N'AVAIT PAS.
 *
 * `665b2b47` ne portait que des captures sur la zone imprimée, jamais
 * d'assertion : rien n'empêchait une régression (voir le point 3 de ce
 * ticket) de passer `verify:full` en vert. Ce fichier éprouve, SOUS
 * `page.emulateMedia({ media: "print" })`, ce qu'un `tests/unit/*` ne peut
 * pas voir — les mentions légales et le logo au pied/en-tête du document, et
 * la date/le technicien de l'en-tête et de la tuile Intervention.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9I7C-`, jamais celle d'un autre spec de bon.
 * Le logo et les mentions légales sont posés sur la SOCIÉTÉ partagée
 * (même limite que `captures-9i7-bon-en-tuiles.spec.ts`) : mode série,
 * retirés en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const INTERVENTION_CLOTUREE = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();

/** Même géométrie que `tests/e2e/captures-9i7-bon-en-tuiles.spec.ts`. */
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
const MENTIONS_LEGALES_DE_TEST = "9I7C — SARL au capital de 1 000 000 XPF";

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
      },
      select: { id: true, client_id: true },
    });

    // CLÔTURÉE, le 20/09/2026 à 23h30 UTC (donc le 21/09 à Nouméa, UTC+11) —
    // une date de clôture DIFFÉRENTE de la date planifiée, pour prouver que
    // l'en-tête lit la première, pas la seconde, et dans le bon fuseau
    // (jamais `dateCivile`, réservée aux colonnes `@db.Date`, voir L0-08).
    await client.intervention.create({
      data: {
        id: INTERVENTION_CLOTUREE,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "cloturee",
        statut_facturation: "non_facturable",
        date_planifiee: new Date("2026-09-15T00:00:00.000Z"),
        cloturee_le: new Date("2026-09-20T23:30:00.000Z"),
      },
    });

    // TERMINÉE, sans clôture ni technicien — l'en-tête retombe sur la date
    // planifiée, et la tuile Intervention n'affiche aucune ligne
    // « Technicien » (point 2 : une absence ne s'invente jamais en « — »).
    await client.intervention.create({
      data: {
        id: INTERVENTION_TERMINEE,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-18T00:00:00.000Z"),
      },
    });

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
      where: { id: { in: [INTERVENTION_CLOTUREE, INTERVENTION_TERMINEE] } },
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

test("bon clôturé — date de clôture, technicien sans segment, logo et mentions légales à l'impression", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_CLOTUREE}/bon`);
  await page.emulateMedia({ media: "print" });

  // LE TEXTE RÉELLEMENT IMPRIMÉ (`.innerText()`, jamais `getByText` avec un
  // littéral — L0-11 : une date ou un nom de fixture n'est pas une chaîne du
  // dictionnaire, mais le gardien ne distingue pas l'appel de son argument ;
  // lire le texte rendu puis comparer en JS, même recette que la réserve
  // « toHaveText(« 0 ») » de [[captures-avant-apres-e2e]]).
  const texte = await page.locator("body").innerText();

  // (c) LA DATE DE L'EN-TÊTE EST LA CLÔTURE, PAS LA PLANIFIÉE — convertie
  // dans le fuseau de l'agence : 20/09 23h30 UTC devient le 21/09 à Nouméa.
  // Scopée à l'en-tête : la tuile Intervention continue, elle, d'afficher
  // « Date planifiée » (15/09) — un champ inchangé, hors du périmètre de ce
  // ticket.
  const texteEnTete = await page.locator('[data-bloc="bon-date"]').innerText();
  expect(texteEnTete).toContain("21/09/2026");
  expect(texteEnTete).not.toContain("15/09/2026");

  // (c) LE TECHNICIEN AFFECTÉ, MÊME SANS SEGMENT DE TRAVAIL.
  expect(texte).toContain("D. Garnier");

  // (a) LES MENTIONS LÉGALES, EN PIED DE DOCUMENT.
  expect(texte).toContain(MENTIONS_LEGALES_DE_TEST);

  // (b) LE LOGO, VISIBLE ET DE HAUTEUR ≤ 15 MM (± 1 CSS px d'arrondi).
  // Scopé à la zone imprimée : la colonne de navigation porte SON PROPRE
  // logo, caché à l'impression par son conteneur (`print:hidden`), mais
  // présent dans le DOM — `getByAltText` sur toute la page résoudrait deux
  // éléments.
  const logo = page
    .locator(".zone-impression-bon")
    .getByAltText(fr["societe.logo_alt"]);
  await expect(logo).toBeVisible();
  const boite = await logo.boundingBox();
  expect(boite).not.toBeNull();
  const QUINZE_MM_EN_PX = (15 / 25.4) * 96;
  expect(boite?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    QUINZE_MM_EN_PX + 1,
  );
});

test("bon terminé — sans clôture ni technicien, sans logo ni mentions légales à l'impression", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
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

  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_TERMINEE}/bon`);
  await page.emulateMedia({ media: "print" });

  const texte = await page.locator("body").innerText();

  // (c) LA DATE PLANIFIÉE, FAUTE DE CLÔTURE.
  expect(texte).toContain("18/09/2026");

  // (c)/point 2 — AUCUN TECHNICIEN AFFECTÉ : le mot « Technicien » ne
  // s'affiche nulle part (ni la tuile, ni le tableau des segments, absent
  // ici) — une absence ne s'invente jamais en « — ».
  expect(texte).not.toContain(fr["intervention.technicien"]);

  // (a)/(b) — AUCUN LOGO, AUCUNE MENTION LÉGALE.
  await expect(
    page.locator(".zone-impression-bon").getByAltText(fr["societe.logo_alt"]),
  ).toHaveCount(0);
  expect(texte).not.toContain(MENTIONS_LEGALES_DE_TEST);
});
