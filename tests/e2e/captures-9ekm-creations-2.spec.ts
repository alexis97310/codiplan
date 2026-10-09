import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  CODE_FAMILLE_9EKMCAP,
  LIBELLE_FAMILLE_9EKMCAP,
  LIBELLE_SITE_9EKMCAP,
  MARQUE_MODELE_9EKMCAP,
  NUMERO_SERIE_EXISTANT_9EKMCAP,
  PREFIXE_9EKMCAP,
  QR_EXISTANT_9EKMCAP,
  RAISON_CLIENT_9EKMCAP,
  REFERENCE_MODELE_9EKMCAP,
} from "./setup/scene-9ekmcap";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EK-TP-UX5-2-CREATIONS-2 — `/parc/nouvelle` au gabarit du
 * 28/09 (D184). Même patron que `captures-9db-retouches-10.spec.ts` : le
 * dossier de sortie vient d'une variable d'environnement, aucune capture
 * n'est écrite si elle est absente.
 *
 * SA PROPRE SCÈNE, préfixée `9EKMCAP-` — distincte de `9EKM-`
 * (`./setup/scene-9ekm.ts`, utilisée par les épreuves du ticket) pour ne
 * jamais se faire balayer par son `afterAll`, et distincte de `9EK-`
 * (`9EK-TP-UX5-2-CREATIONS-1.spec.ts`) pour la même raison.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EKM ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const FAMILLE_ID = uuidv7();
const MODELE_ID = uuidv7();
const MACHINE_EXISTANTE_ID = uuidv7();

const machinesCreees: string[] = [];

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_CLIENT_9EKMCAP,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_9EKMCAP,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ID,
        societe_id: societe.id,
        code: CODE_FAMILLE_9EKMCAP,
        libelle: LIBELLE_FAMILLE_9EKMCAP,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_ID,
        societe_id: societe.id,
        famille_id: FAMILLE_ID,
        marque: MARQUE_MODELE_9EKMCAP,
        reference: REFERENCE_MODELE_9EKMCAP,
      },
    });
    // UNE MACHINE DÉJÀ PRÉSENTE — pour que la capture du refus de doublon
    // (même modèle, même numéro de série) ait quelque chose à heurter.
    await client.machine.create({
      data: {
        id: MACHINE_EXISTANTE_ID,
        societe_id: societe.id,
        modele_id: MODELE_ID,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        qr_token: QR_EXISTANT_9EKMCAP,
        numero_serie: NUMERO_SERIE_EXISTANT_9EKMCAP,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.machine.deleteMany({
      where: {
        OR: [
          { id: { in: [MACHINE_EXISTANTE_ID, ...machinesCreees] } },
          { numero_serie: { startsWith: PREFIXE_9EKMCAP } },
        ],
      },
    });
    await client.modeleMateriel.delete({ where: { id: MODELE_ID } });
    await client.familleMateriel.delete({ where: { id: FAMILLE_ID } });
    await client.site.delete({ where: { id: SITE_ID } });
    await client.client.delete({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const largeur of [1280, 375] as const) {
  test(`/parc/nouvelle — vide, depuis la fiche du site, famille choisie, refus de doublon — ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });

    // 1. VIDE, DEPUIS LA FICHE DU SITE (`?client=&site=`).
    await page.goto(`/parc/nouvelle?client=${CLIENT_ID}&site=${SITE_ID}`);
    await expect(
      page.getByRole("heading", { name: fr["machine.nouvelle.titre"] }),
    ).toBeVisible();
    await capturer(page, `nouvelle-machine-vide-${largeur}`);

    // 2. FAMILLE CHOISIE.
    await page
      .locator('[data-champ="famille"] select')
      .selectOption({ label: LIBELLE_FAMILLE_9EKMCAP });
    await page
      .locator('[data-selecteur="modele_id"] input[type="text"]')
      .click();
    await expect(
      page
        .locator('[data-selecteur="modele_id"] ul[role="listbox"]')
        .getByText(MARQUE_MODELE_9EKMCAP),
    ).toBeVisible();
    await capturer(page, `nouvelle-machine-famille-choisie-${largeur}`);
    await page
      .locator(
        '[data-selecteur="modele_id"] ul[role="listbox"] li[role="option"]',
      )
      .first()
      .click();

    // 3. REFUS SOUS LE N° DE SÉRIE (même modèle, même numéro de série
    //    qu'une machine déjà présente).
    await page
      .locator('input[name="numero_serie"]')
      .fill(NUMERO_SERIE_EXISTANT_9EKMCAP);
    await page
      .getByRole("button", { name: fr["machine.action.creer_la_machine"] })
      .click();
    await expect(page.locator("#numero_serie-erreur")).toBeVisible();
    await capturer(page, `nouvelle-machine-refus-numero-serie-${largeur}`);
  });

  test(`/parc/nouvelle — après « Créer et en ajouter une autre » — ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await page.goto(`/parc/nouvelle?client=${CLIENT_ID}&site=${SITE_ID}`);

    await page
      .locator('[data-champ="famille"] select')
      .selectOption({ label: LIBELLE_FAMILLE_9EKMCAP });
    await page
      .locator('[data-selecteur="modele_id"] input[type="text"]')
      .click();
    await page
      .locator(
        '[data-selecteur="modele_id"] ul[role="listbox"] li[role="option"]',
      )
      .first()
      .click();
    await page
      .locator('input[name="numero_serie"]')
      .fill(`${PREFIXE_9EKMCAP}SN-ENSUITE-${largeur}`);

    await page
      .getByRole("button", { name: fr["machine.action.creer_et_ajouter"] })
      .click();
    await expect(page.getByRole("status")).toHaveText(fr["machine.creee"]);
    await capturer(page, `nouvelle-machine-apres-creer-et-ajouter-${largeur}`);

    const client = admin();
    try {
      const machine = await client.machine.findFirstOrThrow({
        where: { numero_serie: `${PREFIXE_9EKMCAP}SN-ENSUITE-${largeur}` },
        select: { id: true },
      });
      machinesCreees.push(machine.id);
    } finally {
      await client.$disconnect();
    }
  });

  test(`/parc/[id]/modifier — « Corriger la fiche », n'a pas bougé — ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await page.goto(`/parc/${MACHINE_EXISTANTE_ID}/modifier`);
    await expect(
      page.getByRole("heading", { name: fr["machine.modifier.titre"] }),
    ).toBeVisible();
    await capturer(page, `corriger-la-fiche-apres-${largeur}`);
  });
}
