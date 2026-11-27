import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURES AVANT/APRÈS DE 9L55-ACCESSIBILITE-TERRAIN — le seul écran dont le
 * balisage change est la checklist (`components/terrain/checklist-terrain.tsx`,
 * section `Avancement`) : un `aria-label` ajouté à la barre de progression
 * (`role="progressbar"`), invisible à l'écran. AVANT et APRÈS sont donc
 * capturés à l'identique pixel pour pixel — la passation le dit, ce fichier
 * ne fait que fournir la paire demandée.
 */
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L55-ACCESSIBILITE-TERRAIN/captures",
);

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
  readonly modeleId: string;
};

async function creerScene(client: PrismaClient): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: "zz9L55 client capture",
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: "zz9L55 site capture",
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      date_planifiee: new Date("2026-11-20T08:00:00Z"),
      creneau_debut: new Date("2026-11-20T08:00:00Z"),
      creneau_fin: new Date("2026-11-20T10:00:00Z"),
      duree_estimee_min: 120,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: "zz9L55-capture-checklist",
    },
  });

  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(Date.now() - 2 * 60 * 60_000),
      fin: new Date(),
    },
  });

  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: "ZZ9L55-CAPTURE",
      libelle: "zz9L55 modèle capture",
      actif: false,
    },
  });
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: reperes.societeId,
      checklist_modele_id: modeleId,
      numero: 1,
    },
  });
  await client.checklistPoint.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      checklist_version_id: versionId,
      section: "zz9L55 section",
      ordre: 1,
      libelle: "zz9L55 point de contrôle",
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  await client.intervention.update({
    where: { id: interventionId },
    data: { checklist_version_id: versionId },
  });

  return { clientId, siteId, interventionId, modeleId };
}

async function nettoyerScene(client: PrismaClient, scene: Scene): Promise<void> {
  await client.checklistReponse.deleteMany({
    where: { intervention_id: scene.interventionId },
  });
  await client.$executeRawUnsafe(
    `UPDATE "intervention" SET "checklist_version_id" = NULL WHERE "id" = $1::uuid`,
    scene.interventionId,
  );
  await client.checklistVersion.deleteMany({
    where: { checklist_modele_id: scene.modeleId },
  });
  await client.checklistModele.deleteMany({ where: { id: scene.modeleId } });
  await client.$executeRawUnsafe(
    `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.intervention.deleteMany({ where: { id: scene.interventionId } });
  await client.site.deleteMany({ where: { id: scene.siteId } });
  await client.client.deleteMany({ where: { id: scene.clientId } });
}

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

test("375 px — la checklist, section de la fiche (aria-label de la barre de progression)", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client);
    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);
    await expect(
      page.getByRole("heading", { name: fr["terrain.signature.titre"] }),
    ).toBeVisible();
    await capturer(page, "fiche-checklist-apres");
  } finally {
    if (scene !== null) {
      await nettoyerScene(client, scene);
    }
    await client.$disconnect();
  }
});
