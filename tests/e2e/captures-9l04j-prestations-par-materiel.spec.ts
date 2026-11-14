import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9L04J-PRESTATIONS-PAR-MATERIEL — même recette que
 * `captures-9k29-prestations-par-type-intervention.spec.ts` : rien n'est
 * écrit sans la variable d'environnement qui nomme le dossier, pour que
 * `pnpm test:e2e` ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9L04JC-` — un client, un site, deux machines
 * (pont élévateur, compresseur — modèles du SEMIS, I9) et deux interventions
 * curatives, créés en `beforeAll`, supprimés en `afterAll`.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (avant la migration `prestation_famille_materiel`,
 * où le filtre par matériel n'existe pas : la prestation du pont apparaît
 * alors AUSSI sur le compresseur), une fois sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L04J ?? "";

const CLIENT_9L04JC = uuidv7();
const SITE_9L04JC = uuidv7();
const MACHINE_PONT_9L04JC = uuidv7();
const MACHINE_COMPRESSEUR_9L04JC = uuidv7();
const INTERVENTION_PONT_9L04JC = uuidv7();
const INTERVENTION_COMPRESSEUR_9L04JC = uuidv7();
const PRESTATION_9L04JC = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modelePont = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId, famille: { code: "PONT-ELEV" } },
      select: { id: true, famille_id: true },
    });
    const modeleCompresseur = await client.modeleMateriel.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        famille: { code: "COMPRESSEUR" },
      },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L04JC,
        societe_id: reperes.societeId,
        raison_sociale: "Client 9L04JC",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L04JC,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04JC,
        agence_id: agence.id,
        libelle: "Site 9L04JC",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_PONT_9L04JC,
        societe_id: reperes.societeId,
        modele_id: modelePont.id,
        client_id: CLIENT_9L04JC,
        site_id: SITE_9L04JC,
        numero_serie: "9L04JC-SN-PONT",
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_COMPRESSEUR_9L04JC,
        societe_id: reperes.societeId,
        modele_id: modeleCompresseur.id,
        client_id: CLIENT_9L04JC,
        site_id: SITE_9L04JC,
        numero_serie: "9L04JC-SN-COMPRESSEUR",
        qr_token: engendrerJetonQr(),
      },
    });

    // SUR LE CODE D'AVANT CE LOT, LA TABLE `prestation_famille_materiel`
    // N'EXISTE PAS : la capture « avant » pose alors cette prestation SANS
    // famille (le `create` ci-dessous échouerait sur le code d'avant faute
    // de relation — elle se rejoue alors avec la ligne `familles` retirée
    // à la main sur cette seule exécution, voir la passation du ticket).
    await client.prestation.create({
      data: {
        id: PRESTATION_9L04JC,
        societe_id: reperes.societeId,
        code: `9L04JC-${PRESTATION_9L04JC.slice(0, 8)}`,
        libelle: "Prestation 9L04JC (pont élévateur)",
        actif: true,
        familles: {
          create: [{ id: uuidv7(), famille_id: modelePont.famille_id }],
        },
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_PONT_9L04JC,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04JC,
        site_id: SITE_9L04JC,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
        machines: {
          create: [{ id: uuidv7(), machine_id: MACHINE_PONT_9L04JC }],
        },
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_COMPRESSEUR_9L04JC,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04JC,
        site_id: SITE_9L04JC,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
        machines: {
          create: [{ id: uuidv7(), machine_id: MACHINE_COMPRESSEUR_9L04JC }],
        },
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
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L04JC,
    );
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_PONT_9L04JC, MACHINE_COMPRESSEUR_9L04JC] } },
    });
    await client.prestation.deleteMany({ where: { id: PRESTATION_9L04JC } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9L04JC } });
    await client.client.deleteMany({ where: { id: CLIENT_9L04JC } });
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

for (const largeur of [1280, 375] as const) {
  test(`capture — réglage des prestations à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");
    await expect(
      page.getByRole("heading", { name: fr["prestations.titre"] }),
    ).toBeVisible();
    await capturer(page, "reglage-prestations", largeur);
  });
}

test("capture — rapport terrain à 375px, sur un PONT ÉLÉVATEUR", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
  await page.goto(`/terrain/${INTERVENTION_PONT_9L04JC}`);
  await capturer(page, "rapport-terrain-pont", 375);
});

test("capture — rapport terrain à 375px, sur un COMPRESSEUR", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
  await page.goto(`/terrain/${INTERVENTION_COMPRESSEUR_9L04JC}`);
  await capturer(page, "rapport-terrain-compresseur", 375);
});
