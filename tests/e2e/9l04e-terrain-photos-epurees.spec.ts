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
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L04E-TERRAIN-PHOTOS-EPUREES — « Prendre une photo » bien visible, envoi
 * automatique, vignettes trois par ligne, toucher une photo pour la légender
 * ou la supprimer (décisions d'Alexis du 13/11/2026).
 *
 * MÊME PATRON QUE `9k28a-point-photo-hors-reseau.spec.ts` — une scène
 * jetable propre à ce fichier, SÉRIEL : le parcours entier (en ligne, tap,
 * légende, suppression, hors réseau, intervention terminée) tient sur LA
 * MÊME fiche, dans l'ordre où un technicien le vivrait.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L04E = uuidv7();
const SITE_9L04E = uuidv7();
const INTERVENTION_9L04E = uuidv7();

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
        id: CLIENT_9L04E,
        societe_id: societeId,
        raison_sociale: "9L04E client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L04E,
        societe_id: societeId,
        client_id: CLIENT_9L04E,
        agence_id: agence.id,
        libelle: "9L04E site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L04E,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L04E,
        site_id: SITE_9L04E,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L04E — intervention forgée par l'épreuve",
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
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L04E,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9L04E },
    });
    await client.site.deleteMany({ where: { id: SITE_9L04E } });
    await client.client.deleteMany({ where: { id: CLIENT_9L04E } });
  } finally {
    await client.$disconnect();
  }
});

/** Un PNG réellement décodable — même patron que `9k28a-point-photo-hors-reseau.spec.ts`. */
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
  ihdr[8] = 8;
  ihdr[9] = 2;
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

function fichierPhotoDEpreuve(
  suffixe: string,
  couleur: readonly [number, number, number],
): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9l04e-"));
  const chemin = join(dossier, `photo-9l04e-${suffixe}.png`);
  writeFileSync(chemin, construirePngDeTest(couleur));
  return chemin;
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04E-TERRAIN-PHOTOS-EPUREES/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page
    .getByRole("heading", { name: fr["terrain.photos.titre"] })
    .first()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

function champCamera(page: Page) {
  return page.locator('input[type="file"][capture]');
}

test("une photo se prend, se légende, se supprime — en ligne puis hors réseau, et l'intervention terminée verrouille", async ({
  page,
  context,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04E}`);
  await page.waitForResponse(
    (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
  );

  await expect(page.getByText(fr["terrain.photos.aucune"])).toBeVisible();
  await capturer(page, "9l04e-photos-vide", 375);

  // ── 1. EN LIGNE — deux photos, envoi automatique. ──────────────────────
  await champCamera(page).setInputFiles(
    fichierPhotoDEpreuve("une", [0x0b, 0x5c, 0xad]),
  );
  await expect(page.getByText(fr["terrain.photos.etat_envoyee"])).toBeVisible();
  await expect(page.getByText(fr["terrain.photos.aucune"])).toHaveCount(0);

  await champCamera(page).setInputFiles(
    fichierPhotoDEpreuve("deux", [0x2e, 0x8b, 0x3a]),
  );
  await expect(page.getByText(fr["terrain.photos.etat_envoyee"])).toHaveCount(
    2,
  );

  await capturer(page, "9l04e-photos-trois-etats-partiel", 375);

  // ── 2. TOUCHER LA PREMIÈRE PHOTO — légende par étiquette rapide. ───────
  await page
    .getByRole("button", { name: fr["terrain.photos.voir"] })
    .first()
    .click();
  const feuille = page.locator("dialog[open]");
  await expect(feuille.getByText(fr["terrain.photos.titre"])).toBeVisible();
  await capturer(page, "9l04e-feuille-ouverte", 375);

  await feuille
    .getByRole("button", { name: fr["terrain.photos.etiquette_avant"] })
    .click();
  await feuille
    .getByRole("button", { name: fr["terrain.photos.enregistrer_legende"] })
    .click();
  await expect(
    feuille.getByText(fr["terrain.photos.legende_enregistree"]),
  ).toBeVisible();
  await feuille.getByRole("button", { name: fr["ui.dialogue.fermer"] }).click();

  await expect(
    page.getByText(fr["terrain.photos.etiquette_avant"]).first(),
  ).toBeVisible();

  // ── 3. SUPPRESSION, DERRIÈRE CONFIRMATION. ─────────────────────────────
  await page
    .getByRole("button", { name: fr["terrain.photos.voir"] })
    .first()
    .click();
  const feuilleSuppr = page.locator("dialog[open]");
  await feuilleSuppr
    .getByRole("button", { name: fr["terrain.photos.supprimer"] })
    .click();
  await expect(
    feuilleSuppr.getByText(fr["terrain.photos.supprimer_confirmation"]),
  ).toBeVisible();
  await capturer(page, "9l04e-confirmation-suppression", 375);
  await feuilleSuppr
    .getByRole("button", { name: fr["terrain.photos.supprimer_confirmer"] })
    .click();

  await expect(page.getByText(fr["terrain.photos.etat_envoyee"])).toHaveCount(
    1,
  );

  // ── 4. HORS RÉSEAU, SUR LA PAGE DÉJÀ CHARGÉE — une troisième photo. ────
  await context.setOffline(true);
  await champCamera(page).setInputFiles(
    fichierPhotoDEpreuve("trois", [0xad, 0x5c, 0x0b]),
  );
  await expect(
    page.getByText(fr["terrain.photos.etat_en_attente"]),
  ).toBeVisible();
  await capturer(page, "9l04e-hors-reseau", 375);

  // Suppression HORS RÉSEAU de la photo restante — entre dans la file.
  await page
    .getByRole("button", { name: fr["terrain.photos.voir"] })
    .first()
    .click();
  const feuilleHorsReseau = page.locator("dialog[open]");
  await feuilleHorsReseau
    .getByRole("button", { name: fr["terrain.photos.supprimer"] })
    .click();
  await feuilleHorsReseau
    .getByRole("button", { name: fr["terrain.photos.supprimer_confirmer"] })
    .click();

  // ── LE RÉSEAU REVIENT : « ENVOYER ». ────────────────────────────────────
  await context.setOffline(false);
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  await page.goto(`/terrain/${INTERVENTION_9L04E}`);
  await page.waitForResponse(
    (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
  );
  // La photo « deux » (jamais supprimée) reste seule, bien envoyée ; la
  // suppression hors réseau de la photo « trois » a bien été appliquée au
  // retour du réseau.
  await expect(page.getByText(fr["terrain.photos.etat_envoyee"])).toHaveCount(
    1,
  );

  // ── 5. INTERVENTION TERMINÉE — VERROUILLE. ─────────────────────────────
  const client = admin();
  try {
    await client.intervention.update({
      where: { id: INTERVENTION_9L04E },
      data: { statut: "terminee" },
    });
  } finally {
    await client.$disconnect();
  }
  await page.reload();
  await page
    .getByRole("button", { name: fr["terrain.photos.voir"] })
    .first()
    .click();
  const feuilleFermee = page.locator("dialog[open]");
  await expect(
    feuilleFermee.getByText(fr["terrain.photos.refus_intervention_fermee"]),
  ).toBeVisible();
  await expect(
    feuilleFermee.getByRole("button", {
      name: fr["terrain.photos.supprimer"],
    }),
  ).toHaveCount(0);
  await capturer(page, "9l04e-intervention-terminee", 375);
});
