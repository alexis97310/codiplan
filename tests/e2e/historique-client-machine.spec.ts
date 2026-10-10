import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * `CAPTURES_GR11_CLIENT_MACHINE=<dossier>` fait écrire les captures
 * AVANT/APRÈS de la fiche client, à 1280 et 375 px, dans ce dossier.
 */
const DOSSIER_CAPTURES = process.env.CAPTURES_GR11_CLIENT_MACHINE ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/**
 * 9AA-GR11-CLIENT-MACHINE — LA MACHINE DE CHAQUE INTERVENTION, DANS
 * L'HISTORIQUE DE LA FICHE CLIENT.
 *
 * ## Le constat (audit G14 du 26/09/2026, `docs/propositions/9AA-GR11-CLIENT-MACHINE/`)
 *
 * `app/(back-office)/clients/[id]/page.tsx` montrait Référence, Date
 * planifiée, Nature, Site, Statut — jamais la machine : retrouver l'historique
 * d'une machine depuis son client exigeait d'ouvrir chaque intervention une à
 * une. Ce scénario prouve que la ligne de l'historique porte désormais un lien
 * vers la fiche de la machine (`/parc/<id>`), avec son numéro de série.
 *
 * ## Sa propre scène, préfixée `ERGO11-`
 *
 * *Mode `fullyParallel` du dépôt* : un client, un site et une machine à soi —
 * jamais ceux du semis partagé (`prisma/seed.ts`) — créés en `beforeAll`,
 * supprimés en `afterAll`. Une seule intervention lui suffit : depuis
 * PARCOURS-1 (23/09/2026), une intervention ne porte qu'UNE machine au plus
 * (`@@unique([intervention_id])` sur `intervention_machine`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT = uuidv7();
const SITE = uuidv7();
const MACHINE = uuidv7();
const INTERVENTION = uuidv7();
const RATTACHEMENT = uuidv7();
const NUMERO_SERIE = "ERGO11-SN-04471";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT,
        societe_id: societe.id,
        raison_sociale:
          "Client de la machine dans l'historique (épreuve ERGO11-CLIENT-MACHINE)",
      },
    });
    await client.site.create({
      data: {
        id: SITE,
        societe_id: societe.id,
        client_id: CLIENT,
        agence_id: agence.id,
        libelle: "Lieu du client ERGO11-CLIENT-MACHINE",
        temps_trajet_min: 10,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT,
        site_id: SITE,
        numero_serie: NUMERO_SERIE,
        qr_token: engendrerJetonQr(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: CLIENT,
        site_id: SITE,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: RATTACHEMENT,
        societe_id: societe.id,
        intervention_id: INTERVENTION,
        machine_id: MACHINE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.interventionMachine.deleteMany({
      where: { id: RATTACHEMENT },
    });
    await client.intervention.deleteMany({ where: { id: INTERVENTION } });
    await client.machine.deleteMany({ where: { id: MACHINE } });
    await client.site.deleteMany({ where: { id: SITE } });
    await client.client.deleteMany({ where: { id: CLIENT } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("LA LIGNE DE L'HISTORIQUE PORTE UN LIEN VERS LA FICHE DE SA MACHINE, AVEC SON NUMÉRO DE SÉRIE", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // ADAPTÉ (D191, 9EF-TP-UX4-2-FICHES-1) — le tableau paginé vit désormais
  // sous l'onglet Interventions, puce « Toutes » (le défaut de cet onglet).
  await page.goto(`/clients/${CLIENT}?onglet=interventions&etat=toutes`);
  await expect(page.locator("main")).toBeVisible();

  const bloc = page.locator('[data-bloc="historique-client"]');
  await expect(bloc).toBeVisible();
  // LES CAPTURES PRÉCÈDENT LES ASSERTIONS QUI ROUGISSENT SUR L'ANCIEN CODE :
  // sur `main` avant ce lot, le bloc existe déjà — seule la colonne « Machine »
  // manque — et l'image AVANT doit exister malgré l'échec qui suit.
  await capturer(page, "fiche-client", 1280);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload({ waitUntil: "networkidle" });
  await expect(bloc).toBeVisible();
  await capturer(page, "fiche-client", 375);

  const ligne = bloc.locator("tbody tr").first();
  const lienMachine = ligne.locator(`a[href="/parc/${MACHINE}"]`);
  await expect(lienMachine).toBeVisible();

  const texte = await lienMachine.innerText();
  expect(texte).toContain(NUMERO_SERIE);
});
