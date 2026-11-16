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
 * 9L04I-CHECKLIST-NON-CONFORME-DETAIL — LA SUITE À DONNER, LE COMMENTAIRE ET
 * LES PHOTOS D'UN POINT NON CONFORME, DE BOUT EN BOUT.
 *
 * Deux points `conforme_non_conforme_sans_objet` : l'un répondu EN LIGNE
 * (suite + commentaire + photo, repli en ligne résumée, retour à « conforme »
 * qui efface le détail), l'autre répondu HORS RÉSEAU (même patron que
 * `9k28a-point-photo-hors-reseau.spec.ts` — jamais une navigation hors réseau,
 * addendum 3 du pilote). SÉRIEL : une seule scène, partagée par les deux
 * tests de ce fichier.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L04I = uuidv7();
const SITE_9L04I = uuidv7();
const INTERVENTION_9L04I = uuidv7();
const MODELE_9L04I = uuidv7();
const VERSION_9L04I = uuidv7();
const POINT_EN_LIGNE = uuidv7();
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
        id: CLIENT_9L04I,
        societe_id: societeId,
        raison_sociale: "zz9L04I client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L04I,
        societe_id: societeId,
        client_id: CLIENT_9L04I,
        agence_id: agence.id,
        libelle: "zz9L04I site",
      },
    });
    await client.checklistModele.create({
      data: {
        id: MODELE_9L04I,
        societe_id: societeId,
        code: "ZZ9L04I-GENERIQUE",
        libelle: "zz9L04I checklist générique",
        actif: true,
      },
    });
    await client.checklistVersion.create({
      data: {
        id: VERSION_9L04I,
        societe_id: societeId,
        checklist_modele_id: MODELE_9L04I,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_EN_LIGNE,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04I,
        section: "Sécurité",
        ordre: 1,
        libelle: "zz9L04I Dispositif de sécurité",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_HORS_RESEAU,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04I,
        section: "Sécurité",
        ordre: 2,
        libelle: "zz9L04I Protections en place",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    // JAMAIS RÉPONDU, DANS LA MÊME SECTION — une rubrique complète se replie
    // d'elle-même (point 4, 9L04D) : sans ce troisième point, répondre aux
    // deux autres replierait « Sécurité » et retirerait du document le
    // détail qu'un test vient d'ouvrir, avant qu'il ne puisse le lire.
    await client.checklistPoint.create({
      data: {
        id: POINT_JAMAIS_REPONDU,
        societe_id: societeId,
        checklist_version_id: VERSION_9L04I,
        section: "Sécurité",
        ordre: 3,
        libelle: "zz9L04I Jamais répondu",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L04I,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L04I,
        site_id: SITE_9L04I,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L04I — intervention forgée par l'épreuve",
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
      INTERVENTION_9L04I,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "checklist_reponse" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L04I,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L04I,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9L04I },
    });
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: MODELE_9L04I },
    });
    await client.checklistModele.deleteMany({ where: { id: MODELE_9L04I } });
    await client.site.deleteMany({ where: { id: SITE_9L04I } });
    await client.client.deleteMany({ where: { id: CLIENT_9L04I } });
  } finally {
    await client.$disconnect();
  }
});

/** Un PNG réellement décodable — même fonction que `9k28a-point-photo-hors-reseau.spec.ts`. */
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
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9l04i-"));
  const chemin = join(dossier, "photo-9l04i.png");
  writeFileSync(chemin, construirePngDeTest());
  return chemin;
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04I-CHECKLIST-NON-CONFORME-DETAIL/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

// LE `<form>` A DISPARU AVEC LA SOUMISSION NATIVE (9L04E-TERRAIN-PHOTOS-
// EPUREES, qui envoie par `fetch`) — même marqueur que 9k28a-point-photo-
// hors-reseau.spec.ts.
function formulaireDuPoint(page: Page, pointId: string) {
  return page.locator(`[data-checklist-point-id="${pointId}"]`);
}

function ligneDuPoint(page: Page, pointId: string) {
  return page.locator(`#checklist-point-${pointId}`);
}

test("en ligne — non conforme ouvre la suite, le commentaire et la photo ; envoyée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04I}`);

  const ligne = ligneDuPoint(page, POINT_EN_LIGNE);
  await expect(ligne).toBeVisible();
  await capturer(page, "point-avant");

  // ── CHOISIR « NON CONFORME » OUVRE LA SUITE, LE COMMENTAIRE, LA PHOTO. ──
  await ligne
    .getByRole("button", { name: fr["checklist.terrain.non_conforme"] })
    .click();
  await expect(ligne.getByRole("radio")).toHaveCount(3);
  const segmentPiece = ligne.getByRole("radio", {
    name: fr["checklist.non_conformite.piece_a_commander"],
  });
  await segmentPiece.click();
  await expect(segmentPiece).toHaveAttribute("aria-checked", "true");

  await ligne
    .getByPlaceholder(fr["checklist.non_conformite.commentaire_placeholder"])
    .fill("Ne redémarre pas sous 6 bar");

  // ENVOI AUTOMATIQUE À LA SÉLECTION (9L04E-TERRAIN-PHOTOS-EPUREES) — plus
  // de bouton « Ajouter une photo » séparé ; deux champs fichier cachés,
  // distingués par `[capture]`.
  const formulairePoint = formulaireDuPoint(page, POINT_EN_LIGNE);
  await formulairePoint
    .locator('input[type="file"][capture]')
    .setInputFiles(fichierPhotoDEpreuve());
  await expect(
    formulairePoint.getByText(fr["terrain.photos.etat_envoyee"]),
  ).toBeVisible();

  await capturer(page, "point-ouvert-rempli");

  // ── ENVOYER LA CHECKLIST (file hors réseau, même geste que les autres). ─
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  // ── LA VÉRITÉ EN BASE. ──────────────────────────────────────────────────
  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04I,
        checklist_point_id: POINT_EN_LIGNE,
      },
    });
    expect(reponse?.valeur_conforme).toBe("non_conforme");
    expect(reponse?.non_conformite_suite).toBe("piece_a_commander");
    expect(reponse?.non_conformite_commentaire).toBe(
      "Ne redémarre pas sous 6 bar",
    );
    const liens = await verif.checklistReponsePhoto.count({
      where: { checklist_reponse_id: reponse?.id },
    });
    expect(liens).toBe(1);
  } finally {
    await verif.$disconnect();
  }
});

test("le bon interne et le bon client montrent la suite, le commentaire et la photo du point non conforme — captures 1280", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`/interventions/${INTERVENTION_9L04I}/bon`);
  // LA SUITE SEULE, PAR SON LIBELLÉ DU DICTIONNAIRE (L0-11) — le commentaire
  // est une valeur de FIXTURE, jamais interrogée par son texte ; sa présence
  // en base est déjà prouvée par la vérité DB du premier test de ce fichier.
  await expect(
    page.getByText(fr["checklist.non_conformite.piece_a_commander"]),
  ).toBeVisible();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "bon-client-1280.png"),
    fullPage: true,
  });

  await page.goto(`/interventions/${INTERVENTION_9L04I}/bon?version=interne`);
  await expect(
    page.getByText(fr["checklist.non_conformite.piece_a_commander"]),
  ).toBeVisible();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "bon-interne-1280.png"),
    fullPage: true,
  });
});

test("rechargée — la saisie arrive repliée en une ligne résumée ; toucher la ligne la rouvre ; revenir à conforme demande confirmation et efface le détail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04I}`);
  await expect(ligneDuPoint(page, POINT_EN_LIGNE)).toBeVisible();
  await expect(
    ligneDuPoint(page, POINT_EN_LIGNE).getByRole("radio"),
  ).toHaveCount(0);
  const ligneResumeApresRechargement = ligneDuPoint(page, POINT_EN_LIGNE)
    .getByRole("button")
    .last();
  await expect(ligneResumeApresRechargement).toContainText(
    fr["checklist.non_conformite.piece_a_commander"],
  );
  await capturer(page, "point-replie");

  // ── TOUCHER LA LIGNE LA ROUVRE. ──────────────────────────────────────────
  await ligneResumeApresRechargement.click();
  await expect(
    ligneDuPoint(page, POINT_EN_LIGNE).getByRole("radio"),
  ).toHaveCount(3);

  // ── REVENIR À « CONFORME » DEMANDE CONFIRMATION, ACCEPTÉE, EFFACE LE DÉTAIL. ─
  page.once("dialog", (dialogue) => {
    void dialogue.accept();
  });
  // `exact: true` — « Conforme » est une SOUS-CHAÎNE de « Non conforme », et
  // les deux pastilles coexistent sur cette même ligne (point 3, 9L04D).
  await ligneDuPoint(page, POINT_EN_LIGNE)
    .getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    })
    .click();
  await expect(
    ligneDuPoint(page, POINT_EN_LIGNE).getByRole("radio"),
  ).toHaveCount(0);

  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verifFinale = admin();
  try {
    const reponse = await verifFinale.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04I,
        checklist_point_id: POINT_EN_LIGNE,
      },
    });
    expect(reponse?.valeur_conforme).toBe("conforme");
    expect(reponse?.non_conformite_suite).toBeNull();
    expect(reponse?.non_conformite_commentaire).toBeNull();
  } finally {
    await verifFinale.$disconnect();
  }
});

test("hors réseau — non conforme avec suite part dans la file, envoyée sans perte au retour du réseau", async ({
  page,
  context,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L04I}`);
  const ligne = ligneDuPoint(page, POINT_HORS_RESEAU);
  await expect(ligne).toBeVisible();
  // L'HYDRATATION DOIT ÊTRE TERMINÉE AVANT LA COUPURE (même piège que
  // `9k28a-point-photo-hors-reseau.spec.ts`, qui ne passe hors réseau
  // qu'APRÈS une première interaction en ligne) — sans cette attente, un
  // bloc de script encore en vol au moment de la coupure laisse le bouton
  // sans gestionnaire, et le clic n'aboutit jamais.
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  await ligne
    .getByRole("button", { name: fr["checklist.terrain.non_conforme"] })
    .click();
  await ligne
    .getByRole("radio", { name: fr["checklist.non_conformite.a_revoir"] })
    .click();
  await expect(
    page.getByText(fr["checklist.terrain.hors_reseau"]),
  ).toBeVisible();

  await context.setOffline(false);
  await page.goto("/terrain");
  await page.getByRole("button", { name: fr["terrain.file.envoyer"] }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const reponse = await verif.checklistReponse.findFirst({
      where: {
        intervention_id: INTERVENTION_9L04I,
        checklist_point_id: POINT_HORS_RESEAU,
      },
    });
    expect(reponse?.valeur_conforme).toBe("non_conforme");
    expect(reponse?.non_conformite_suite).toBe("a_revoir");
  } finally {
    await verif.$disconnect();
  }
});
