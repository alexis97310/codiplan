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
 * 9L04M-CHECKLIST-RETRAIT-REPONSE — LE VRAI RETRAIT, DE BOUT EN BOUT (D257).
 *
 * Trois points, même section (une rubrique complète se replie d'elle-même,
 * point 4 de 9L04D : un quatrième point JAMAIS RÉPONDU garde la rubrique
 * ouverte pendant les trois scènes, même patron que
 * `9l04i-checklist-non-conforme-detail.spec.ts`). SÉRIEL : une seule scène
 * partagée.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L04M = uuidv7();
const SITE_9L04M = uuidv7();
const INTERVENTION_9L04M = uuidv7();
const MODELE_9L04M = uuidv7();
const VERSION_9L04M = uuidv7();
const POINT_RETRAIT_REEL = uuidv7();
const POINT_AVEC_PHOTO = uuidv7();
const POINT_HORS_RESEAU = uuidv7();
const POINT_JAMAIS_REPONDU = uuidv7();

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
        id: CLIENT_9L04M,
        societe_id: societeId,
        raison_sociale: "zz9L04M client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L04M,
        societe_id: societeId,
        client_id: CLIENT_9L04M,
        agence_id: agence.id,
        libelle: "zz9L04M site",
      },
    });
    await client.checklistModele.create({
      data: {
        id: MODELE_9L04M,
        societe_id: societeId,
        code: "ZZ9L04M-GENERIQUE",
        libelle: "zz9L04M checklist générique",
        actif: true,
      },
    });
    await client.checklistVersion.create({
      data: {
        id: VERSION_9L04M,
        societe_id: societeId,
        checklist_modele_id: MODELE_9L04M,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_RETRAIT_REEL,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04M,
        section: "Sécurité",
        ordre: 1,
        libelle: "zz9L04M Dispositif de sécurité",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_AVEC_PHOTO,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04M,
        section: "Sécurité",
        ordre: 2,
        libelle: "zz9L04M Avec photo",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_HORS_RESEAU,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04M,
        section: "Sécurité",
        ordre: 3,
        libelle: "zz9L04M Sans réseau",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_JAMAIS_REPONDU,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04M,
        section: "Sécurité",
        ordre: 4,
        libelle: "zz9L04M Jamais répondu",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L04M,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L04M,
        site_id: SITE_9L04M,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L04M — intervention forgée par l'épreuve",
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
      INTERVENTION_9L04M,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "checklist_reponse" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L04M,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L04M,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9L04M },
    });
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: MODELE_9L04M },
    });
    await client.checklistModele.deleteMany({ where: { id: MODELE_9L04M } });
    await client.site.deleteMany({ where: { id: SITE_9L04M } });
    await client.client.deleteMany({ where: { id: CLIENT_9L04M } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04M-CHECKLIST-RETRAIT-REPONSE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

function ligneDuPoint(page: Page, pointId: string) {
  return page.locator(`#checklist-point-${pointId}`);
}

/** Un PNG réellement décodable — même fonction que `9l04i-checklist-non-conforme-detail.spec.ts`. */
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
      brut[debut + 1 + x * 3] = 0x2a;
      brut[debut + 1 + x * 3 + 1] = 0x6a;
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
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9l04m-"));
  const chemin = join(dossier, "photo-9l04m.png");
  writeFileSync(chemin, construirePngDeTest());
  return chemin;
}

/** Le `<form>` `PhotosTerrain` embarqué AU POINT, par son champ caché — même patron que 9k28a/9L04I. */
// LE `<form>` A DISPARU AVEC LA SOUMISSION NATIVE (9L04E-TERRAIN-PHOTOS-
// EPUREES, qui envoie par `fetch`) — même marqueur que 9k28a-point-photo-
// hors-reseau.spec.ts.
function formulaireDuPoint(page: Page, pointId: string) {
  return page.locator(`[data-checklist-point-id="${pointId}"]`);
}

async function envoyerLaFile(page: Page): Promise<void> {
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();
}

test("en ligne — répondre, recharger, retirer, recharger : la réponse ne revient PAS", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04M}`);

  const ligne = ligneDuPoint(page, POINT_RETRAIT_REEL);
  await expect(ligne).toBeVisible();
  await capturer(page, "retrait-avant-reponse");

  // ── RÉPONDRE « CONFORME », ENVOYER. — `exact: true` : « Conforme » est une
  // SOUS-CHAÎNE de « Non conforme », et les deux pastilles coexistent sur la
  // même ligne (même piège que 9L04I).
  await ligne
    .getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    })
    .click();
  await envoyerLaFile(page);

  // ── RECHARGÉE : LA RÉPONSE EST BIEN LÀ. ─────────────────────────────────
  await page.goto(`/terrain/${INTERVENTION_9L04M}`);
  const pastilleApresEnvoi = ligneDuPoint(page, POINT_RETRAIT_REEL).getByRole(
    "button",
    { name: fr["checklist.terrain.option_conforme"], exact: true },
  );
  await expect(pastilleApresEnvoi).toHaveAttribute("aria-pressed", "true");

  // ── SECOND APPUI — LE RETRAIT, ENVOYÉ. ──────────────────────────────────
  await pastilleApresEnvoi.click();
  await expect(pastilleApresEnvoi).toHaveAttribute("aria-pressed", "false");
  await envoyerLaFile(page);

  // ── RECHARGÉE UNE SECONDE FOIS : LA RÉPONSE NE REVIENT PAS. ─────────────
  await page.goto(`/terrain/${INTERVENTION_9L04M}`);
  await expect(
    ligneDuPoint(page, POINT_RETRAIT_REEL).getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await capturer(page, "retrait-apres-retrait-et-rechargement");

  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04M,
        checklist_point_id: POINT_RETRAIT_REEL,
      },
    });
    expect(reponse).toBeNull();
  } finally {
    await verif.$disconnect();
  }
});

test("refuse NOMMÉMENT le retrait d'une réponse qui porte une photo ; elle reste intacte", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04M}`);

  const ligne = ligneDuPoint(page, POINT_AVEC_PHOTO);
  await expect(ligne).toBeVisible();

  // ── NON CONFORME, UNE PHOTO, ENVOYÉE. ───────────────────────────────────
  await ligne
    .getByRole("button", { name: fr["checklist.terrain.non_conforme"] })
    .click();
  // ENVOI AUTOMATIQUE À LA SÉLECTION (9L04E-TERRAIN-PHOTOS-EPUREES) — plus
  // de bouton « Ajouter une photo » séparé ; deux champs fichier cachés,
  // distingués par `[capture]`.
  const formulairePoint = formulaireDuPoint(page, POINT_AVEC_PHOTO);
  await formulairePoint
    .locator('input[type="file"][capture]')
    .setInputFiles(fichierPhotoDEpreuve());
  await expect(
    formulairePoint.getByText(fr["terrain.photos.etat_envoyee"]),
  ).toBeVisible();
  await envoyerLaFile(page);

  await page.goto(`/terrain/${INTERVENTION_9L04M}`);
  const ligneApresEnvoi = ligneDuPoint(page, POINT_AVEC_PHOTO);
  await capturer(page, "photo-avant-retrait");

  // ── SECOND APPUI SUR « NON CONFORME » — LE RETRAIT TENTÉ. ───────────────
  // AUCUN « RÉSUMÉ » À ROUVRIR : la section reste dépliée après rechargement
  // (`detailNonConformeVide` ne regarde que la suite et le commentaire,
  // jamais la photo — `ouvert` initial reste vrai ici). L'ancien
  // `getByRole("button").last()` visait jadis le bouton « Ajouter une
  // photo » disparu (9L04E-TERRAIN-PHOTOS-EPUREES) ; il résout désormais le
  // champ fichier caché de la bibliothèque (rôle `button` via HTML-AAM),
  // hors d'atteinte d'un clic réel — retiré, la pastille « Non conforme »
  // est toujours atteignable directement.
  await ligneApresEnvoi
    .getByRole("button", { name: fr["checklist.terrain.non_conforme"] })
    .click();

  // ── ENVOYER : LE SERVEUR REFUSE, NOMMÉMENT, À L'ÉCRAN. ──────────────────
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(
    page.getByText(fr["checklist.refus.reponse_porte_photos"]),
  ).toBeVisible();
  await capturer(page, "photo-refus-retrait");

  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04M,
        checklist_point_id: POINT_AVEC_PHOTO,
      },
    });
    expect(reponse?.valeur_conforme).toBe("non_conforme");
  } finally {
    await verif.$disconnect();
  }
});

test("hors réseau — le retrait entre dans la file ; envoyé sans perte au retour du réseau", async ({
  page,
  context,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04M}`);

  const ligne = ligneDuPoint(page, POINT_HORS_RESEAU);
  await expect(ligne).toBeVisible();

  // ── RÉPONDRE EN LIGNE D'ABORD, ENVOYER. ─────────────────────────────────
  await ligne
    .getByRole("button", { name: fr["checklist.terrain.option_sans_objet"] })
    .click();
  await envoyerLaFile(page);

  await page.goto(`/terrain/${INTERVENTION_9L04M}`);
  const ligneRechargee = ligneDuPoint(page, POINT_HORS_RESEAU);
  const pastilleSansObjet = ligneRechargee.getByRole("button", {
    name: fr["checklist.terrain.option_sans_objet"],
  });
  await expect(pastilleSansObjet).toHaveAttribute("aria-pressed", "true");
  // L'HYDRATATION DOIT ÊTRE TERMINÉE AVANT LA COUPURE (même piège que
  // `9k28a-point-photo-hors-reseau.spec.ts`).
  await page.waitForLoadState("networkidle");

  // ── COUPURE, PUIS LE SECOND APPUI — LE RETRAIT HORS RÉSEAU. ─────────────
  await context.setOffline(true);
  await pastilleSansObjet.click();
  await expect(pastilleSansObjet).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByText(fr["checklist.terrain.hors_reseau"]),
  ).toBeVisible();
  await capturer(page, "hors-reseau-retrait-en-file");

  // ── RETOUR DU RÉSEAU, ENVOI. ─────────────────────────────────────────────
  await context.setOffline(false);
  await envoyerLaFile(page);

  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04M,
        checklist_point_id: POINT_HORS_RESEAU,
      },
    });
    expect(reponse).toBeNull();
  } finally {
    await verif.$disconnect();
  }
});
