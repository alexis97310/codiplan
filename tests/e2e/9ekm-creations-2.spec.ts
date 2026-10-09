import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  CODE_FAMILLE_A_9EKM,
  CODE_FAMILLE_B_9EKM,
  LIBELLE_FAMILLE_A_9EKM,
  LIBELLE_FAMILLE_B_9EKM,
  LIBELLE_SITE_9EKM,
  MARQUE_MODELE_A_9EKM,
  MARQUE_MODELE_B_9EKM,
  NUMERO_SERIE_9EKM,
  RAISON_CLIENT_9EKM,
  REFERENCE_INTERNE_9EKM,
  REFERENCE_MODELE_A_9EKM,
  REFERENCE_MODELE_B_9EKM,
} from "./setup/scene-9ekm";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EK-TP-UX5-2-CREATIONS-2 — `/parc/nouvelle` au gabarit du 28/09 (D184).
 *
 * **SA PROPRE SCÈNE, PRÉFIXÉE `9EKM-`** (voir `./setup/scene-9ekm.ts` pour
 * la raison du préfixe) — jamais `SCENE.*`. Un client et son site, deux
 * familles actives et un modèle dans chacune, posés en `beforeAll` sous le
 * PROPRIÉTAIRE, retirés en `afterAll` par IDENTITÉ (les uuids tirés ici),
 * dans l'ordre que les clés étrangères `Restrict` exigent : machines →
 * modèles → familles → site → client.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_9EKM = uuidv7();
const SITE_9EKM = uuidv7();
const FAMILLE_A_9EKM = uuidv7();
const FAMILLE_B_9EKM = uuidv7();
const MODELE_A_9EKM = uuidv7();
const MODELE_B_9EKM = uuidv7();

const machinesCreees: string[] = [];

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
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9EKM,
        societe_id: societe.id,
        raison_sociale: RAISON_CLIENT_9EKM,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EKM,
        societe_id: societe.id,
        client_id: CLIENT_9EKM,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_9EKM,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_A_9EKM,
        societe_id: societe.id,
        code: CODE_FAMILLE_A_9EKM,
        libelle: LIBELLE_FAMILLE_A_9EKM,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_B_9EKM,
        societe_id: societe.id,
        code: CODE_FAMILLE_B_9EKM,
        libelle: LIBELLE_FAMILLE_B_9EKM,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_A_9EKM,
        societe_id: societe.id,
        famille_id: FAMILLE_A_9EKM,
        marque: MARQUE_MODELE_A_9EKM,
        reference: REFERENCE_MODELE_A_9EKM,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_B_9EKM,
        societe_id: societe.id,
        famille_id: FAMILLE_B_9EKM,
        marque: MARQUE_MODELE_B_9EKM,
        reference: REFERENCE_MODELE_B_9EKM,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // NETTOYAGE PAR IDENTIFIANTS SEULEMENT (solde 9EP point 50) — `id in
    // machinesCreees` couvre ce que chaque scénario a tracé ; `client_id`
    // (forgé par CE fichier, jamais un prefixe de texte) couvre tout ce
    // qu'un scénario aurait omis de tracer.
    await client.machine.deleteMany({
      where: {
        OR: [{ id: { in: machinesCreees } }, { client_id: CLIENT_9EKM }],
      },
    });
    await client.modeleMateriel.deleteMany({
      where: { id: { in: [MODELE_A_9EKM, MODELE_B_9EKM] } },
    });
    await client.familleMateriel.deleteMany({
      where: { id: { in: [FAMILLE_A_9EKM, FAMILLE_B_9EKM] } },
    });
    await client.site.delete({ where: { id: SITE_9EKM } });
    await client.client.delete({ where: { id: CLIENT_9EKM } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la famille choisie réduit le sélecteur de modèle, et « Je ne peux pas le lire » crée la fiche", async ({
  page,
}) => {
  await page.goto(`/parc/nouvelle?client=${CLIENT_9EKM}&site=${SITE_9EKM}`);

  await page
    .locator('[data-champ="famille"] select')
    .selectOption({ label: LIBELLE_FAMILLE_A_9EKM });

  await page.locator('[data-selecteur="modele_id"] input[type="text"]').click();
  const resultats = page.locator(
    '[data-selecteur="modele_id"] ul[role="listbox"] li[role="option"]',
  );
  await expect(resultats).toHaveCount(1);
  await expect(resultats.first()).toContainText(MARQUE_MODELE_A_9EKM);
  await resultats.first().click();

  await page
    .locator('input[name="reference_interne"]')
    .fill(REFERENCE_INTERNE_9EKM);
  await page
    .getByRole("button", { name: fr["machine.action.illisible"] })
    .click();
  await expect(page.locator('input[name="numero_serie"]')).toHaveValue(
    `SN-INCONNU-${REFERENCE_INTERNE_9EKM}`,
  );

  await page
    .getByRole("button", { name: fr["machine.action.creer_la_machine"] })
    .click();

  await expect(page).toHaveURL(/\/parc\/[0-9a-f-]{36}/);
  const idCree = new URL(page.url()).pathname.split("/").pop();
  expect(idCree).toBeDefined();
  const idMachine = idCree!;
  machinesCreees.push(idMachine);

  const client = admin();
  try {
    const machine = await client.machine.findUniqueOrThrow({
      where: { id: idMachine },
      select: {
        numero_serie: true,
        complet: true,
        criticite: true,
        statut: true,
      },
    });
    expect(machine.numero_serie).toBe(`SN-INCONNU-${REFERENCE_INTERNE_9EKM}`);
    expect(machine.complet).toBe(false);
    expect(machine.criticite).toBe("normale");
    expect(machine.statut).toBe("en_service");
  } finally {
    await client.$disconnect();
  }
});

test("le même modèle et le même n° de série une seconde fois → refus sous le champ, la saisie reste à l'écran", async ({
  page,
}) => {
  await page.goto(`/parc/nouvelle?client=${CLIENT_9EKM}&site=${SITE_9EKM}`);

  await choisirResultatParTexte(
    page,
    "modele_id",
    MARQUE_MODELE_A_9EKM,
    MARQUE_MODELE_A_9EKM,
  );
  await page
    .locator('input[name="numero_serie"]')
    .fill(`SN-INCONNU-${REFERENCE_INTERNE_9EKM}`);

  await page
    .getByRole("button", { name: fr["machine.action.creer_la_machine"] })
    .click();

  // Scopé par id, jamais `getByRole("alert")` nu — l'annonceur de route de
  // Next.js (`__next-route-announcer__`) porte aussi `role="alert"`.
  await expect(page.locator("#numero_serie-erreur")).toHaveText(
    fr["machine.refus.numero_serie_pris"],
  );
  // La saisie reste à l'écran — le formulaire ne recharge pas.
  await expect(page.locator('input[name="numero_serie"]')).toHaveValue(
    `SN-INCONNU-${REFERENCE_INTERNE_9EKM}`,
  );
  await expect(page).toHaveURL(/\/parc\/nouvelle/);
});

test("« Créer et en ajouter une autre » rejoint un formulaire neuf, motif de succès en vert, client et site repris", async ({
  page,
}) => {
  await page.goto(`/parc/nouvelle?client=${CLIENT_9EKM}&site=${SITE_9EKM}`);

  await choisirResultatParTexte(
    page,
    "modele_id",
    MARQUE_MODELE_A_9EKM,
    MARQUE_MODELE_A_9EKM,
  );
  await page.locator('input[name="numero_serie"]').fill(NUMERO_SERIE_9EKM);

  await page
    .getByRole("button", { name: fr["machine.action.creer_et_ajouter"] })
    .click();

  await expect(page).toHaveURL(
    new RegExp(
      `/parc/nouvelle\\?client=${CLIENT_9EKM}&site=${SITE_9EKM}&motif=machine\\.creee`,
    ),
  );
  await expect(page.getByRole("status")).toHaveText(fr["machine.creee"]);

  const client = admin();
  try {
    const machine = await client.machine.findFirstOrThrow({
      where: { numero_serie: NUMERO_SERIE_9EKM },
      select: { id: true },
    });
    machinesCreees.push(machine.id);
  } finally {
    await client.$disconnect();
  }
});
