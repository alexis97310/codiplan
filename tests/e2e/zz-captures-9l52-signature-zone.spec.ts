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
 * 9L52-TERRAIN-SIGNATURE-ZONE-NOM — CAPTURES AVANT/APRÈS de la zone de
 * signature agrandie (190 px → 220 px). Rejouer deux fois (voir la
 * passation) : une fois avant le changement de hauteur du canevas, une fois
 * après — jamais dans le même run, la hauteur étant portée par le code.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L52-TERRAIN-SIGNATURE-ZONE-NOM/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly contactId: string;
  readonly interventionId: string;
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
      raison_sociale: "zz9L52A client zone de signature",
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
      libelle: "zz9L52A site zone de signature",
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const contactId = uuidv7();
  await client.contact.create({
    data: {
      id: contactId,
      societe_id: reperes.societeId,
      client_id: clientId,
      site_id: null,
      nom: "zz9L52A Contact sur place",
      email: "zz9l52a-contact@epreuve.test",
      roles: ["signataire"],
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
      contact_id: contactId,
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
      description: "zz9L52A-zone-de-signature",
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

  return { clientId, siteId, contactId, interventionId };
}

async function nettoyerScene(
  client: PrismaClient,
  scene: Scene | null,
): Promise<void> {
  if (scene !== null) {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.contact.deleteMany({ where: { id: scene.contactId } });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px — la zone de signature, avant/après l'agrandissement du canevas", async ({
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

    await page
      .getByRole("button", { name: fr["terrain.signature.option_signee"] })
      .click();
    await expect(
      page.getByLabel(fr["terrain.signature.nom_libelle"]),
    ).toHaveValue("zz9L52A Contact sur place");

    await capturer(page, "zone-signature-apres");
  } finally {
    await nettoyerScene(client, scene);
  }
});
