import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirLaSessionSensible } from "./setup/session";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { cliquerTerminer } from "./setup/terrain-gestes";

/**
 * 9L08AA-REPRISE-EN-TETES-SECURITE — la politique de contenu (CSP) ne doit
 * casser ni la signature, ni la photo terrain, ni leur relecture sur le bon
 * et sur la fiche bureau.
 *
 * Mesuré : la signature du bon est stockée et relue en
 * `data:image/png;base64,...` (`lib/interventions/depot-rapport-terrain.ts`),
 * affichée telle quelle sur trois écrans. Cette épreuve écoute
 * `securitypolicyviolation` DANS la page plutôt que de relire les en-têtes :
 * seul le navigateur décide d'appliquer la politique, et c'est donc lui qu'il
 * faut interroger pour savoir si un écran la viole réellement.
 *
 * SÉRIEL — la signature posée par le premier test est ce que le bon et la
 * fiche bureau relisent dans les deux suivants.
 *
 * ## Une violation `script-src` mesurée, SANS RAPPORT avec ce lot
 *
 * En écoutant `securitypolicyviolation`, cette épreuve a aussi révélé une
 * violation `script-src (eval)` — présente sur TOUTE page qui valide un
 * schéma Zod côté navigateur (reproduite aussi sur `/planning`, sans aucun
 * rapport avec la signature ou la photo), identifiée dans le paquet construit
 * (`$ZodObjectJIT`, `r.cr.jitless`) : Zod tente de compiler un analyseur
 * rapide par `Function(...)`, CSP la refuse, et Zod BASCULE DE LUI-MÊME sur
 * son propre analyseur interprété — le même mécanisme qui lui permet de
 * tourner sur Cloudflare Workers. Rien ne casse (toutes les épreuves de
 * régression de ce lot restent vertes) ; ajouter `'unsafe-eval'` pour la
 * faire taire serait l'assouplissement que ce ticket interdit explicitement.
 * Cette épreuve filtre donc sur `img-src`, la seule famille que ce lot
 * change — le reste est un constat pour la passation, pas une correction.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L08AA = uuidv7();
const SITE_9L08AA = uuidv7();
const INTERVENTION_9L08AA = uuidv7();

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9L08AA,
        societe_id: reperes.societeId,
        raison_sociale: "9L08AA client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L08AA,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L08AA,
        agence_id: agence.id,
        libelle: "9L08AA site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L08AA,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L08AA,
        site_id: SITE_9L08AA,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        // `affectee` — le terrain ne montre « Démarrer » que depuis cet
        // état (même patron que `9de-terminer-signature.spec.ts`).
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
        commentaire_technicien: "zz9L08AA Vérification effectuée.",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // `segment_travail` est RESTRICT sur l'intervention (I10) — supprimé
    // explicitement avant la ligne, jamais par CASCADE.
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L08AA,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L08AA,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L08AA,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_9L08AA,
    );
    await client.site.deleteMany({ where: { id: SITE_9L08AA } });
    await client.client.deleteMany({ where: { id: CLIENT_9L08AA } });
  } finally {
    await client.$disconnect();
  }
});

/** Recule le DÉBUT du segment ouvert, pour que l'écart mesure plus que zéro minute. */
async function reculerLeSegmentOuvert(): Promise<void> {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `UPDATE "segment_travail" SET "debut" = "debut" - interval '70 minutes'
        WHERE "intervention_id" = $1::uuid AND "fin" IS NULL`,
      INTERVENTION_9L08AA,
    );
  } finally {
    await client.$disconnect();
  }
}

/** Un PNG réellement décodable — même patron que `9l04e-terrain-photos-epurees.spec.ts`. */
function construirePngDeTest(): Buffer {
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

function fichierPhotoDEpreuve(): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9l08aa-"));
  const chemin = join(dossier, "photo-9l08aa.png");
  writeFileSync(chemin, construirePngDeTest());
  return chemin;
}

function champCamera(page: Page) {
  return page.locator('input[type="file"][capture]');
}

/**
 * Écoute `securitypolicyviolation` DANS la page — la seule source de vérité
 * sur ce que le navigateur a réellement bloqué. À appeler AVANT toute
 * navigation : `addInitScript` s'applique à chaque document ouvert ensuite
 * sur cette page, y compris après `ouvrirLaSessionSensible`.
 */
async function ecouterLesViolationsCSP(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction(
    "__consignerViolationCSP9L08AA",
    (directive: string, uri: string) => {
      violations.push(`${directive} (${uri})`);
    },
  );
  await page.addInitScript(() => {
    document.addEventListener(
      "securitypolicyviolation",
      (evenement: SecurityPolicyViolationEvent) => {
        (
          window as unknown as {
            __consignerViolationCSP9L08AA: (d: string, u: string) => void;
          }
        ).__consignerViolationCSP9L08AA(
          evenement.violatedDirective,
          evenement.blockedURI,
        );
      },
    );
  });
  return violations;
}

/** Seule `img-src` est changée par ce lot — voir la note de fichier. */
function violationsImgSrc(violations: readonly string[]): string[] {
  return violations.filter((v) => v.startsWith("img-src"));
}

test("terrain : signer et photographier ne lève aucune violation CSP", async ({
  page,
}) => {
  const violations = await ecouterLesViolationsCSP(page);
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L08AA}`);
  await page.waitForResponse(
    (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
  );

  await champCamera(page).setInputFiles(fichierPhotoDEpreuve());
  await expect(page.getByText(fr["terrain.photos.etat_envoyee"])).toBeVisible();

  // Un temps mesuré positif, exigé par `peutTerminer` — même patron que
  // `tests/e2e/9de-terminer-signature.spec.ts`.
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.tourne_depuis"]),
  ).toBeVisible();
  await reculerLeSegmentOuvert();
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.tourne_depuis"]),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill("9L08AA client");
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
    envoyer("pointerup", 100, 80);
  });
  await expect(
    page.getByText(fr["terrain.signature.enregistre"]),
  ).toBeVisible();

  // Le bon n'existe qu'une fois l'intervention Terminée.
  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();

  expect(violationsImgSrc(violations)).toEqual([]);
});

test("bon : la signature relue en `data:` ne lève aucune violation CSP", async ({
  page,
}) => {
  const violations = await ecouterLesViolationsCSP(page);
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_9L08AA}/bon`);
  await expect(
    page.locator('img[src^="data:image/png;base64,"]'),
  ).toBeVisible();

  expect(violationsImgSrc(violations)).toEqual([]);
});

test("fiche bureau : la signature relue en `data:` ne lève aucune violation CSP", async ({
  page,
}) => {
  const violations = await ecouterLesViolationsCSP(page);
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_9L08AA}?onglet=rapport`);
  // Cet onglet ne montre que le CONSTAT de signature (pas l'image, réservée
  // au bon, déjà éprouvé ci-dessus) — la preuve que l'onglet a bien chargé.
  await expect(
    page.getByText(fr["intervention.realisation.signee_le"]),
  ).toBeVisible();

  expect(violationsImgSrc(violations)).toEqual([]);
});
