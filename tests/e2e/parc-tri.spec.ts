import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99C-PARC-TRI (26/09/2026) — le parc se lit par client, et la liste prend la
 * hauteur de l'écran.
 *
 * ## LE CONSTAT — audit d'ergonomie du 25/09/2026, constats 29 et 30
 *
 * Constat 29 : à l'intérieur d'un même groupe (`complet`), le parc triait par
 * `numero` puis `numero_serie` — deux identifiants qui ne disent rien du
 * CLIENT, et mélangent ses machines avec celles de tous les autres.
 * `rechercherLeParc` (`lib/machines/depot.ts`) trie désormais par la raison
 * sociale du client, puis par la désignation du modèle (marque, référence),
 * puis par le n° de série. Constat 30 : à 1280×800, la liste ne montrait
 * qu'une bande sous trois cartes KPI. Le tri se prouve CONTRE la vraie base
 * (un gardien unitaire ne peut pas relire `ORDER BY`) ; la hauteur se prouve
 * dans un VRAI navigateur (un gardien unitaire ne rend rien).
 *
 * ## LA SCÈNE — deux clients, une désignation PARTAGÉE
 *
 * `PTRI-A` et `PTRI-Z` bornent l'alphabet exprès. Les deux machines forgées
 * partagent le MÊME modèle (même marque, même référence) : si l'ordre reposait
 * encore sur autre chose que le client — un reste de tri par désignation ou
 * par n° de série —, les deux lignes resteraient indépartageables sur ce
 * critère, et seul le client déciderait. La recherche `q=PTRIREF` isole ces
 * deux lignes de tout le reste du parc (démonstration et scènes des autres
 * fichiers, joués en parallèle — voir le piège connu de ce lot) : la
 * comparaison ne porte JAMAIS sur un compte large.
 *
 * ## LA SCÈNE — préfixée `PTRI-`, créée et supprimée par l'épreuve
 *
 * Même discipline que `tests/e2e/parc-sites.spec.ts` : deux clients, un site
 * par client (une machine sans site n'existe pas ; D6), une famille et un
 * modèle dédiés. Aucune ligne n'est ajoutée au semis
 * (`prisma/seed*.ts`), et rien n'est écrit dans une fixture `SCENE.*`
 * partagée.
 *
 * ## LA HAUTEUR — mesurée sur le parc TEL QUEL, sans filtre
 *
 * La seconde épreuve ne force RIEN : la vue par défaut de `/parc` contient
 * déjà les machines du semis, et la mesure de hauteur ne compte aucune
 * ligne — elle lit la géométrie du bloc `[data-bloc="liste-machines"]`, une
 * propriété qui tient quel que soit le nombre de machines tant que la liste
 * n'est pas vide (toujours vraie sur le semis de démonstration).
 *
 * ## LES CAPTURES — même recette que `fiche-machine-vgp.spec.ts`
 *
 * Rien n'est écrit sans `CAPTURES_99C_PARC_TRI` : l'exécution ordinaire de
 * `pnpm test:e2e` n'écrit jamais de fichier.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "PTRI-";
const REFERENCE_MODELE = "PTRIREF";
const MARQUE_MODELE = "PTRIMARQUE";
const DOSSIER = process.env.CAPTURES_99C_PARC_TRI ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

let admin: PrismaClient;
let clientAId: string;
let clientZId: string;
let siteAId: string;
let siteZId: string;
let machineAId: string;
let machineZId: string;
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

  const [clientA, clientZ] = await Promise.all([
    admin.client.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        raison_sociale: fr["parctri.e2e.client_a"],
        actif: true,
      },
    }),
    admin.client.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        raison_sociale: fr["parctri.e2e.client_z"],
        actif: true,
      },
    }),
  ]);
  clientAId = clientA.id;
  clientZId = clientZ.id;

  const [siteA, siteZ] = await Promise.all([
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientAId,
        agence_id: agence.id,
        libelle: fr["parctri.e2e.site_a"],
      },
    }),
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientZId,
        agence_id: agence.id,
        libelle: fr["parctri.e2e.site_z"],
      },
    }),
  ]);
  siteAId = siteA.id;
  siteZId = siteZ.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `PTRIFAM${randomUUID().slice(0, 6)}`,
      libelle: `${PREFIXE}Famille`,
    },
  });
  familleId = famille.id;

  // LA MÊME DÉSIGNATION POUR LES DEUX MACHINES (voir la note de tête) — c'est
  // ce qui isole le CLIENT comme seul critère qui les départage.
  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: MARQUE_MODELE,
      reference: REFERENCE_MODELE,
    },
  });
  modeleId = modele.id;

  const [machineA, machineZ] = await Promise.all([
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientAId,
        site_id: siteAId,
        qr_token: `PTRIQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PTRI-SN-A",
      },
    }),
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientZId,
        site_id: siteZId,
        qr_token: `PTRIQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PTRI-SN-Z",
      },
    }),
  ]);
  machineAId = machineA.id;
  machineZId = machineZ.id;
});

test.afterAll(async () => {
  try {
    await admin.machine.deleteMany({ where: { modele_id: modeleId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: { in: [siteAId, siteZId] } } });
    await admin.client.deleteMany({
      where: { id: { in: [clientAId, clientZId] } },
    });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le parc trie par client — « PTRI-A » précède « PTRI-Z », à désignation de modèle égale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/parc?q=${encodeURIComponent(REFERENCE_MODELE)}`);
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  // Les DEUX lignes de l'épreuve, et elles seules (`q` isole `PTRIREF`) —
  // repérées par leur `href`, jamais par un texte : les deux titres sont
  // IDENTIQUES (même marque, même référence).
  const liens = page.locator('[data-bloc="liste-machines"] a');
  await expect(liens).toHaveCount(2);
  const hrefs = await liens.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("href") ?? ""),
  );
  const indexA = hrefs.findIndex((href) => href.includes(machineAId));
  const indexZ = hrefs.findIndex((href) => href.includes(machineZId));
  expect(indexA).toBeGreaterThanOrEqual(0);
  expect(indexZ).toBeGreaterThanOrEqual(0);
  expect(indexA).toBeLessThan(indexZ);

  await capturer(page, "parc-tri-ordre-client-1280");
});

test("à 1280×800, la liste occupe au moins 480 px visibles sous la barre et les KPI (constat 30)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  const hauteurVisible = await page.evaluate(() => {
    const liste = document.querySelector('[data-bloc="liste-machines"]');
    if (liste === null) return 0;
    const rect = liste.getBoundingClientRect();
    return Math.min(rect.height, window.innerHeight - rect.top);
  });
  expect(hauteurVisible).toBeGreaterThanOrEqual(480);

  await capturer(page, "parc-tri-liste-compacte-1280");
});
