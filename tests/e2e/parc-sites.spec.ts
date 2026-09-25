import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 85-PARC-SITES (25/09/2026) — un site se nomme « Client — Site » dans le
 * filtre du parc et sur la liste des sites.
 *
 * ## Ce que ce scénario prouve, et que rien d'autre ne peut prouver
 *
 * L'audit d'ergonomie du 25/09 mesure « Nouméa » six fois dans le seul filtre
 * du parc — impossible de savoir lequel choisir. Un gardien unitaire prouve
 * que `libelleClientSite` compose juste (`tests/unit/presentation/libelle-
 * client-site.test.ts`) ; il ne peut pas prouver que DEUX sites RÉELS du même
 * libellé, chez deux clients différents, se distinguent bel et bien à
 * l'écran une fois affichés côte à côte — c'est l'objet de ce fichier.
 *
 * ## Scène propre, préfixée `PSI-`, créée et supprimée par l'épreuve
 *
 * Deux clients (`PSI-A`, `PSI-B`), chacun un site au MÊME libellé
 * (`PSI-Noumea`) et une machine — sans machine, le site n'entre ni dans le
 * filtre du parc (`optionsDeFiltreDuParc` ne propose que les sites qui en
 * portent au moins une) ni dans la liste par défaut des sites (LISTES-1
 * masque un site sans équipement). Aucune ligne n'est ajoutée au semis
 * (`prisma/seed*.ts`) — la leçon de CONTRAT-SITE, quatre fois tombée pour
 * cette raison précise.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "PSI-";
const SCENE_PSI = {
  clientA: fr["parcsites.e2e.client_a"],
  clientB: fr["parcsites.e2e.client_b"],
  site: fr["parcsites.e2e.site"],
} as const;

let admin: PrismaClient;
let clientAId: string;
let clientBId: string;
let siteAId: string;
let siteBId: string;
let familleId: string;
let modeleId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const [clientA, clientB] = await Promise.all([
    admin.client.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        raison_sociale: SCENE_PSI.clientA,
        actif: true,
      },
    }),
    admin.client.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        raison_sociale: SCENE_PSI.clientB,
        actif: true,
      },
    }),
  ]);
  clientAId = clientA.id;
  clientBId = clientB.id;

  const [siteA, siteB] = await Promise.all([
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientAId,
        agence_id: agence.id,
        libelle: SCENE_PSI.site,
      },
    }),
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientBId,
        agence_id: agence.id,
        libelle: SCENE_PSI.site,
      },
    }),
  ]);
  siteAId = siteA.id;
  siteBId = siteB.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `PSIFAM${randomUUID().slice(0, 6)}`,
      libelle: `${PREFIXE}Famille`,
    },
  });
  familleId = famille.id;
  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: "PSIMARQUE",
      reference: "PSIREF",
    },
  });
  modeleId = modele.id;

  // UNE MACHINE PAR SITE — condition d'entrée dans les deux écrans touchés
  // (voir la note de tête).
  await Promise.all([
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientAId,
        site_id: siteAId,
        qr_token: `PSIQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PSI-SN-A",
      },
    }),
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientBId,
        site_id: siteBId,
        qr_token: `PSIQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PSI-SN-B",
      },
    }),
  ]);
});

test.afterAll(async () => {
  try {
    await admin.machine.deleteMany({ where: { modele_id: modeleId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: { in: [siteAId, siteBId] } } });
    await admin.client.deleteMany({
      where: { id: { in: [clientAId, clientBId] } },
    });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le filtre Site du parc distingue deux sites au même libellé par leur client", async ({
  page,
}) => {
  await page.goto("/parc");
  const options = await page
    .locator('select[name="site"] option')
    .allTextContents();
  const separateur = fr["ponctuation.separateur"];
  expect(options).toContain(
    `${SCENE_PSI.clientA}${separateur}${SCENE_PSI.site}`,
  );
  expect(options).toContain(
    `${SCENE_PSI.clientB}${separateur}${SCENE_PSI.site}`,
  );

  // La valeur envoyée reste l'identifiant du SITE, jamais le libellé composé.
  await expect(
    page.locator(`select[name="site"] option[value="${siteAId}"]`),
  ).toHaveText(`${SCENE_PSI.clientA}${separateur}${SCENE_PSI.site}`);
  await expect(
    page.locator(`select[name="site"] option[value="${siteBId}"]`),
  ).toHaveText(`${SCENE_PSI.clientB}${separateur}${SCENE_PSI.site}`);
});

test("/sites titre les deux cartes par leur client, pas par le libellé partagé du site", async ({
  page,
}) => {
  await page.goto(`/sites?q=${encodeURIComponent(SCENE_PSI.site)}`);
  const carteA = page.locator(`article:has(a[href="/sites/${siteAId}"])`);
  const carteB = page.locator(`article:has(a[href="/sites/${siteBId}"])`);
  await expect(carteA).toBeVisible();
  await expect(carteB).toBeVisible();

  await expect(
    carteA.getByRole("link", { name: SCENE_PSI.clientA, exact: true }),
  ).toBeVisible();
  await expect(
    carteB.getByRole("link", { name: SCENE_PSI.clientB, exact: true }),
  ).toBeVisible();

  // Le libellé du site reste lisible, en sous-titre, avec la commune.
  await expect(
    carteA.getByRole("link", { name: SCENE_PSI.site, exact: true }),
  ).toBeVisible();
  await expect(
    carteB.getByRole("link", { name: SCENE_PSI.site, exact: true }),
  ).toBeVisible();
});
